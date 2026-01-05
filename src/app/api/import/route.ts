import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

const competitorSchema = z.object({
  name: z.string().min(1),
  primaryUrl: z.string().url(),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
  urls: z.array(z.object({
    url: z.string().url(),
    urlType: z.enum(["landing_page", "pricing", "blog", "careers", "changelog", "rss_feed", "app_store"]),
    checkFrequency: z.enum(["hourly", "twice_daily", "daily", "weekly"]).default("daily"),
  })).optional(),
})

const importSchema = z.object({
  competitors: z.array(competitorSchema),
})

// POST /api/import - Bulk import competitors
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = importSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { competitors } = validation.data
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const comp of competitors) {
      try {
        // Check if competitor already exists (by URL)
        const existing = await prisma.competitor.findFirst({
          where: {
            workspaceId: membership.workspaceId,
            primaryUrl: comp.primaryUrl,
          },
        })

        if (existing) {
          results.skipped++
          continue
        }

        // Create competitor with monitored URLs
        await prisma.competitor.create({
          data: {
            workspaceId: membership.workspaceId,
            name: comp.name,
            primaryUrl: comp.primaryUrl,
            logoUrl: comp.logoUrl,
            description: comp.description,
            monitoredUrls: comp.urls
              ? {
                  create: comp.urls.map((u) => ({
                    url: u.url,
                    urlType: u.urlType,
                    checkFrequency: u.checkFrequency,
                  })),
                }
              : undefined,
          },
        })

        results.created++
      } catch (error) {
        results.errors.push({
          name: comp.name,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("Error importing competitors:", error)
    return NextResponse.json(
      { error: "Failed to import competitors" },
      { status: 500 }
    )
  }
}

// POST /api/import/csv - Parse CSV and import
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split("\n").filter((line) => line.trim())

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      )
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const requiredHeaders = ["name", "url"]
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Missing required headers: ${missingHeaders.join(", ")}` },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; error: string }>,
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || ""
      })

      if (!row.name || !row.url) {
        results.errors.push({ row: i + 1, error: "Missing name or url" })
        continue
      }

      try {
        // Validate URL
        new URL(row.url)

        const existing = await prisma.competitor.findFirst({
          where: {
            workspaceId: membership.workspaceId,
            primaryUrl: row.url,
          },
        })

        if (existing) {
          results.skipped++
          continue
        }

        await prisma.competitor.create({
          data: {
            workspaceId: membership.workspaceId,
            name: row.name,
            primaryUrl: row.url,
            logoUrl: row.logo || row.logourl || undefined,
            description: row.description || undefined,
          },
        })

        results.created++
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("Error importing CSV:", error)
    return NextResponse.json(
      { error: "Failed to import CSV" },
      { status: 500 }
    )
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}
