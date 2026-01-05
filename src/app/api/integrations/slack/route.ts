import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendSlackNotification } from "@/lib/email/resend"

// POST /api/integrations/slack - Test Slack webhook
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { webhookUrl } = body

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Webhook URL is required" },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(webhookUrl)
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook URL" },
        { status: 400 }
      )
    }

    // Send test message
    const success = await sendSlackNotification(webhookUrl, {
      title: "CompetitorPulse Test",
      text: "Your Slack integration is working correctly! You'll receive competitive intelligence alerts here.",
      color: "#22c55e",
      fields: [
        {
          title: "Status",
          value: "Connected",
          short: true,
        },
        {
          title: "Time",
          value: new Date().toLocaleString(),
          short: true,
        },
      ],
    })

    if (success) {
      return NextResponse.json({ success: true, message: "Test message sent successfully" })
    } else {
      return NextResponse.json(
        { error: "Failed to send test message. Please check your webhook URL." },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error testing Slack webhook:", error)
    return NextResponse.json(
      { error: "Failed to test Slack webhook" },
      { status: 500 }
    )
  }
}
