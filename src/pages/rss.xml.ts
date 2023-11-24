import rss, { pagesGlobToRssItems } from '@astrojs/rss';

export async function GET() {
  return rss({
    title: '輪ごむの空き箱',
    description: '',
    site: 'https://wagomu.me',
    items: await pagesGlobToRssItems(import.meta.glob('./**/*.[md|mdx]')),
    customData: `<language>ja-jp</language>`,
  });
}