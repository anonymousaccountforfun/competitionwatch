import puppeteer, { Browser, Page } from "puppeteer"
import * as cheerio from "cheerio"
import { createHash } from "crypto"

// User agents for rotation
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

export interface SnapshotResult {
  screenshot: Buffer | null
  htmlContent: string
  textContent: string
  metaTags: Record<string, string>
  contentHash: string
  status: "success" | "failed" | "blocked"
  error?: string
}

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })
  }
  return browserInstance
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

export async function captureSnapshot(url: string): Promise<SnapshotResult> {
  let page: Page | null = null

  try {
    const browser = await getBrowser()
    page = await browser.newPage()

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 })

    // Set user agent
    await page.setUserAgent(getRandomUserAgent())

    // Set extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    })

    // Navigate to the URL with timeout
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    })

    if (!response) {
      throw new Error("No response received")
    }

    const status = response.status()
    if (status === 403 || status === 429) {
      return {
        screenshot: null,
        htmlContent: "",
        textContent: "",
        metaTags: {},
        contentHash: "",
        status: "blocked",
        error: `HTTP ${status}`,
      }
    }

    if (status >= 400) {
      return {
        screenshot: null,
        htmlContent: "",
        textContent: "",
        metaTags: {},
        contentHash: "",
        status: "failed",
        error: `HTTP ${status}`,
      }
    }

    // Wait a bit for any lazy-loaded content
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Capture screenshot
    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false, // Just viewport for consistency
    })

    // Get HTML content
    const htmlContent = await page.content()

    // Extract text and meta tags using Cheerio
    const $ = cheerio.load(htmlContent)

    // Remove script and style tags for text extraction
    $("script, style, noscript").remove()

    // Get text content
    const textContent = $("body").text().replace(/\s+/g, " ").trim()

    // Extract meta tags
    const metaTags: Record<string, string> = {}
    $("meta").each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("property")
      const content = $(el).attr("content")
      if (name && content) {
        metaTags[name] = content
      }
    })
    metaTags["title"] = $("title").text()

    // Calculate content hash
    const contentHash = createHash("sha256").update(textContent).digest("hex")

    return {
      screenshot: Buffer.from(screenshot),
      htmlContent,
      textContent,
      metaTags,
      contentHash,
      status: "success",
    }
  } catch (error) {
    console.error("Error capturing snapshot:", error)
    return {
      screenshot: null,
      htmlContent: "",
      textContent: "",
      metaTags: {},
      contentHash: "",
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  } finally {
    if (page) {
      await page.close()
    }
  }
}

export function computeDiff(before: string, after: string): string {
  // Simple line-by-line diff
  const beforeLines = before.split(/\s+/)
  const afterLines = after.split(/\s+/)

  const added: string[] = []
  const removed: string[] = []

  const beforeSet = new Set(beforeLines)
  const afterSet = new Set(afterLines)

  for (const line of afterLines) {
    if (!beforeSet.has(line)) {
      added.push(line)
    }
  }

  for (const line of beforeLines) {
    if (!afterSet.has(line)) {
      removed.push(line)
    }
  }

  let diff = ""
  if (removed.length > 0) {
    diff += `REMOVED:\n${removed.slice(0, 50).join(" ")}\n\n`
  }
  if (added.length > 0) {
    diff += `ADDED:\n${added.slice(0, 50).join(" ")}`
  }

  return diff.trim() || "No significant text changes detected"
}

export function hasSignificantChange(
  beforeHash: string,
  afterHash: string,
  beforeText: string,
  afterText: string
): boolean {
  // Quick check with hash
  if (beforeHash === afterHash) {
    return false
  }

  // Calculate similarity
  const beforeWords = new Set(beforeText.toLowerCase().split(/\s+/))
  const afterWords = new Set(afterText.toLowerCase().split(/\s+/))

  const intersection = new Set([...beforeWords].filter((x) => afterWords.has(x)))
  const union = new Set([...beforeWords, ...afterWords])

  const similarity = intersection.size / union.size

  // If less than 95% similar, consider it a significant change
  return similarity < 0.95
}
