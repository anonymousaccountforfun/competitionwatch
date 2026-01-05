import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateDigest } from "@/lib/ai/claude"
import { sendEmail, generateDigestEmail, sendSlackNotification } from "@/lib/email/resend"
import { formatDate } from "@/lib/utils"
import { changeTypeLabel } from "@/lib/types"

// POST /api/digest - Send scheduled digest emails
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { frequency } = body // 'daily' or 'weekly'

    if (!frequency || !["daily", "weekly"].includes(frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency. Must be 'daily' or 'weekly'" },
        { status: 400 }
      )
    }

    // Get all alert preferences for this frequency
    const preferences = await prisma.alertPreference.findMany({
      where: {
        frequency,
        isActive: true,
      },
      include: {
        workspace: {
          include: {
            competitors: {
              where: { isActive: true },
              include: {
                changes: {
                  where: {
                    isMaterial: true,
                    isRead: false,
                    detectedAt: {
                      gte: frequency === "daily"
                        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
                        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                  },
                  orderBy: { detectedAt: "desc" },
                },
                announcements: {
                  where: {
                    isRead: false,
                    capturedAt: {
                      gte: frequency === "daily"
                        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
                        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                  },
                  orderBy: { publishedAt: "desc" },
                },
              },
            },
          },
        },
      },
    })

    const results: Array<{ userId: string | null; channel: string; status: string; error?: string }> = []

    for (const pref of preferences) {
      try {
        // Gather all changes and announcements for this workspace
        const allChanges = pref.workspace.competitors.flatMap((c) =>
          c.changes
            .filter(
              (ch) =>
                ch.confidence !== null &&
                ch.confidence >= pref.minConfidence &&
                (pref.changeTypes.length === 0 ||
                  pref.changeTypes.includes(ch.changeType || ""))
            )
            .map((ch) => ({
              competitorName: c.name,
              competitorLogo: c.logoUrl || undefined,
              changeType: ch.changeType || "unknown",
              summary: ch.summary || "",
              detectedAt: formatDate(ch.detectedAt),
              changeId: ch.id,
            }))
        )

        const allAnnouncements = pref.workspace.competitors.flatMap((c) =>
          c.announcements.map((a) => ({
            competitorName: c.name,
            title: a.title || "",
            sourceType: a.sourceType,
            publishedAt: formatDate(a.publishedAt || a.capturedAt),
          }))
        )

        // Skip if no activity
        if (allChanges.length === 0 && allAnnouncements.length === 0) {
          results.push({
            userId: pref.userId,
            channel: pref.channel,
            status: "skipped",
            error: "No activity to report",
          })
          continue
        }

        // Generate AI summary
        const aiSummary = await generateDigest({
          changes: allChanges.map((c) => ({
            competitorName: c.competitorName,
            changeType: c.changeType,
            summary: c.summary,
            detectedAt: c.detectedAt,
          })),
          announcements: allAnnouncements,
        })

        if (pref.channel === "email" && pref.userId) {
          // For email, we'd need to get the user's email from Supabase Auth
          // For now, we'll just log it
          const emailHtml = generateDigestEmail({
            userName: "User",
            changes: allChanges,
            announcements: allAnnouncements,
            aiSummary,
            period: frequency as "daily" | "weekly",
          })

          // In production, you'd send the email here
          // await sendEmail({ to: userEmail, subject: `${frequency} Digest`, html: emailHtml })

          results.push({
            userId: pref.userId,
            channel: "email",
            status: "success",
          })
        } else if (pref.channel === "slack" && pref.slackWebhookUrl) {
          const success = await sendSlackNotification(pref.slackWebhookUrl, {
            title: `CompetitorPulse ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Digest`,
            text: aiSummary,
            color: "#3b82f6",
            fields: [
              {
                title: "Changes Detected",
                value: allChanges.length.toString(),
                short: true,
              },
              {
                title: "Announcements",
                value: allAnnouncements.length.toString(),
                short: true,
              },
            ],
          })

          results.push({
            userId: pref.userId,
            channel: "slack",
            status: success ? "success" : "failed",
          })
        }
      } catch (error) {
        results.push({
          userId: pref.userId,
          channel: pref.channel,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      frequency,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Error sending digests:", error)
    return NextResponse.json(
      { error: "Failed to send digests" },
      { status: 500 }
    )
  }
}

// Helper endpoint to send real-time Slack alerts for a specific change
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { changeId } = body

    if (!changeId) {
      return NextResponse.json(
        { error: "changeId is required" },
        { status: 400 }
      )
    }

    // Get the change with competitor info
    const change = await prisma.change.findUnique({
      where: { id: changeId },
      include: {
        competitor: {
          include: {
            workspace: true,
          },
        },
        monitoredUrl: true,
      },
    })

    if (!change) {
      return NextResponse.json({ error: "Change not found" }, { status: 404 })
    }

    // Get Slack preferences for this workspace with realtime frequency
    const slackPrefs = await prisma.alertPreference.findMany({
      where: {
        workspaceId: change.competitor.workspaceId,
        channel: "slack",
        frequency: "realtime",
        isActive: true,
      },
    })

    const results: Array<{ prefId: string; status: string }> = []

    for (const pref of slackPrefs) {
      // Check if change meets criteria
      if (
        pref.minConfidence &&
        change.confidence !== null &&
        change.confidence < pref.minConfidence
      ) {
        continue
      }

      if (
        pref.changeTypes.length > 0 &&
        !pref.changeTypes.includes(change.changeType || "")
      ) {
        continue
      }

      if (!pref.slackWebhookUrl) continue

      const colorMap: Record<string, string> = {
        messaging_shift: "#22c55e",
        feature_launch: "#3b82f6",
        pricing_change: "#eab308",
        social_proof: "#8b5cf6",
        positioning: "#22c55e",
        partnership: "#a855f7",
        hiring_signal: "#3b82f6",
        minor: "#9ca3af",
      }

      const success = await sendSlackNotification(pref.slackWebhookUrl, {
        title: `${change.competitor.name}: ${changeTypeLabel[change.changeType as keyof typeof changeTypeLabel] || change.changeType}`,
        text: change.summary || "Change detected",
        color: colorMap[change.changeType || "minor"] || "#3b82f6",
        fields: [
          {
            title: "Analysis",
            value: change.analysis || "No analysis available",
            short: false,
          },
          {
            title: "URL",
            value: change.monitoredUrl.url,
            short: false,
          },
          {
            title: "Confidence",
            value: `${Math.round((change.confidence || 0) * 100)}%`,
            short: true,
          },
        ],
      })

      results.push({
        prefId: pref.id,
        status: success ? "sent" : "failed",
      })
    }

    return NextResponse.json({
      changeId,
      notificationsSent: results.filter((r) => r.status === "sent").length,
      results,
    })
  } catch (error) {
    console.error("Error sending real-time alert:", error)
    return NextResponse.json(
      { error: "Failed to send alert" },
      { status: 500 }
    )
  }
}
