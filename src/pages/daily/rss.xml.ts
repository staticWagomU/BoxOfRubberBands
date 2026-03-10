import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async function get({ site }) {
	const options = {
		year: "numeric",
		month: "short",
		day: "numeric",
		weekday: "short",
	} as Intl.DateTimeFormatOptions;

	const posts = await getCollection("daily");
	const items = posts
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
		.map(({ data: { pubDate }, id }) => ({
			title: `${new Date(pubDate).toLocaleDateString("ja-JP", options)}の日記`,
			description: "日記です",
			link: `${site}daily/${id}`,
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
