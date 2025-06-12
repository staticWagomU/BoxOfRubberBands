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
		.map((post) => {
			const { data: { pubDate }, id } = post;
			const parts = id.split('/');
			const year = parts[0];
			const month = parts[1];
			const filename = parts[2].replace('.mdx', '');
			const slug = `${year}/${month}/${filename}`;
			return {
				title: `${new Date(pubDate).toLocaleDateString("ja-JP", options)}の日記`,
				description: "日記です",
				link: `${site}daily/${slug}`,
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
