const acceptsMarkdown = (request) => {
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

export async function onRequest(context) {
	const url = new URL(context.request.url);
	const pathname = url.pathname.replace(/\/$/, "");

	if (pathname !== "/blog" && !pathname.endsWith(".md") && acceptsMarkdown(context.request)) {
		const markdownUrl = new URL(`${pathname}.md`, url);
		const response = await fetch(markdownUrl, {
			headers: {
				Accept: "text/markdown",
			},
		});
		const headers = new Headers(response.headers);
		headers.set("Content-Type", "text/markdown; charset=utf-8");
		setVaryAccept(headers);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	const response = await context.next();
	const headers = new Headers(response.headers);
	setVaryAccept(headers);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
