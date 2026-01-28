import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async function get({ site }) {
	const posts = await getCollection("blog");
	const items = posts
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
		.map(({ data: { pubDate, title, description }, id }) => ({
			title,
			description,
			link: `${site}blog/${id}`,
			pubDate: new Date(pubDate),
		}));

	return rss({
		title: "輪ごむの空き箱",
		description: "輪ゴムっていきなり切れるとびっくりするよね",
		site: site!.toString(),
		customData: `<language>ja-JP</language>`,
		items,
	});
};
