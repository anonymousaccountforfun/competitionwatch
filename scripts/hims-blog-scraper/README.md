# Hims Blog Scraper

Downloads all blog content from hims.com/blog using Puppeteer with stealth mode to bypass bot protection.

## Quick Start (on your desktop)

```bash
cd scripts/hims-blog-scraper
npm install
npm run scrape
```

## Output

Content is saved to `./hims-blog-content/` with the following structure:

```
hims-blog-content/
├── index.json          # Master index of all posts
├── index.csv           # CSV export
├── INDEX.md            # Markdown index with categories
├── discovered-urls.json # All discovered URLs
└── posts/
    └── [post-slug]/
        ├── post.json    # Full post metadata
        ├── content.md   # Markdown content
        └── content.html # Raw HTML content
```

## Options

Run with visible browser (useful for debugging):
```bash
npm run scrape:headed
```

Custom output directory:
```bash
node scraper.js /path/to/output
```

## How It Works

1. Uses Puppeteer with stealth plugin to bypass Cloudflare/bot protection
2. Discovers all blog URLs from the main blog page, category pages, and sitemaps
3. Scrapes each post extracting title, author, date, content, and images
4. Saves content in multiple formats (JSON, Markdown, HTML, CSV)

## Requirements

- Node.js 18+
- ~500MB disk space for Chrome download
- Stable internet connection
