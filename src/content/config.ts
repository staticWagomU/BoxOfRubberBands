import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.date().transform((v) => new Date(v)),
		updatedDate: z.date().optional(),
		heroImage: z.string().optional(),
		tags: z.array(z.string()).optional(),
		published: z.boolean(),
	}),
});

const dailyCollection = defineCollection({
	type: "content",
	schema: z.object({
		pubDate: z.date().transform((v) => new Date(v)),
	}),
});

export const collections = <const>{
	blog: blogCollection,
	daily: dailyCollection,
};
