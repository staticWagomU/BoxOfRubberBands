const markdownAccepts = (request) => {
	const accept = request.headers.get("Accept") ?? "";
	return accept
		.split(",")
		.map((value) => {
			const [type, ...params] = value.split(";");
			const q = params
				.map((param) => param.trim())
				.find((param) => param.startsWith("q="))
				?.replace("q=", "");

			return {
				type: type?.trim().toLowerCase(),
				q: q === undefined ? 1 : Number(q),
			};
		})
		.some(({ type, q }) => type === "text/markdown" && q > 0);
};

const setVaryAccept = (headers) => {
	const vary = headers.get("Vary");
	if (!vary) {
		headers.set("Vary", "Accept");
		return;
	}

	const values = vary.split(",").map((value) => value.trim().toLowerCase());
	if (!values.includes("accept")) {
		headers.set("Vary", `${vary}, Accept`);
	}
};

const appendLink = (headers, value) => {
	headers.append("Link", value);
};

const addHomepageDiscoveryHeaders = (headers, pathname) => {
	if (pathname !== "/" && pathname !== "/index.html") return;

	appendLink(headers, '</robots.txt>; rel="service-desc"; type="text/plain"');
	appendLink(headers, '</sitemap.xml>; rel="describedby"; type="application/xml"');
	appendLink(headers, '</rss.xml>; rel="alternate"; type="application/rss+xml"');
};

const decodeHtml = (value) =>
	value
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");

const htmlToMarkdown = (html, url) => {
	const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
	const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
	const main = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? body;

	let markdown = main
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<img\b[^>]*\bsrc="([^"]*)"[^>]*\balt="([^"]*)"[^>]*>/gi, "![$2]($1)")
		.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*\bsrc="([^"]*)"[^>]*>/gi, "![$1]($2)")
		.replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
		.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
		.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
		.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
		.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
		.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n")
		.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n")
		.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n")
		.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
		.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
		.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
		.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "_$1_")
		.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "_$1_")
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/div>|<\/section>|<\/article>|<\/header>|<\/footer>|<\/nav>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/^\s+|\s+$/gm, "")
		.replace(/\n{3,}/g, "\n\n");

	markdown = decodeHtml(markdown).trim();

	if (title && !markdown.startsWith("# ")) {
		markdown = `# ${decodeHtml(title)}\n\n${markdown}`;
	}

	return `${markdown}\n\nSource: ${url}\n`;
};

const tokenEstimate = (markdown) => Math.ceil(markdown.length / 4).toString();

export async function onRequest(context) {
	const url = new URL(context.request.url);
	const pathname = url.pathname.replace(/\/$/, "") || "/";
	const wantsMarkdown = markdownAccepts(context.request);

	if (wantsMarkdown && pathname.startsWith("/blog/") && !pathname.endsWith(".md")) {
		const markdownUrl = new URL(`${pathname}.md`, url);
		const markdownResponse = await fetch(markdownUrl, {
			headers: { Accept: "text/markdown" },
		});

		if (markdownResponse.ok) {
			const markdown = await markdownResponse.text();
			const headers = new Headers(markdownResponse.headers);
			headers.set("Content-Type", "text/markdown; charset=utf-8");
			headers.set("x-markdown-tokens", tokenEstimate(markdown));
			setVaryAccept(headers);
			addHomepageDiscoveryHeaders(headers, pathname);

			return new Response(markdown, {
				status: markdownResponse.status,
				statusText: markdownResponse.statusText,
				headers,
			});
		}
	}

	const response = await context.next();
	const headers = new Headers(response.headers);
	setVaryAccept(headers);
	addHomepageDiscoveryHeaders(headers, pathname);

	if (!wantsMarkdown) {
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	const contentType = headers.get("Content-Type") ?? "";
	if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	const markdown = htmlToMarkdown(await response.text(), url.toString());
	headers.set("Content-Type", "text/markdown; charset=utf-8");
	headers.set("x-markdown-tokens", tokenEstimate(markdown));

	return new Response(markdown, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
