/**
 * Hims Blog Scraper
 *
 * Downloads all blog content from hims.com/blog using Puppeteer with stealth
 * to bypass bot protection.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

interface BlogPost {
  url: string;
  title: string;
  slug: string;
  category?: string;
  author?: string;
  publishDate?: string;
  content?: string;
  html?: string;
  excerpt?: string;
  images: string[];
  fetchedAt: string;
}

interface ScraperConfig {
  outputDir: string;
  headless: boolean;
  delayBetweenRequests: number;
  maxRetries: number;
  saveHtml: boolean;
  saveImages: boolean;
}

const DEFAULT_CONFIG: ScraperConfig = {
  outputDir: './hims-blog-content',
  headless: true,
  delayBetweenRequests: 2000,
  maxRetries: 3,
  saveHtml: true,
  saveImages: false,
};

class HimsBlogScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ScraperConfig;
  private discoveredUrls: Set<string> = new Set();
  private scrapedPosts: BlogPost[] = [];

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('Initializing browser with stealth mode...');

    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    this.page = await this.browser.newPage();

    // Set viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async navigateWithRetry(url: string): Promise<string | null> {
    if (!this.page) throw new Error('Browser not initialized');

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`  Navigating to: ${url} (attempt ${attempt}/${this.config.maxRetries})`);

        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        // Wait for content to load
        await this.delay(1500);

        const content = await this.page.content();
        return content;
      } catch (error) {
        console.error(`  Error on attempt ${attempt}: ${error}`);
        if (attempt < this.config.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`  Waiting ${waitTime}ms before retry...`);
          await this.delay(waitTime);
        }
      }
    }
    return null;
  }

  async discoverBlogUrls(): Promise<string[]> {
    console.log('\n=== Discovering Blog URLs ===\n');

    const blogIndexUrl = 'https://www.hims.com/blog';
    const html = await this.navigateWithRetry(blogIndexUrl);

    if (!html) {
      console.error('Failed to load blog index page');
      return [];
    }

    const $ = cheerio.load(html);

    // Find all blog post links
    const blogUrls: string[] = [];

    // Look for article links with various selectors
    $('a[href*="/blog/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !href.endsWith('/blog') && !href.endsWith('/blog/')) {
        const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
        if (!blogUrls.includes(fullUrl) && fullUrl.includes('/blog/')) {
          blogUrls.push(fullUrl);
        }
      }
    });

    // Also look for category pages to discover more posts
    const categoryLinks: string[] = [];
    $('a[href*="/blog/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
        // Category pages often have patterns like /blog/category-name
        const pathParts = new URL(fullUrl).pathname.split('/').filter(Boolean);
        if (pathParts.length === 2 && pathParts[0] === 'blog') {
          // Might be a category page, add for later exploration
          if (!categoryLinks.includes(fullUrl)) {
            categoryLinks.push(fullUrl);
          }
        }
      }
    });

    console.log(`Found ${blogUrls.length} blog post URLs on main page`);
    console.log(`Found ${categoryLinks.length} potential category pages`);

    // Explore category pages for more posts
    for (const categoryUrl of categoryLinks) {
      await this.delay(this.config.delayBetweenRequests);
      const categoryHtml = await this.navigateWithRetry(categoryUrl);

      if (categoryHtml) {
        const $cat = cheerio.load(categoryHtml);
        $cat('a[href*="/blog/"]').each((_, element) => {
          const href = $cat(element).attr('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
            const pathParts = new URL(fullUrl).pathname.split('/').filter(Boolean);
            // Blog posts typically have more path segments
            if (pathParts.length > 2 && !blogUrls.includes(fullUrl)) {
              blogUrls.push(fullUrl);
            }
          }
        });
      }
    }

    // Handle pagination - look for "load more" or pagination
    let pageNum = 1;
    let hasMorePages = true;

    while (hasMorePages && pageNum < 100) { // Safety limit
      const paginatedUrl = `${blogIndexUrl}?page=${pageNum + 1}`;
      await this.delay(this.config.delayBetweenRequests);

      const pageHtml = await this.navigateWithRetry(paginatedUrl);
      if (!pageHtml) {
        hasMorePages = false;
        continue;
      }

      const $page = cheerio.load(pageHtml);
      const newUrls: string[] = [];

      $page('a[href*="/blog/"]').each((_, element) => {
        const href = $page(element).attr('href');
        if (href && !href.endsWith('/blog') && !href.endsWith('/blog/')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
          if (!blogUrls.includes(fullUrl) && fullUrl.includes('/blog/')) {
            newUrls.push(fullUrl);
            blogUrls.push(fullUrl);
          }
        }
      });

      if (newUrls.length === 0) {
        hasMorePages = false;
      } else {
        console.log(`Page ${pageNum + 1}: Found ${newUrls.length} new URLs`);
        pageNum++;
      }
    }

    // Try to find sitemap for more comprehensive list
    await this.discoverFromSitemap(blogUrls);

    // Deduplicate
    const uniqueUrls = [...new Set(blogUrls)];
    console.log(`\nTotal unique blog URLs discovered: ${uniqueUrls.length}`);

    return uniqueUrls;
  }

  private async discoverFromSitemap(existingUrls: string[]): Promise<void> {
    console.log('\nChecking sitemap for additional URLs...');

    const sitemapUrls = [
      'https://www.hims.com/sitemap.xml',
      'https://www.hims.com/sitemap-blog.xml',
      'https://www.hims.com/blog/sitemap.xml',
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const html = await this.navigateWithRetry(sitemapUrl);
        if (html) {
          // Parse sitemap XML
          const urlMatches = html.match(/https:\/\/www\.hims\.com\/blog\/[^<>\s"]+/g);
          if (urlMatches) {
            for (const url of urlMatches) {
              if (!existingUrls.includes(url)) {
                existingUrls.push(url);
              }
            }
            console.log(`Found ${urlMatches.length} URLs in ${sitemapUrl}`);
          }
        }
      } catch (error) {
        // Sitemap might not exist, that's okay
      }
      await this.delay(1000);
    }
  }

  async scrapeBlogPost(url: string): Promise<BlogPost | null> {
    console.log(`\nScraping: ${url}`);

    const html = await this.navigateWithRetry(url);
    if (!html) {
      console.error(`  Failed to fetch: ${url}`);
      return null;
    }

    const $ = cheerio.load(html);

    // Extract slug from URL
    const urlParts = new URL(url).pathname.split('/').filter(Boolean);
    const slug = urlParts[urlParts.length - 1];

    // Extract title
    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text().trim() ||
                  slug;

    // Extract author
    const author = $('[class*="author"]').first().text().trim() ||
                   $('meta[name="author"]').attr('content') ||
                   $('[rel="author"]').text().trim();

    // Extract publish date
    const publishDate = $('time').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') ||
                        $('[class*="date"]').first().text().trim();

    // Extract category
    const category = $('[class*="category"]').first().text().trim() ||
                     $('meta[property="article:section"]').attr('content') ||
                     urlParts[1] || '';

    // Extract main content
    // Try various content selectors
    let contentElement = $('article').first();
    if (!contentElement.length) {
      contentElement = $('[class*="content"]').first();
    }
    if (!contentElement.length) {
      contentElement = $('main').first();
    }
    if (!contentElement.length) {
      contentElement = $('body');
    }

    // Remove unwanted elements
    contentElement.find('script, style, nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"], [class*="sidebar"], [class*="related"], [class*="comment"]').remove();

    const contentHtml = contentElement.html() || '';
    const contentText = contentElement.text().replace(/\s+/g, ' ').trim();

    // Extract excerpt
    const excerpt = $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') ||
                    contentText.substring(0, 300) + '...';

    // Extract images
    const images: string[] = [];
    contentElement.find('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && !images.includes(src)) {
        const fullSrc = src.startsWith('http') ? src : `https://www.hims.com${src}`;
        images.push(fullSrc);
      }
    });

    const post: BlogPost = {
      url,
      title,
      slug,
      category,
      author,
      publishDate,
      content: contentText,
      html: this.config.saveHtml ? contentHtml : undefined,
      excerpt,
      images,
      fetchedAt: new Date().toISOString(),
    };

    console.log(`  Title: ${title.substring(0, 60)}...`);
    console.log(`  Content length: ${contentText.length} chars`);
    console.log(`  Images: ${images.length}`);

    return post;
  }

  async scrapeAllPosts(): Promise<BlogPost[]> {
    const urls = await this.discoverBlogUrls();

    if (urls.length === 0) {
      console.log('No blog URLs discovered');
      return [];
    }

    console.log(`\n=== Scraping ${urls.length} Blog Posts ===\n`);

    const posts: BlogPost[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\nProgress: ${i + 1}/${urls.length} (${Math.round((i + 1) / urls.length * 100)}%)`);

      try {
        const post = await this.scrapeBlogPost(url);
        if (post) {
          posts.push(post);
          successCount++;

          // Save individual post
          await this.savePost(post);
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`  Error scraping ${url}: ${error}`);
        failCount++;
      }

      // Delay between requests to be respectful
      if (i < urls.length - 1) {
        await this.delay(this.config.delayBetweenRequests);
      }
    }

    console.log(`\n=== Scraping Complete ===`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    this.scrapedPosts = posts;
    return posts;
  }

  private async savePost(post: BlogPost): Promise<void> {
    const postDir = path.join(this.config.outputDir, 'posts', post.slug);

    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    // Save as JSON
    const jsonPath = path.join(postDir, 'post.json');
    fs.writeFileSync(jsonPath, JSON.stringify(post, null, 2));

    // Save content as markdown
    const mdContent = `# ${post.title}

**URL:** ${post.url}
**Author:** ${post.author || 'Unknown'}
**Published:** ${post.publishDate || 'Unknown'}
**Category:** ${post.category || 'Unknown'}

---

${post.content}

---

*Fetched: ${post.fetchedAt}*
`;

    const mdPath = path.join(postDir, 'content.md');
    fs.writeFileSync(mdPath, mdContent);

    // Save HTML if enabled
    if (this.config.saveHtml && post.html) {
      const htmlPath = path.join(postDir, 'content.html');
      fs.writeFileSync(htmlPath, post.html);
    }
  }

  async saveIndex(): Promise<void> {
    console.log('\nSaving index files...');

    // Save master index as JSON
    const indexPath = path.join(this.config.outputDir, 'index.json');
    const index = {
      totalPosts: this.scrapedPosts.length,
      scrapedAt: new Date().toISOString(),
      posts: this.scrapedPosts.map(p => ({
        title: p.title,
        url: p.url,
        slug: p.slug,
        category: p.category,
        author: p.author,
        publishDate: p.publishDate,
        excerpt: p.excerpt,
      })),
    };
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    // Save as CSV
    const csvPath = path.join(this.config.outputDir, 'index.csv');
    const csvHeaders = 'Title,URL,Slug,Category,Author,Publish Date\n';
    const csvRows = this.scrapedPosts.map(p =>
      `"${(p.title || '').replace(/"/g, '""')}","${p.url}","${p.slug}","${p.category || ''}","${p.author || ''}","${p.publishDate || ''}"`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeaders + csvRows);

    // Save as markdown index
    const mdIndexPath = path.join(this.config.outputDir, 'README.md');
    const mdIndex = `# Hims Blog Content Archive

**Total Posts:** ${this.scrapedPosts.length}
**Scraped:** ${new Date().toISOString()}

## Posts by Category

${this.generateCategoryIndex()}

## All Posts

| Title | Category | Author | Date |
|-------|----------|--------|------|
${this.scrapedPosts.map(p =>
  `| [${p.title.substring(0, 50)}${p.title.length > 50 ? '...' : ''}](posts/${p.slug}/content.md) | ${p.category || '-'} | ${p.author || '-'} | ${p.publishDate || '-'} |`
).join('\n')}
`;
    fs.writeFileSync(mdIndexPath, mdIndex);

    console.log(`Index saved to ${this.config.outputDir}`);
  }

  private generateCategoryIndex(): string {
    const categories: Record<string, BlogPost[]> = {};

    for (const post of this.scrapedPosts) {
      const cat = post.category || 'Uncategorized';
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(post);
    }

    let md = '';
    for (const [category, posts] of Object.entries(categories).sort()) {
      md += `\n### ${category} (${posts.length})\n\n`;
      for (const post of posts) {
        md += `- [${post.title}](posts/${post.slug}/content.md)\n`;
      }
    }

    return md;
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      await this.scrapeAllPosts();
      await this.saveIndex();
      console.log('\n=== Done! ===');
      console.log(`All content saved to: ${this.config.outputDir}`);
    } catch (error) {
      console.error('Scraper error:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Main execution
async function main() {
  const outputDir = process.argv[2] || './hims-blog-content';

  console.log('==============================================');
  console.log('         Hims Blog Content Scraper            ');
  console.log('==============================================');
  console.log(`Output directory: ${outputDir}`);
  console.log('');

  const scraper = new HimsBlogScraper({
    outputDir,
    headless: true,
    delayBetweenRequests: 2500,
    saveHtml: true,
  });

  await scraper.run();
}

main().catch(console.error);
