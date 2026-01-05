import Parser from "rss-parser"

const parser = new Parser({
  timeout: 30000,
  headers: {
    "User-Agent": "CompetitorPulse/1.0 (RSS Reader)",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
})

export interface RSSItem {
  title: string
  link: string
  content: string
  publishedAt: Date | null
  guid: string
}

export async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const feed = await parser.parseURL(url)

    return feed.items.map((item) => ({
      title: item.title || "Untitled",
      link: item.link || "",
      content: item.contentSnippet || item.content || item.summary || "",
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      guid: item.guid || item.link || item.title || "",
    }))
  } catch (error) {
    console.error("Error fetching RSS feed:", error)
    throw error
  }
}

// App Store specific parsers
export interface AppStoreInfo {
  version: string
  releaseNotes: string
  releaseDate: Date | null
  appName: string
}

export async function fetchiOSAppInfo(appId: string): Promise<AppStoreInfo | null> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=us`
    )
    const data = await response.json()

    if (data.resultCount === 0) {
      return null
    }

    const app = data.results[0]
    return {
      version: app.version,
      releaseNotes: app.releaseNotes || "",
      releaseDate: app.currentVersionReleaseDate
        ? new Date(app.currentVersionReleaseDate)
        : null,
      appName: app.trackName,
    }
  } catch (error) {
    console.error("Error fetching iOS app info:", error)
    return null
  }
}

export function extractAppStoreId(url: string): string | null {
  // iOS App Store URL patterns:
  // https://apps.apple.com/us/app/app-name/id123456789
  // https://itunes.apple.com/us/app/app-name/id123456789
  const match = url.match(/\/id(\d+)/)
  return match ? match[1] : null
}

export function extractPlayStoreId(url: string): string | null {
  // Google Play Store URL pattern:
  // https://play.google.com/store/apps/details?id=com.example.app
  const match = url.match(/[?&]id=([^&]+)/)
  return match ? match[1] : null
}
