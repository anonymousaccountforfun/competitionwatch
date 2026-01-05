import { z } from "zod"

// URL Types
export const URL_TYPES = [
  "landing_page",
  "pricing",
  "blog",
  "careers",
  "app_store",
  "rss_feed",
  "newsroom",
] as const

export type UrlType = (typeof URL_TYPES)[number]

// Check Frequencies
export const CHECK_FREQUENCIES = ["hourly", "daily", "twice_daily", "weekly"] as const
export type CheckFrequency = (typeof CHECK_FREQUENCIES)[number]

// Change Types
export const CHANGE_TYPES = [
  "messaging_shift",
  "feature_launch",
  "pricing_change",
  "social_proof",
  "positioning",
  "partnership",
  "hiring_signal",
  "minor",
] as const

export type ChangeType = (typeof CHANGE_TYPES)[number]

// Source Types for Announcements
export const SOURCE_TYPES = [
  "rss",
  "app_store_ios",
  "app_store_android",
  "twitter",
  "product_hunt",
  "linkedin",
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

// Alert Channels
export const ALERT_CHANNELS = ["email", "slack"] as const
export type AlertChannel = (typeof ALERT_CHANNELS)[number]

// Alert Frequencies
export const ALERT_FREQUENCIES = ["realtime", "daily", "weekly"] as const
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number]

// Validation Schemas
export const createCompetitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  primaryUrl: z.string().url("Invalid URL"),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
})

export const updateCompetitorSchema = createCompetitorSchema.partial()

export const createMonitoredUrlSchema = z.object({
  url: z.string().url("Invalid URL"),
  urlType: z.enum(URL_TYPES),
  checkFrequency: z.enum(CHECK_FREQUENCIES).default("daily"),
})

export const updateMonitoredUrlSchema = createMonitoredUrlSchema.partial()

export const alertPreferencesSchema = z.object({
  channel: z.enum(ALERT_CHANNELS),
  frequency: z.enum(ALERT_FREQUENCIES),
  minConfidence: z.number().min(0).max(1),
  changeTypes: z.array(z.enum(CHANGE_TYPES)),
  slackWebhookUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean(),
})

// AI Analysis Response Schema
export const aiAnalysisSchema = z.object({
  change_type: z.enum(CHANGE_TYPES),
  summary: z.string(),
  analysis: z.string(),
  confidence: z.number().min(0).max(1),
  affected_areas: z.array(z.string()),
  is_material: z.boolean(),
})

export type AIAnalysis = z.infer<typeof aiAnalysisSchema>

// Type helpers for badge variants
export const changeTypeVariant: Record<ChangeType, string> = {
  messaging_shift: "messaging",
  feature_launch: "feature",
  pricing_change: "pricing",
  social_proof: "info",
  positioning: "messaging",
  partnership: "partnership",
  hiring_signal: "info",
  minor: "minor",
}

export const changeTypeLabel: Record<ChangeType, string> = {
  messaging_shift: "Messaging Shift",
  feature_launch: "Feature Launch",
  pricing_change: "Pricing Change",
  social_proof: "Social Proof",
  positioning: "Positioning",
  partnership: "Partnership",
  hiring_signal: "Hiring Signal",
  minor: "Minor Change",
}

export const urlTypeLabel: Record<UrlType, string> = {
  landing_page: "Landing Page",
  pricing: "Pricing",
  blog: "Blog",
  careers: "Careers",
  app_store: "App Store",
  rss_feed: "RSS Feed",
  newsroom: "Newsroom",
}
