/**
 * Hims Blog Scraper - Fetch-based version
 *
 * Downloads all blog content from hims.com/blog using HTTP requests with
 * proper headers to mimic browser requests.
 *
 * Usage: node fetch-scraper.js [output-directory]
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  outputDir: './hims-blog-content',
  delayBetweenRequests: 2000,
  maxRetries: 3,
  saveHtml: true,
};

// Browser-like headers
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

class HimsBlogScraper {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scrapedPosts = [];
    this.cookies = '';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url) {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`  Fetching: ${url} (attempt ${attempt}/${this.config.maxRetries})`);

        const headers = { ...HEADERS };
        if (this.cookies) {
          headers['Cookie'] = this.cookies;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
          redirect: 'follow',
        });

        // Store cookies for session
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          this.cookies = setCookie;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        return html;
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

  async discoverBlogUrls() {
    console.log('\n=== Discovering Blog URLs ===\n');

    const allUrls = new Set();

    // First try to get the sitemap
    console.log('Attempting to fetch sitemap...');
    const sitemapUrls = [
      'https://www.hims.com/sitemap.xml',
      'https://www.hims.com/sitemap-0.xml',
      'https://www.hims.com/blog-sitemap.xml',
      'https://www.hims.com/sitemap_index.xml',
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const xml = await this.fetchWithRetry(sitemapUrl);
        if (xml) {
          // Look for nested sitemaps
          const nestedSitemaps = xml.match(/<loc>([^<]+sitemap[^<]*\.xml)<\/loc>/gi);
          if (nestedSitemaps) {
            for (const match of nestedSitemaps) {
              const nestedUrl = match.replace(/<\/?loc>/gi, '');
              console.log(`  Found nested sitemap: ${nestedUrl}`);
              const nestedXml = await this.fetchWithRetry(nestedUrl);
              if (nestedXml) {
                const blogMatches = nestedXml.match(/https:\/\/www\.hims\.com\/blog\/[^<>\s"']+/g);
                if (blogMatches) {
                  blogMatches.forEach(url => allUrls.add(url));
                }
              }
              await this.delay(1000);
            }
          }

          // Look for direct blog URLs
          const blogMatches = xml.match(/https:\/\/www\.hims\.com\/blog\/[^<>\s"']+/g);
          if (blogMatches) {
            blogMatches.forEach(url => allUrls.add(url));
            console.log(`  Found ${blogMatches.length} blog URLs in ${sitemapUrl}`);
          }
        }
      } catch (error) {
        console.log(`  Could not fetch ${sitemapUrl}: ${error.message}`);
      }
      await this.delay(1000);
    }

    // Then try the blog index page
    console.log('\nFetching blog index page...');
    const blogHtml = await this.fetchWithRetry('https://www.hims.com/blog');
    if (blogHtml) {
      const $ = cheerio.load(blogHtml);

      // Find all blog post links
      $('a[href*="/blog/"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
          if (fullUrl.includes('/blog/') && !fullUrl.endsWith('/blog') && !fullUrl.endsWith('/blog/')) {
            allUrls.add(fullUrl);
          }
        }
      });
      console.log(`  Found ${allUrls.size} total URLs after index page`);

      // Look for category pages
      const categoryUrls = new Set();
      $('a[href*="/blog/"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
          try {
            const pathParts = new URL(fullUrl).pathname.split('/').filter(Boolean);
            if (pathParts.length === 2 && pathParts[0] === 'blog') {
              categoryUrls.add(fullUrl);
            }
          } catch {}
        }
      });

      // Explore category pages
      for (const catUrl of categoryUrls) {
        console.log(`  Exploring category: ${catUrl}`);
        await this.delay(this.config.delayBetweenRequests);
        const catHtml = await this.fetchWithRetry(catUrl);
        if (catHtml) {
          const $cat = cheerio.load(catHtml);
          $cat('a[href*="/blog/"]').each((_, element) => {
            const href = $cat(element).attr('href');
            if (href) {
              const fullUrl = href.startsWith('http') ? href : `https://www.hims.com${href}`;
              if (fullUrl.includes('/blog/') && !fullUrl.endsWith('/blog') && !fullUrl.endsWith('/blog/')) {
                allUrls.add(fullUrl);
              }
            }
          });
        }
      }
    }

    // Filter and clean URLs
    const cleanedUrls = [...allUrls].filter(url => {
      try {
        const u = new URL(url);
        const pathParts = u.pathname.split('/').filter(Boolean);
        // Filter out category pages (only 2 segments) and keep actual posts (3+ segments)
        return pathParts.length >= 2 && pathParts[0] === 'blog';
      } catch {
        return false;
      }
    });

    console.log(`\nTotal unique blog URLs discovered: ${cleanedUrls.length}`);

    // Save discovered URLs
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(this.config.outputDir, 'discovered-urls.json'),
      JSON.stringify(cleanedUrls, null, 2)
    );

    return cleanedUrls;
  }

  async scrapeBlogPost(url) {
    console.log(`\nScraping: ${url}`);

    const html = await this.fetchWithRetry(url);
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
    const author = $('[class*="author"]').text().replace(/\s+/g, ' ').trim() ||
                   $('meta[name="author"]').attr('content') ||
                   '';

    // Extract publish date
    const publishDate = $('time').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') ||
                        '';

    // Extract category
    let category = $('meta[property="article:section"]').attr('content') || '';
    if (!category && urlParts.length > 2) {
      category = urlParts[1];
    }

    // Extract main content
    let contentElement = $('article').first();
    if (!contentElement.length) {
      contentElement = $('[class*="article"]').first();
    }
    if (!contentElement.length) {
      contentElement = $('[class*="content"]').first();
    }
    if (!contentElement.length) {
      contentElement = $('main').first();
    }
    if (!contentElement.length) {
      contentElement = $('body');
    }

    // Clone and clean
    const cleanContent = contentElement.clone();
    cleanContent.find('script, style, nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"], [class*="sidebar"], [class*="related"], [class*="comment"], [class*="share"], [class*="social"], [class*="newsletter"], [class*="cta"], [class*="promo"]').remove();

    const contentHtml = cleanContent.html() || '';
    const contentText = cleanContent.text().replace(/\s+/g, ' ').trim();

    // Extract excerpt
    const excerpt = $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') ||
                    contentText.substring(0, 300) + (contentText.length > 300 ? '...' : '');

    // Extract images
    const images = [];
    contentElement.find('img').each((_, img) => {
      let src = $(img).attr('src') || $(img).attr('data-src');
      if (src && !images.includes(src)) {
        if (!src.startsWith('http')) {
          src = `https://www.hims.com${src}`;
        }
        images.push(src);
      }
    });

    // Add OG image
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

    return post;
  }

  async savePost(post) {
    const postDir = path.join(this.config.outputDir, 'posts', post.slug);

    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    // Save as JSON
    fs.writeFileSync(path.join(postDir, 'post.json'), JSON.stringify(post, null, 2));

    // Save as markdown
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
    fs.writeFileSync(path.join(postDir, 'content.md'), mdContent);

    // Save HTML
    if (this.config.saveHtml && post.html) {
      fs.writeFileSync(path.join(postDir, 'content.html'), post.html);
    }
  }

  async saveIndex() {
    console.log('\nSaving index files...');

    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Save JSON index
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
    fs.writeFileSync(path.join(this.config.outputDir, 'index.json'), JSON.stringify(index, null, 2));

    // Save CSV
    const csvHeaders = 'Title,URL,Slug,Category,Author,Publish Date\n';
    const csvRows = this.scrapedPosts.map(p =>
      `"${(p.title || '').replace(/"/g, '""')}","${p.url}","${p.slug}","${p.category || ''}","${p.author || ''}","${p.publishDate || ''}"`
    ).join('\n');
    fs.writeFileSync(path.join(this.config.outputDir, 'index.csv'), csvHeaders + csvRows);

    // Save markdown index
    const categories = {};
    for (const post of this.scrapedPosts) {
      const cat = post.category || 'Uncategorized';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(post);
    }

    let categoryMd = '';
    for (const [cat, posts] of Object.entries(categories).sort()) {
      categoryMd += `\n### ${cat} (${posts.length})\n\n`;
      for (const post of posts) {
        categoryMd += `- [${post.title}](posts/${post.slug}/content.md)\n`;
      }
    }

    const mdIndex = `# Hims Blog Content Archive

**Total Posts:** ${this.scrapedPosts.length}
**Scraped:** ${new Date().toISOString()}

## Posts by Category
${categoryMd}

## All Posts

| Title | Category | Author | Date |
|-------|----------|--------|------|
${this.scrapedPosts.map(p =>
  `| [${(p.title || '').substring(0, 50)}${(p.title || '').length > 50 ? '...' : ''}](posts/${p.slug}/content.md) | ${p.category || '-'} | ${p.author || '-'} | ${p.publishDate || '-'} |`
).join('\n')}
`;
    fs.writeFileSync(path.join(this.config.outputDir, 'INDEX.md'), mdIndex);

    console.log(`Index saved to ${this.config.outputDir}`);
  }

  async run() {
    try {
      console.log('==============================================');
      console.log('    Hims Blog Content Scraper (Fetch-based)   ');
      console.log('==============================================');
      console.log(`Output directory: ${path.resolve(this.config.outputDir)}`);
      console.log('');

      const urls = await this.discoverBlogUrls();

      if (urls.length === 0) {
        console.log('No blog URLs discovered');
        return;
      }

      console.log(`\n=== Scraping ${urls.length} Blog Posts ===\n`);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n[${i + 1}/${urls.length}] (${Math.round((i + 1) / urls.length * 100)}%)`);

        try {
          const post = await this.scrapeBlogPost(url);
          if (post && post.content.length > 100) {
            this.scrapedPosts.push(post);
            await this.savePost(post);
            successCount++;
          } else {
            console.log('  Skipped: insufficient content');
            failCount++;
          }
        } catch (error) {
          console.error(`  Error: ${error.message}`);
          failCount++;
        }

        // Delay between requests
        if (i < urls.length - 1) {
          await this.delay(this.config.delayBetweenRequests);
        }

        // Save progress periodically
        if ((i + 1) % 10 === 0) {
          await this.saveIndex();
          console.log(`\n  Progress saved (${this.scrapedPosts.length} posts so far)`);
        }
      }

      await this.saveIndex();

      console.log(`\n=== Scraping Complete ===`);
      console.log(`Successful: ${successCount}`);
      console.log(`Failed: ${failCount}`);
      console.log(`\nAll content saved to: ${path.resolve(this.config.outputDir)}`);

    } catch (error) {
      console.error('Scraper error:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const outputDir = process.argv[2] || './hims-blog-content';

  const scraper = new HimsBlogScraper({
    outputDir,
    delayBetweenRequests: 2000,
    saveHtml: true,
  });

  await scraper.run();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
