const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const OUTPUT_DIR = './forhers-content';
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'progress.json');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(OUTPUT_DIR, 'posts'))) {
  fs.mkdirSync(path.join(OUTPUT_DIR, 'posts'), { recursive: true });
}

// Load progress
let scrapedUrls = [];
if (fs.existsSync(PROGRESS_FILE)) {
  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  scrapedUrls = progress.scrapedUrls || [];
  console.log(`Resuming - already scraped ${scrapedUrls.length} URLs`);
}

function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ scrapedUrls }, null, 2));
}

function getSlug(url) {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  return pathParts[pathParts.length - 1] || 'index';
}

function isArticleUrl(url) {
  // Filter to blog articles - typically /blog/some-article-slug
  const parsed = new URL(url);
  const pathname = parsed.pathname;

  // Must be on forhers.com
  if (!parsed.hostname.includes('forhers.com')) return false;

  // Blog articles
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.replace('/blog/', '').replace(/\/$/, '');
    // Skip category pages (usually short like "hair", "skin", etc.)
    if (slug.length < 10 || !slug.includes('-')) return false;
    return true;
  }

  return false;
}

async function getAllUrlsFromSitemap(page) {
  console.log('Fetching sitemap...');

  let allUrls = [];

  // Try main sitemap
  await page.goto('https://www.forhers.com/sitemap.xml', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Extract URLs from sitemap using DOM parsing
  const sitemapUrls = await page.evaluate(() => {
    const locs = document.querySelectorAll('loc');
    return Array.from(locs).map(loc => loc.textContent.trim());
  });

  console.log(`Found ${sitemapUrls.length} URLs in main sitemap`);

  // Check for nested sitemaps
  const nestedSitemaps = sitemapUrls.filter(url => url.includes('sitemap') && url.endsWith('.xml'));
  const directUrls = sitemapUrls.filter(url => !url.includes('sitemap') || !url.endsWith('.xml'));

  allUrls = [...directUrls];

  // Process nested sitemaps
  for (const sitemapUrl of nestedSitemaps) {
    console.log(`Fetching nested sitemap: ${sitemapUrl}`);
    try {
      await page.goto(sitemapUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      const nestedUrls = await page.evaluate(() => {
        const locs = document.querySelectorAll('loc');
        return Array.from(locs).map(loc => loc.textContent.trim());
      });

      console.log(`  Found ${nestedUrls.length} URLs`);
      allUrls = [...allUrls, ...nestedUrls];
    } catch (err) {
      console.log(`  Error fetching sitemap: ${err.message}`);
    }
  }

  return allUrls;
}

async function scrapePage(page, url) {
  console.log(`\nScraping: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for React/JS to render
    await new Promise(r => setTimeout(r, 4000));

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 1000));

    // Extract content from rendered DOM
    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText || document.title || '';

      // Try multiple content selectors
      let contentEl = document.querySelector('article') ||
                      document.querySelector('[class*="content"]') ||
                      document.querySelector('[class*="blog"]') ||
                      document.querySelector('main');

      const paragraphs = contentEl
        ? Array.from(contentEl.querySelectorAll('p'))
        : Array.from(document.querySelectorAll('p'));

      const content = paragraphs
        .map(p => p.innerText.trim())
        .filter(t => t.length > 30)
        .join('\n\n');

      // Get meta info
      const author = document.querySelector('[class*="author"]')?.innerText ||
                     document.querySelector('meta[name="author"]')?.content || '';
      const dateEl = document.querySelector('time') || document.querySelector('[class*="date"]');
      const date = dateEl?.getAttribute('datetime') || dateEl?.innerText || '';

      return { title, content, author, date };
    });

    return data;
  } catch (err) {
    console.log(`  Error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('Starting ForHers Blog Scraper...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Get all URLs from sitemap
  const allUrls = await getAllUrlsFromSitemap(page);

  // Filter to article URLs only
  const articleUrls = allUrls.filter(isArticleUrl);
  console.log(`\nFound ${articleUrls.length} blog article URLs`);

  // Filter out already scraped
  const urlsToScrape = articleUrls.filter(url => !scrapedUrls.includes(url));
  console.log(`${urlsToScrape.length} URLs remaining to scrape\n`);

  let successCount = 0;

  for (let i = 0; i < urlsToScrape.length; i++) {
    const url = urlsToScrape[i];
    console.log(`\n[${i + 1}/${urlsToScrape.length}] Processing...`);

    const data = await scrapePage(page, url);

    if (data && data.content && data.content.length > 100) {
      const slug = getSlug(url);
      const postDir = path.join(OUTPUT_DIR, 'posts', slug);

      if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
      }

      // Save content
      fs.writeFileSync(path.join(postDir, 'content.md'), `# ${data.title}\n\n${data.content}`);
      fs.writeFileSync(path.join(postDir, 'post.json'), JSON.stringify({
        url,
        title: data.title,
        author: data.author,
        date: data.date,
        contentLength: data.content.length,
        scrapedAt: new Date().toISOString()
      }, null, 2));

      successCount++;
      console.log(`  ✓ Saved: ${slug} (${data.content.length} chars)`);
    } else {
      console.log(`  ✗ No content found or too short`);
    }

    // Mark as scraped
    scrapedUrls.push(url);
    saveProgress();

    console.log(`  Progress: ${successCount} posts saved, ${scrapedUrls.length} total processed`);

    // Small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Scraping complete!`);
  console.log(`Total posts saved: ${successCount}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`${'='.repeat(50)}\n`);

  await browser.close();
}

main().catch(console.error);
