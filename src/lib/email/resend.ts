import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: "CompetitorPulse <notifications@competitorpulse.com>",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    if (error) {
      console.error("Error sending email:", error)
      return false
    }

    console.log("Email sent successfully:", data?.id)
    return true
  } catch (error) {
    console.error("Error sending email:", error)
    return false
  }
}

export interface DigestEmailData {
  userName: string
  changes: Array<{
    competitorName: string
    competitorLogo?: string
    changeType: string
    summary: string
    detectedAt: string
    changeId: string
  }>
  announcements: Array<{
    competitorName: string
    title: string
    sourceType: string
    publishedAt: string
  }>
  aiSummary?: string
  period: "daily" | "weekly"
}

export function generateDigestEmail(data: DigestEmailData): string {
  const changeTypeColors: Record<string, string> = {
    messaging_shift: "#22c55e",
    feature_launch: "#3b82f6",
    pricing_change: "#eab308",
    social_proof: "#8b5cf6",
    positioning: "#22c55e",
    partnership: "#a855f7",
    hiring_signal: "#3b82f6",
    minor: "#9ca3af",
  }

  const changesHtml = data.changes
    .map(
      (change) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${change.competitorName}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <span style="background-color: ${changeTypeColors[change.changeType] || "#9ca3af"}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
          ${change.changeType.replace("_", " ")}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${change.summary}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${change.detectedAt}
      </td>
    </tr>
  `
    )
    .join("")

  const announcementsHtml = data.announcements
    .map(
      (ann) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${ann.competitorName}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${ann.title}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${ann.sourceType}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${ann.publishedAt}
      </td>
    </tr>
  `
    )
    .join("")

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">
      CompetitorPulse ${data.period === "daily" ? "Daily" : "Weekly"} Digest
    </h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">
      Hi ${data.userName}, here's your competitive intelligence update.
    </p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    ${
      data.aiSummary
        ? `
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #3b82f6;">
      <h3 style="margin: 0 0 12px 0; color: #1e3a8a;">AI Summary</h3>
      <p style="margin: 0; white-space: pre-wrap;">${data.aiSummary}</p>
    </div>
    `
        : ""
    }

    ${
      data.changes.length > 0
        ? `
    <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 16px;">
      Website Changes (${data.changes.length})
    </h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Competitor</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Type</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Summary</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Detected</th>
        </tr>
      </thead>
      <tbody>
        ${changesHtml}
      </tbody>
    </table>
    `
        : ""
    }

    ${
      data.announcements.length > 0
        ? `
    <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 16px;">
      Announcements (${data.announcements.length})
    </h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Competitor</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Title</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Source</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Published</th>
        </tr>
      </thead>
      <tbody>
        ${announcementsHtml}
      </tbody>
    </table>
    `
        : ""
    }

    ${
      data.changes.length === 0 && data.announcements.length === 0
        ? `
    <div style="text-align: center; padding: 40px; color: #6b7280;">
      <p>No significant competitive activity detected during this period.</p>
    </div>
    `
        : ""
    }

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Full Dashboard
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>You're receiving this because you have alerts enabled in CompetitorPulse.</p>
    <p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color: #6b7280;">Manage preferences</a>
    </p>
  </div>
</body>
</html>
  `
}

export async function sendSlackNotification(
  webhookUrl: string,
  message: {
    title: string
    text: string
    color?: string
    fields?: Array<{ title: string; value: string; short?: boolean }>
  }
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [
          {
            color: message.color || "#3b82f6",
            title: message.title,
            text: message.text,
            fields: message.fields,
            footer: "CompetitorPulse",
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    })

    return response.ok
  } catch (error) {
    console.error("Error sending Slack notification:", error)
    return false
  }
}
