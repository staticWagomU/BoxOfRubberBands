import type { Loader, LiveLoader } from 'astro/loaders';
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
  schema: zennItemSchema,

})

export const zennLiveLoader = (props: ZennLoaderProps): LiveLoader<ZennItem> => ({
  name: 'zenn-live',
  loadCollection: async ({ filter }) => {
    try {
      const feed = await fetchRssFeed(props.name);
      const entries: Array<{ id: string; data: ZennItem }> = [];
      
      for (const rawItem of feed.items) {
        const parsedItem = processRssItem(rawItem);
        
        if (parsedItem) {
          // Apply filter if provided
          if (filter) {
            // Filter by any property in the data
            const matchesFilter = Object.entries(filter).every(([key, value]) => {
              return parsedItem[key as keyof ZennItem] === value;
            });
            
            if (!matchesFilter) continue;
          }
          
          entries.push({
            id: parsedItem.guid,
            data: parsedItem
          });
        }
      }
      
      return { entries };
    } catch (error) {
      return {
        error: new Error(
          `Failed to load Zenn collection for user '${props.name}': ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      };
    }
  },
  loadEntry: async ({ filter }) => {
    try {
      const feed = await fetchRssFeed(props.name);
      
      // If filter is a string, treat it as an ID
      if (typeof filter === 'string') {
        const rawItem = feed.items.find(item => item.guid === filter);
        
        if (!rawItem) {
          return {
            error: new Error(`Entry with ID '${filter}' not found`)
          };
        }
        
        const parsedItem = processRssItem(rawItem);
        
        if (!parsedItem) {
          return {
            error: new Error(`Failed to parse entry with ID '${filter}'`)
          };
        }
        
        return {
          id: parsedItem.guid,
          data: parsedItem
        };
      }
      
      // If filter is an object, find the first matching entry
      if (filter && typeof filter === 'object') {
        for (const rawItem of feed.items) {
          const parsedItem = processRssItem(rawItem);
          
          if (parsedItem) {
            const matchesFilter = Object.entries(filter).every(([key, value]) => {
              return parsedItem[key as keyof ZennItem] === value;
            });
            
            if (matchesFilter) {
              return {
                id: parsedItem.guid,
                data: parsedItem
              };
            }
          }
        }
        
        return {
          error: new Error(`No entry found matching filter: ${JSON.stringify(filter)}`)
        };
      }
      
      return {
        error: new Error('Filter is required for loadEntry')
      };
    } catch (error) {
      return {
        error: new Error(
          `Failed to load Zenn entry for user '${props.name}': ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      };
    }
  },
})
