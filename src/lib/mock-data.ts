// Mock data for demo mode - allows previewing the app without a database

export const DEMO_WORKSPACE_ID = "demo-workspace-00000000-0000-0000-0000"
export const DEMO_USER_ID = "demo-user-00000000-0000-0000-0000"

export const mockCompetitors = [
  {
    id: "comp-001",
    workspaceId: DEMO_WORKSPACE_ID,
    name: "Acme Analytics",
    primaryUrl: "https://acme-analytics.com",
    logoUrl: null,
    description: "Enterprise analytics platform with AI-powered insights",
    metadata: {},
    createdAt: new Date("2024-01-15"),
    isActive: true,
    _count: { changes: 12, monitoredUrls: 3 },
  },
  {
    id: "comp-002",
    workspaceId: DEMO_WORKSPACE_ID,
    name: "DataFlow Pro",
    primaryUrl: "https://dataflow.io",
    logoUrl: null,
    description: "Real-time data pipeline management",
    metadata: {},
    createdAt: new Date("2024-02-01"),
    isActive: true,
    _count: { changes: 8, monitoredUrls: 2 },
  },
  {
    id: "comp-003",
    workspaceId: DEMO_WORKSPACE_ID,
    name: "InsightHub",
    primaryUrl: "https://insighthub.com",
    logoUrl: null,
    description: "Business intelligence for growing teams",
    metadata: {},
    createdAt: new Date("2024-02-20"),
    isActive: true,
    _count: { changes: 5, monitoredUrls: 4 },
  },
]

export const mockChanges = [
  {
    id: "change-001",
    competitorId: "comp-001",
    monitoredUrlId: "url-001",
    beforeSnapshotId: "snap-001",
    afterSnapshotId: "snap-002",
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    changeType: "pricing_change",
    summary: "Reduced enterprise tier pricing by 20%",
    analysis: "Acme Analytics has significantly reduced their enterprise pricing, likely in response to competitive pressure. This may indicate they're prioritizing market share over margins.",
    confidence: 0.92,
    affectedAreas: ["pricing", "enterprise"],
    rawDiff: null,
    isMaterial: true,
    isRead: false,
    metadata: {},
    competitor: { id: "comp-001", name: "Acme Analytics", primaryUrl: "https://acme-analytics.com" },
    monitoredUrl: { url: "https://acme-analytics.com/pricing", urlType: "pricing" },
  },
  {
    id: "change-002",
    competitorId: "comp-002",
    monitoredUrlId: "url-002",
    beforeSnapshotId: "snap-003",
    afterSnapshotId: "snap-004",
    detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    changeType: "feature_launch",
    summary: "Launched new AI-powered data validation feature",
    analysis: "DataFlow Pro has added AI capabilities to their data validation pipeline. This positions them more directly against enterprise solutions and could appeal to data quality-focused buyers.",
    confidence: 0.88,
    affectedAreas: ["product", "ai", "features"],
    rawDiff: null,
    isMaterial: true,
    isRead: true,
    metadata: {},
    competitor: { id: "comp-002", name: "DataFlow Pro", primaryUrl: "https://dataflow.io" },
    monitoredUrl: { url: "https://dataflow.io/features", urlType: "landing_page" },
  },
  {
    id: "change-003",
    competitorId: "comp-003",
    monitoredUrlId: "url-003",
    beforeSnapshotId: "snap-005",
    afterSnapshotId: "snap-006",
    detectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    changeType: "messaging_shift",
    summary: "Updated homepage messaging to focus on 'AI-first analytics'",
    analysis: "InsightHub is repositioning from general BI to AI-first analytics. This messaging shift suggests they're targeting the growing demand for automated insights.",
    confidence: 0.85,
    affectedAreas: ["messaging", "positioning"],
    rawDiff: null,
    isMaterial: true,
    isRead: false,
    metadata: {},
    competitor: { id: "comp-003", name: "InsightHub", primaryUrl: "https://insighthub.com" },
    monitoredUrl: { url: "https://insighthub.com", urlType: "landing_page" },
  },
  {
    id: "change-004",
    competitorId: "comp-001",
    monitoredUrlId: "url-004",
    beforeSnapshotId: "snap-007",
    afterSnapshotId: "snap-008",
    detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    changeType: "social_proof",
    summary: "Added Fortune 500 customer logos including Microsoft and Salesforce",
    analysis: "Acme Analytics is highlighting enterprise credibility with major customer logos. This signals successful upmarket movement and could influence enterprise buyer decisions.",
    confidence: 0.95,
    affectedAreas: ["social_proof", "enterprise"],
    rawDiff: null,
    isMaterial: true,
    isRead: true,
    metadata: {},
    competitor: { id: "comp-001", name: "Acme Analytics", primaryUrl: "https://acme-analytics.com" },
    monitoredUrl: { url: "https://acme-analytics.com/customers", urlType: "landing_page" },
  },
  {
    id: "change-005",
    competitorId: "comp-002",
    monitoredUrlId: "url-005",
    beforeSnapshotId: "snap-009",
    afterSnapshotId: "snap-010",
    detectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    changeType: "partnership",
    summary: "Announced strategic partnership with Snowflake",
    analysis: "DataFlow Pro's Snowflake partnership strengthens their data warehouse integration story. This could accelerate their enterprise adoption among Snowflake customers.",
    confidence: 0.91,
    affectedAreas: ["partnerships", "integrations"],
    rawDiff: null,
    isMaterial: true,
    isRead: true,
    metadata: {},
    competitor: { id: "comp-002", name: "DataFlow Pro", primaryUrl: "https://dataflow.io" },
    monitoredUrl: { url: "https://dataflow.io/blog", urlType: "blog" },
  },
]

export const mockAnnouncements = [
  {
    id: "ann-001",
    competitorId: "comp-001",
    sourceType: "rss",
    sourceUrl: "https://acme-analytics.com/blog/series-c",
    title: "Acme Analytics Raises $50M Series C",
    content: "We're excited to announce our Series C funding round led by Sequoia Capital...",
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    capturedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    aiSummary: "Acme Analytics secured $50M in Series C funding to expand their enterprise offering.",
    aiAnalysis: "This funding will likely accelerate their product development and sales expansion.",
    changeType: "funding",
    isRead: false,
    metadata: {},
    competitor: { id: "comp-001", name: "Acme Analytics" },
  },
  {
    id: "ann-002",
    competitorId: "comp-003",
    sourceType: "rss",
    sourceUrl: "https://insighthub.com/blog/new-cto",
    title: "InsightHub Welcomes New CTO from Google",
    content: "We're thrilled to welcome Jane Smith as our new Chief Technology Officer...",
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    capturedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    aiSummary: "InsightHub hired a new CTO with Google AI background.",
    aiAnalysis: "This hire signals a serious commitment to AI capabilities and technical leadership.",
    changeType: "hiring_signal",
    isRead: true,
    metadata: {},
    competitor: { id: "comp-003", name: "InsightHub" },
  },
]

export const mockTimeline = [
  ...mockChanges.map((c) => ({ ...c, type: "change" as const })),
  ...mockAnnouncements.map((a) => ({ ...a, type: "announcement" as const })),
].sort((a, b) => {
  const dateA = "detectedAt" in a ? a.detectedAt : a.publishedAt
  const dateB = "detectedAt" in b ? b.detectedAt : b.publishedAt
  return new Date(dateB!).getTime() - new Date(dateA!).getTime()
})

export const mockWorkspace = {
  id: DEMO_WORKSPACE_ID,
  name: "Demo Workspace",
  createdAt: new Date("2024-01-01"),
  settings: {},
}

export const mockDashboardStats = {
  totalCompetitors: mockCompetitors.length,
  totalChanges: mockChanges.length,
  unreadChanges: mockChanges.filter((c) => !c.isRead).length,
  changesThisWeek: mockChanges.filter(
    (c) => new Date(c.detectedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length,
  topChangeTypes: [
    { type: "pricing_change", count: 3 },
    { type: "feature_launch", count: 4 },
    { type: "messaging_shift", count: 2 },
  ],
}

export function getMockCompetitors() {
  return mockCompetitors
}

export function getMockChanges(limit?: number) {
  return limit ? mockChanges.slice(0, limit) : mockChanges
}

export function getMockTimeline(limit?: number) {
  return limit ? mockTimeline.slice(0, limit) : mockTimeline
}

export function getMockDashboardStats() {
  return mockDashboardStats
}
