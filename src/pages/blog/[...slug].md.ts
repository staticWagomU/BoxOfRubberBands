import { getCollection } from "astro:content";

const markdownFiles = import.meta.glob<string>("../../content/blog/**/*.mdx", {
	query: "?raw",
	import: "default",
	eager: true,
});
const markdownFilesById = Object.fromEntries(
	Object.entries(markdownFiles).map(([path, source]) => [
		path
			.replace("../../content/blog/", "")
			.replace(/\.mdx$/, "")
			.toLowerCase(),
		source,
	])
);

export async function getStaticPaths() {
	const posts = await getCollection("blog");
	return posts.map((post) => ({
		params: { slug: post.id },
		props: {
			markdown: markdownFilesById[post.id.toLowerCase()] ?? post.body ?? "",
		},
	}));
}

export function GET({ props }: { props: { markdown: string } }) {
	return new Response(props.markdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});
}
