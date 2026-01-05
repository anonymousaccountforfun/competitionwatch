import Anthropic from "@anthropic-ai/sdk"
import { aiAnalysisSchema, type AIAnalysis } from "@/lib/types"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ChangeAnalysisInput {
  competitorName: string
  url: string
  urlType: string
  beforeContent: string
  afterContent: string
  beforeDate: string
  afterDate: string
}

export async function analyzeChange(input: ChangeAnalysisInput): Promise<AIAnalysis> {
  const prompt = `You are a competitive intelligence analyst helping Product Marketing teams understand competitor movements.

Analyze the following change detected on a competitor's website:

COMPETITOR: ${input.competitorName}
URL: ${input.url}
URL TYPE: ${input.urlType}

BEFORE (captured ${input.beforeDate}):
${input.beforeContent.slice(0, 10000)}

AFTER (captured ${input.afterDate}):
${input.afterContent.slice(0, 10000)}

Provide your analysis in the following JSON format ONLY (no other text):
{
  "change_type": "messaging_shift | feature_launch | pricing_change | social_proof | positioning | partnership | hiring_signal | minor",
  "summary": "One clear sentence describing what changed",
  "analysis": "2-3 sentences explaining the strategic implications of this change. What might this signal about their strategy? How might this affect their positioning?",
  "confidence": 0.0 to 1.0 (how confident you are in this classification),
  "affected_areas": ["array", "of", "affected", "areas"],
  "is_material": true/false (is this a significant change worth alerting on, or just minor cosmetic/typo fixes?)
}

Focus on changes that would matter to a Product Marketer trying to understand competitive positioning, messaging, and go-to-market strategy.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude")
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response")
    }

    const parsed = JSON.parse(jsonMatch[0])
    const validated = aiAnalysisSchema.parse(parsed)
    return validated
  } catch (error) {
    console.error("Error analyzing change with Claude:", error)
    // Return a default analysis if AI fails
    return {
      change_type: "minor",
      summary: "Unable to analyze change automatically",
      analysis: "The AI analysis encountered an error. Please review the changes manually.",
      confidence: 0,
      affected_areas: [],
      is_material: false,
    }
  }
}

export interface DigestInput {
  changes: Array<{
    competitorName: string
    changeType: string
    summary: string
    detectedAt: string
  }>
  announcements: Array<{
    competitorName: string
    title: string
    sourceType: string
    publishedAt: string
  }>
}

export async function generateDigest(input: DigestInput): Promise<string> {
  const changesText = input.changes
    .map((c) => `- [${c.competitorName}] ${c.changeType}: ${c.summary} (${c.detectedAt})`)
    .join("\n")

  const announcementsText = input.announcements
    .map((a) => `- [${a.competitorName}] ${a.title} (${a.sourceType}, ${a.publishedAt})`)
    .join("\n")

  const prompt = `You are a competitive intelligence analyst preparing a weekly briefing for a Product Marketing team.

Here are the competitive movements detected this week:

CHANGES:
${changesText || "No significant changes detected."}

ANNOUNCEMENTS:
${announcementsText || "No new announcements."}

Write a concise executive summary (3-5 paragraphs) that:
1. Highlights the most significant competitive movements
2. Identifies any patterns or trends across competitors
3. Suggests areas the team should pay attention to
4. Uses clear, professional language suitable for sharing with leadership

End with 2-3 bullet points of recommended actions or areas to investigate further.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude")
    }

    return content.text
  } catch (error) {
    console.error("Error generating digest with Claude:", error)
    return "Unable to generate digest automatically. Please review the changes manually."
  }
}

export async function analyzeAnnouncement(
  competitorName: string,
  title: string,
  content: string,
  sourceType: string
): Promise<{ summary: string; analysis: string; changeType: string }> {
  const prompt = `You are a competitive intelligence analyst. Analyze this announcement from a competitor:

COMPETITOR: ${competitorName}
SOURCE: ${sourceType}
TITLE: ${title}
CONTENT:
${content.slice(0, 5000)}

Provide your analysis in JSON format ONLY:
{
  "summary": "One sentence summary of the announcement",
  "analysis": "2-3 sentences on strategic implications",
  "change_type": "messaging_shift | feature_launch | pricing_change | social_proof | positioning | partnership | hiring_signal | minor"
}`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    const responseContent = response.content[0]
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type from Claude")
    }

    const jsonMatch = responseContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response")
    }

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error("Error analyzing announcement with Claude:", error)
    return {
      summary: title,
      analysis: "Unable to analyze automatically.",
      changeType: "minor",
    }
  }
}
