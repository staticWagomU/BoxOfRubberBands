import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";

const collectionEntries = await getCollection("daily");

const pages = process.env.SKIP_OG
	? []
	: Object.fromEntries(collectionEntries.map(({ id, data }) => [id, data]));

export const { getStaticPaths, GET } = OGImageRoute({
	param: "path",
	pages,
	getImageOptions: (path, page) => {
		let imagePath = path;
		// Check if the path follows yyyy/mm/yyyy-mm-dd pattern
		const pathParts = path.split('/');
		if (pathParts.length < 3) {
			// Convert from the old format to the new one
			const filename = path;
			const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
			if (match) {
				const [_, year, month] = match;
				imagePath = `${year}/${month}/${filename}`;
			}
		}
		
		// Use the updated image path for OG image generation
		// The file will be saved at /daily/yyyy/mm/yyyy-mm-dd.png
		// Update path param to use the new format
		path = imagePath;
		return {
			title: ` ${Number(page.pubDate.getMonth() + 1)}/${page.pubDate.getDate()}のにっき`,
			bgImage: {
				path: "./public/OGP/daily.png",
				fit: "cover",
			},
			font: {
				title: {
					size: 160,
					color: [51, 51, 51],
					families: ["Cherry Bomb One"],
					lineHeight: 2.3,
				},
			},
			fonts: ["./src/pages/daily/_fonts/Cherry_Bomb_One/CherryBombOne-Regular.ttf"],
		};
	},
});
