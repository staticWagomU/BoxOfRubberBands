import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const xmlEscape = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

const toIsoDate = (date: Date) => date.toISOString().split("T")[0];

type SitemapEntry = {
	loc: string;
	lastmod?: Date;
	priority?: string;
};

export const GET: APIRoute = async ({ site }) => {
	const origin = site?.toString() ?? "https://wagomu.me/";
	const baseUrl = origin.endsWith("/") ? origin : `${origin}/`;

	const blogPosts = await getCollection("blog", ({ data }) => data.published);
	const dailyPosts = await getCollection("daily");

	const tags = [...new Set(blogPosts.flatMap((post) => post.data.tags ?? []))].sort((a, b) =>
		a.localeCompare(b)
	);

	const entries: SitemapEntry[] = [
		{ loc: "", priority: "1.0" },
		{ loc: "blog", priority: "0.9" },
		{ loc: "info", priority: "0.5" },
		...blogPosts.map((post) => ({
			loc: `blog/${post.id}`,
			lastmod: post.data.updatedDate ?? post.data.pubDate,
			priority: "0.8",
		})),
		...dailyPosts.map((post) => ({
			loc: `daily/${post.id}`,
			lastmod: post.data.pubDate,
			priority: "0.6",
		})),
		...tags.map((tag) => ({
			loc: `tags/${encodeURIComponent(tag)}`,
			priority: "0.4",
		})),
	];

	const urls = entries
		.sort((a, b) => a.loc.localeCompare(b.loc))
		.map((entry) => {
			const loc = new URL(entry.loc, baseUrl).toString();
			const lastmod = entry.lastmod ? `\n    <lastmod>${toIsoDate(entry.lastmod)}</lastmod>` : "";
			const priority = entry.priority ? `\n    <priority>${entry.priority}</priority>` : "";

			return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmod}${priority}\n  </url>`;
		})
		.join("\n");

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
			},
		}
	);
};
