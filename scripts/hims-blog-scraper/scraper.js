/**
 * Hims Blog Scraper
 *
 * Downloads all blog content from hims.com/blog using Puppeteer with stealth
 * to bypass bot protection.
 *
 * Usage: node scraper.js [output-directory]
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Apply stealth plugin
puppeteer.use(StealthPlugin());

const DEFAULT_CONFIG = {
  outputDir: './hims-blog-content',
  headless: true,
  delayBetweenRequests: 2500,
  maxRetries: 3,
  saveHtml: true,
  saveImages: false,
};

class HimsBlogScraper {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.browser = null;
    this.page = null;
    this.discoveredUrls = new Set();
    this.scrapedPosts = [];
  }

  async initialize() {
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

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async navigateWithRetry(url) {
    if (!this.page) throw new Error('Browser not initialized');

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`  Navigating to: ${url} (attempt ${attempt}/${this.config.maxRetries})`);

        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        // Wait longer for React/Next.js content to hydrate
        await this.delay(3000);

        // Try to wait for article content specifically
        try {
          await this.page.waitForSelector('article, [class*="article"], [class*="Article"], [class*="post"], [class*="Post"]', { timeout: 5000 });
        } catch {
          // Content selector not found, continue anyway
        }

        const content = await this.page.content();
        return content;
      } catch (error) {
        console.error(`  Error on attempt ${attempt}: ${error.message}`);
        if (attempt < this.config.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`  Waiting ${waitTime}ms before retry...`);
          await this.delay(waitTime);
        }
      }
    }
    return null;
  }

  // Check if URL is an actual article (not a category page)
  isArticleUrl(url) {
    try {
      const u = new URL(url);
      const pathParts = u.pathname.split('/').filter(Boolean);

      // Category pages have exactly 2 segments: /blog/category-name
      // Article pages have 3+ segments: /blog/category/article-slug
      // OR articles directly under /blog/ with descriptive slugs

      if (pathParts.length < 2 || pathParts[0] !== 'blog') return false;
      if (pathParts.length === 2) {
        // Check if it's a known category (short single words)
        const knownCategories = [
          'hair', 'skin', 'sex', 'sexual-health', 'weight', 'mental-health',
          'testosterone', 'labs', 'conditions', 'tag', 'all', 'category'
        ];
        const slug = pathParts[1].toLowerCase();
        if (knownCategories.includes(slug) || slug.length < 5) {
          return false; // Likely a category page
        }
        // Longer slugs with hyphens are likely articles
        return slug.includes('-') && slug.length > 10;
      }
      return true; // 3+ segments = likely an article
    } catch {
      return false;
    }
  }

  async scrollAndLoadMore(maxScrolls = 50) {
    console.log('  Scrolling to load more content...');
    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) {
        // Try clicking "Load More" button if it exists
        try {
          const loadMoreButton = await this.page.$('[class*="load-more"], [class*="LoadMore"], button:contains("Load More"), button:contains("Show More")');
          if (loadMoreButton) {
            await loadMoreButton.click();
            await this.delay(2000);
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      previousHeight = currentHeight;
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.delay(1500);
      scrollCount++;
    }

    console.log(`  Completed ${scrollCount} scroll iterations`);
  }

  async discoverBlogUrls() {
    console.log('\n=== Discovering Blog URLs ===\n');

    const blogIndexUrl = 'https://www.hims.com/blog';
    const html = await this.navigateWithRetry(blogIndexUrl);

    if (!html) {
      console.error('Failed to load blog index page');
      return [];
    }

    // Scroll to load more content on the main page
    await this.scrollAndLoadMore();

    // Get updated content after scrolling
    const updatedHtml = await this.page.content();
    const $ = cheerio.load(updatedHtml);

    // Find all blog post links
    const blogUrls = [];

    // Look for article links with various selectors
    $('a[href*="/blog/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !href.endsWith('/blog') && !href.endsWith('/blog/')) {
        const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
        // Filter to only include actual blog posts (usually have more path segments)
        const pathParts = new URL(fullUrl).pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2 && !blogUrls.includes(fullUrl) && fullUrl.includes('/blog/')) {
          blogUrls.push(fullUrl);
        }
      }
    });

    console.log(`Found ${blogUrls.length} blog post URLs on main page`);

    // Find category/topic pages
    const categoryLinks = new Set();
    $('a[href*="/blog/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
        try {
          const pathParts = new URL(fullUrl).pathname.split('/').filter(Boolean);
          // Category pages typically have exactly 2 segments: /blog/category-name
          if (pathParts.length === 2 && pathParts[0] === 'blog') {
            categoryLinks.add(fullUrl);
          }
        } catch {}
      }
    });

    console.log(`Found ${categoryLinks.size} category pages to explore`);

    // Explore category pages for more posts
    for (const categoryUrl of categoryLinks) {
      console.log(`\nExploring category: ${categoryUrl}`);
      await this.delay(this.config.delayBetweenRequests);

      const categoryHtml = await this.navigateWithRetry(categoryUrl);
      if (categoryHtml) {
        await this.scrollAndLoadMore(20);
        const updatedCatHtml = await this.page.content();
        const $cat = cheerio.load(updatedCatHtml);

        $cat('a[href*="/blog/"]').each((_, element) => {
          const href = $cat(element).attr('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
            try {
              const pathParts = new URL(fullUrl).pathname.split('/').filter(Boolean);
              // Blog posts typically have more path segments than categories
              if (pathParts.length > 2 && !blogUrls.includes(fullUrl)) {
                blogUrls.push(fullUrl);
              }
            } catch {}
          }
        });
      }
    }

    // Try sitemap discovery
    await this.discoverFromSitemap(blogUrls);

    // Deduplicate and filter to only actual articles (not category pages)
    const uniqueUrls = [...new Set(blogUrls)].filter(url => this.isArticleUrl(url));

    console.log(`\nTotal unique blog URLs discovered: ${uniqueUrls.length}`);

    // Save discovered URLs for reference
    const urlsPath = path.join(this.config.outputDir, 'discovered-urls.json');
    fs.writeFileSync(urlsPath, JSON.stringify(uniqueUrls, null, 2));

    return uniqueUrls;
  }

  async discoverFromSitemap(existingUrls) {
    console.log('\nChecking sitemap for additional URLs...');

    const sitemapUrls = [
      'https://www.hims.com/sitemap.xml',
      'https://www.hims.com/sitemap-0.xml',
      'https://www.hims.com/blog-sitemap.xml',
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const html = await this.navigateWithRetry(sitemapUrl);
        if (html) {
          // Parse sitemap XML for blog URLs
          const urlMatches = html.match(/https:\/\/www\.hims\.com\/blog\/[^<>\s"']+/g);
          if (urlMatches) {
            let newCount = 0;
            for (const url of urlMatches) {
              if (!existingUrls.includes(url)) {
                existingUrls.push(url);
                newCount++;
              }
            }
            console.log(`Found ${newCount} new URLs in ${sitemapUrl}`);
          }
        }
      } catch (error) {
        // Sitemap might not exist
      }
      await this.delay(1000);
    }
  }

  async scrapeBlogPost(url) {
    console.log(`\nScraping: ${url}`);

    const html = await this.navigateWithRetry(url);
    if (!html) {
      console.error(`  Failed to fetch: ${url}`);
      return null;
    }

    const $ = cheerio.load(html);

    // Extract slug from URL
    const urlPath = new URL(url).pathname;
    const urlParts = urlPath.split('/').filter(Boolean);
    const slug = urlParts[urlParts.length - 1];

    // Extract title
    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text().trim() ||
                  slug;

    // Extract author
    const author = $('[class*="author"]').text().trim() ||
                   $('meta[name="author"]').attr('content') ||
                   $('[rel="author"]').text().trim() ||
                   '';

    // Extract publish date
    const publishDate = $('time').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') ||
                        $('[class*="date"]').first().text().trim() ||
                        '';

    // Extract category from URL or meta
    let category = $('meta[property="article:section"]').attr('content') || '';
    if (!category && urlParts.length > 2) {
      category = urlParts[1]; // Usually /blog/category/post-slug
    }

    // Extract main content - try multiple selectors for Hims blog
    let contentElement = null;
    const contentSelectors = [
      'article',
      '[class*="ArticleContent"]',
      '[class*="article-content"]',
      '[class*="BlogPost"]',
      '[class*="blog-post"]',
      '[class*="PostContent"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      '[class*="article"]',
      '[class*="content"]',
      'main',
      '#__next main',
      '#main-content',
    ];

    for (const selector of contentSelectors) {
      const el = $(selector).first();
      if (el.length && el.text().trim().length > 200) {
        contentElement = el;
        break;
      }
    }

    if (!contentElement || !contentElement.length) {
      contentElement = $('body');
    }

    // Clone to avoid modifying original
    const cleanContent = contentElement.clone();

    // Remove unwanted elements more aggressively
    cleanContent.find([
      'script', 'style', 'nav', 'header', 'footer', 'noscript', 'iframe',
      '[class*="nav"]', '[class*="Nav"]',
      '[class*="header"]', '[class*="Header"]',
      '[class*="footer"]', '[class*="Footer"]',
      '[class*="sidebar"]', '[class*="Sidebar"]',
      '[class*="related"]', '[class*="Related"]',
      '[class*="comment"]', '[class*="Comment"]',
      '[class*="share"]', '[class*="Share"]',
      '[class*="social"]', '[class*="Social"]',
      '[class*="newsletter"]', '[class*="Newsletter"]',
      '[class*="cta"]', '[class*="CTA"]',
      '[class*="promo"]', '[class*="Promo"]',
      '[class*="modal"]', '[class*="Modal"]',
      '[class*="popup"]', '[class*="Popup"]',
      '[class*="cookie"]', '[class*="Cookie"]',
      '[class*="banner"]', '[class*="Banner"]',
      '[role="navigation"]',
      '[aria-hidden="true"]',
    ].join(', ')).remove();

    const contentHtml = cleanContent.html() || '';
    const contentText = cleanContent.text().replace(/\s+/g, ' ').trim();

    // Extract excerpt
    const excerpt = $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') ||
                    contentText.substring(0, 300) + (contentText.length > 300 ? '...' : '');

    // Extract images
    const images = [];
    contentElement.find('img').each((_, img) => {
      let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
      if (src && !images.includes(src)) {
        if (!src.startsWith('http')) {
          src = `https://www.hims.com${src}`;
        }
        images.push(src);
      }
    });

    // Featured image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && !images.includes(ogImage)) {
      images.unshift(ogImage);
    }

    const post = {
      url,
      title,
      slug,
      category,
      author: author.replace(/\s+/g, ' ').trim(),
      publishDate,
      content: contentText,
      html: this.config.saveHtml ? contentHtml : undefined,
      excerpt,
      images,
      fetchedAt: new Date().toISOString(),
    };

    console.log(`  Title: ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);
    console.log(`  Content length: ${contentText.length} chars`);
    console.log(`  Images: ${images.length}`);

    return post;
  }

  async scrapeAllPosts() {
    const urls = await this.discoverBlogUrls();

    if (urls.length === 0) {
      console.log('No blog URLs discovered');
      return [];
    }

    console.log(`\n=== Scraping ${urls.length} Blog Posts ===\n`);

    const posts = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n[${i + 1}/${urls.length}] (${Math.round((i + 1) / urls.length * 100)}%)`);

      try {
        const post = await this.scrapeBlogPost(url);
        if (post && post.content.length > 100) {
          posts.push(post);
          successCount++;

          // Save individual post
          await this.savePost(post);
        } else {
          console.log('  Skipped: insufficient content');
          failCount++;
        }
      } catch (error) {
        console.error(`  Error scraping ${url}: ${error.message}`);
        failCount++;
      }

      // Delay between requests
      if (i < urls.length - 1) {
        await this.delay(this.config.delayBetweenRequests);
      }

      // Save progress periodically
      if ((i + 1) % 10 === 0) {
        this.scrapedPosts = posts;
        await this.saveIndex();
        console.log(`\n  Progress saved (${posts.length} posts so far)`);
      }
    }

    console.log(`\n=== Scraping Complete ===`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    this.scrapedPosts = posts;
    return posts;
  }

  async savePost(post) {
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
**Category:** ${post.category || 'Uncategorized'}

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

  async saveIndex() {
    console.log('\nSaving index files...');

    // Ensure output dir exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

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
    const mdIndexPath = path.join(this.config.outputDir, 'INDEX.md');
    const mdIndex = `# Hims Blog Content Archive

**Total Posts:** ${this.scrapedPosts.length}
**Scraped:** ${new Date().toISOString()}

## Posts by Category

${this.generateCategoryIndex()}

## All Posts

| Title | Category | Author | Date |
|-------|----------|--------|------|
${this.scrapedPosts.map(p =>
  `| [${(p.title || '').substring(0, 50)}${(p.title || '').length > 50 ? '...' : ''}](posts/${p.slug}/content.md) | ${p.category || '-'} | ${p.author || '-'} | ${p.publishDate || '-'} |`
).join('\n')}
`;
    fs.writeFileSync(mdIndexPath, mdIndex);

    console.log(`Index saved to ${this.config.outputDir}`);
  }

  generateCategoryIndex() {
    const categories = {};

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

  async run() {
    try {
      await this.initialize();
      await this.scrapeAllPosts();
      await this.saveIndex();
      console.log('\n=== Done! ===');
      console.log(`All content saved to: ${path.resolve(this.config.outputDir)}`);
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
  console.log(`Output directory: ${path.resolve(outputDir)}`);
  console.log('');

  const scraper = new HimsBlogScraper({
    outputDir,
    headless: true,
    delayBetweenRequests: 2500,
    saveHtml: true,
  });

  await scraper.run();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
