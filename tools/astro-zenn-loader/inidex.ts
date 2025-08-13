import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import Parser from "rss-parser";

const ZENN_RSS_BASE_URL = 'https://zenn.dev';
const RSS_FEED_PATH = '/feed?all=1';

type ZennLoaderProps = {
  name: string;
}

const enclosureSchema = z.object({
  url: z.string().url(),
  length: z.union([z.string(), z.number()]),
  type: z.string()
});

const zennItemSchema = z.object({
  creator: z.string(),
  title: z.string(),
  link: z.string().url(),
  pubDate: z.string(),
  enclosure: enclosureSchema,
  'dc:creator': z.string(),
  content: z.string(),
  contentSnippet: z.string(),
  guid: z.string(),
  isoDate: z.string().datetime()
});

type ZennItem = z.infer<typeof zennItemSchema>;

const buildFeedUrl = (userName: string): string => {
  return `${ZENN_RSS_BASE_URL}/${userName}${RSS_FEED_PATH}`;
};

const fetchRssFeed = async (userName: string) => {
  const parser = new Parser();
  const feedUrl = buildFeedUrl(userName);
  
  try {
    return await parser.parseURL(feedUrl);
  } catch (error) {
    throw new Error(
      `Failed to fetch RSS feed from ${feedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

const processRssItem = (item: unknown): ZennItem | null => {
  try {
    return zennItemSchema.parse(item);
  } catch (error) {
    const itemId = (item as any)?.guid || 'unknown';
    console.error(`Failed to parse RSS item [${itemId}]:`, error);
    return null;
  }
};

const loadRssItems = async ({ store, userName }: { 
  store: any; 
  userName: string 
}): Promise<void> => {
  const feed = await fetchRssFeed(userName);
  
  store.clear();
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const rawItem of feed.items) {
    const parsedItem = processRssItem(rawItem);
    
    if (parsedItem) {
      store.set({
        id: parsedItem.guid,
        data: parsedItem
      });
      successCount++;
    } else {
      failureCount++;
    }
  }
  
  if (failureCount > 0) {
    console.warn(
      `Processed ${successCount} items successfully, ${failureCount} items failed to parse`
    );
  }
};

export const zennLoader = (props: ZennLoaderProps): Loader => ({
  name: 'zenn',
  load: async ({ store }) => {
    try {
      await loadRssItems({ store, userName: props.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`ZennLoader error for user '${props.name}':`, errorMessage);
      throw error;
    }
  },
  schema: zennItemSchema
})

