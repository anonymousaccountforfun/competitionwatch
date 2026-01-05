"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Send,
} from "lucide-react"

interface Insights {
  executiveSummary: string
  marketTrends: Array<{
    trend: string
    evidence: string
    impact: string
  }>
  competitorMoves: Array<{
    competitor: string
    move: string
    significance: string
    suggestedResponse: string
  }>
  opportunities: Array<{
    opportunity: string
    rationale: string
    priority: string
  }>
  threats: Array<{
    threat: string
    source: string
    severity: string
    mitigation: string
  }>
  strategicRecommendations: Array<{
    recommendation: string
    rationale: string
    timeframe: string
  }>
}

interface InsightsResponse {
  period: { days: number; startDate: string }
  competitorCount: number
  changesAnalyzed: number
  announcementsAnalyzed: number
  insights: Insights | null
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState("30")
  const [question, setQuestion] = useState("")
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)

  useEffect(() => {
    fetchInsights()
  }, [days])

  async function fetchInsights() {
    setLoading(true)
    try {
      const res = await fetch(`/api/insights?days=${days}`)
      const insightsData = await res.json()
      setData(insightsData)
    } catch (error) {
      console.error("Error fetching insights:", error)
    } finally {
      setLoading(false)
    }
  }

  async function askQuestion() {
    if (!question.trim()) return
    setAskingQuestion(true)
    setAnswer(null)

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "custom", question }),
      })
      const result = await res.json()
      setAnswer(result.answer)
    } catch (error) {
      console.error("Error asking question:", error)
      setAnswer("Sorry, I couldn't process your question. Please try again.")
    } finally {
      setAskingQuestion(false)
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-700"
      case "medium":
        return "bg-amber-100 text-amber-700"
      case "low":
        return "bg-green-100 text-green-700"
      default:
        return "bg-neutral-100 text-neutral-700"
    }
  }

  function getTimeframeColor(timeframe: string) {
    switch (timeframe.toLowerCase()) {
      case "immediate":
        return "bg-red-100 text-red-700"
      case "short-term":
        return "bg-blue-100 text-blue-700"
      case "long-term":
        return "bg-purple-100 text-purple-700"
      default:
        return "bg-neutral-100 text-neutral-700"
    }
  }

  return (
    <div>
      <Header
        title="AI Insights"
        description="Strategic intelligence and recommendations"
        action={
          <div className="flex items-center gap-3">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchInsights} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Ask AI Section */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Ask AI About Your Competitors</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Ask any question about your competitive landscape and get AI-powered answers.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., What pricing strategies are my competitors using?"
                    className="flex-1 bg-white"
                    onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                  />
                  <Button onClick={askQuestion} disabled={askingQuestion || !question.trim()}>
                    {askingQuestion ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {answer && (
                  <div className="mt-4 p-4 bg-white rounded-lg border">
                    <p className="text-sm whitespace-pre-wrap">{answer}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <InsightsSkeleton />
        ) : data?.insights ? (
          <>
            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg leading-relaxed">{data.insights.executiveSummary}</p>
                <div className="mt-4 flex gap-4 text-sm text-neutral-500">
                  <span>{data.competitorCount} competitors analyzed</span>
                  <span>{data.changesAnalyzed} changes reviewed</span>
                  <span>{data.announcementsAnalyzed} announcements reviewed</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Market Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Market Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.insights.marketTrends.length > 0 ? (
                    <div className="space-y-4">
                      {data.insights.marketTrends.map((trend, i) => (
                        <div key={i} className="border-b pb-4 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{trend.trend}</h4>
                            <Badge className={getPriorityColor(trend.impact)}>
                              {trend.impact}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-600 mt-1">{trend.evidence}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500">No significant trends detected</p>
                  )}
                </CardContent>
              </Card>

              {/* Threats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Threats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.insights.threats.length > 0 ? (
                    <div className="space-y-4">
                      {data.insights.threats.map((threat, i) => (
                        <div key={i} className="border-b pb-4 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{threat.threat}</h4>
                            <Badge className={getPriorityColor(threat.severity)}>
                              {threat.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-500 mt-1">Source: {threat.source}</p>
                          <p className="text-sm text-neutral-600 mt-2">
                            <span className="font-medium">Mitigation:</span> {threat.mitigation}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500">No immediate threats identified</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.insights.opportunities.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {data.insights.opportunities.map((opp, i) => (
                      <div key={i} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium">{opp.opportunity}</h4>
                          <Badge className={getPriorityColor(opp.priority)}>
                            {opp.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-600">{opp.rationale}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500">No new opportunities identified</p>
                )}
              </CardContent>
            </Card>

            {/* Competitor Moves */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                  Competitor Moves
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.insights.competitorMoves.length > 0 ? (
                  <div className="space-y-4">
                    {data.insights.competitorMoves.map((move, i) => (
                      <div key={i} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{move.competitor}</Badge>
                          <h4 className="font-medium">{move.move}</h4>
                        </div>
                        <p className="text-sm text-neutral-600 mb-2">{move.significance}</p>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm">
                            <span className="font-medium text-blue-700">Suggested Response:</span>{" "}
                            {move.suggestedResponse}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500">No significant competitor moves detected</p>
                )}
              </CardContent>
            </Card>

            {/* Strategic Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  Strategic Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.insights.strategicRecommendations.length > 0 ? (
                  <div className="space-y-4">
                    {data.insights.strategicRecommendations.map((rec, i) => (
                      <div key={i} className="flex gap-4 p-4 border rounded-lg">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-amber-700">{i + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{rec.recommendation}</h4>
                            <Badge className={getTimeframeColor(rec.timeframe)}>
                              {rec.timeframe}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-600 mt-1">{rec.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500">No recommendations at this time</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-neutral-300 mb-4" />
              <h3 className="font-medium text-lg mb-2">No Insights Available</h3>
              <p className="text-neutral-500 text-center max-w-md">
                Add competitors and wait for data to accumulate to generate AI-powered insights.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
