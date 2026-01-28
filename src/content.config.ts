import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { zennLoader } from "astro-zenn-loader";
import { z } from "zod";

const blogCollection = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		tags: z.array(z.string()).optional(),
		published: z.boolean(),
	}),
});

const dailyCollection = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/daily" }),
	schema: z.object({
		pubDate: z.coerce.date(),
	}),
});

export const zenn = defineCollection({
	loader: zennLoader({ name: "wagomu" }),
});

export const collections = <const>{
	blog: blogCollection,
	zenn,
	daily: dailyCollection,
};
