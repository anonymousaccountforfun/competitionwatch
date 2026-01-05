"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExternalLink, TrendingUp, TrendingDown, Minus, Download } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { changeTypeLabel, changeTypeVariant, CHANGE_TYPES } from "@/lib/types"

interface CompetitiveSet {
  id: string
  name: string
}

interface CompetitorComparison {
  id: string
  name: string
  logoUrl?: string
  primaryUrl: string
  stats: {
    changes: number
    announcements: number
    monitoredUrls: number
  }
  recentChanges: Array<{
    id: string
    changeType: string
    summary: string
    detectedAt: string
  }>
  changesByType: Record<string, number>
}

function ComparePageContent() {
  const searchParams = useSearchParams()
  const setId = searchParams.get("setId")

  const [sets, setSets] = useState<CompetitiveSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string>(setId || "")
  const [competitors, setCompetitors] = useState<CompetitorComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchSets()
  }, [])

  useEffect(() => {
    if (selectedSetId) {
      fetchComparison(selectedSetId)
    }
  }, [selectedSetId])

  async function fetchSets() {
    try {
      const res = await fetch("/api/competitive-sets")
      const data = await res.json()
      setSets(Array.isArray(data) ? data : [])

      if (!selectedSetId && data.length > 0) {
        setSelectedSetId(data[0].id)
      }
    } catch (error) {
      console.error("Error fetching sets:", error)
    } finally {
      if (!selectedSetId) {
        setLoading(false)
      }
    }
  }

  async function fetchComparison(setId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/competitive-set/${setId}?days=30`)
      const data = await res.json()

      if (data.competitors) {
        const mapped: CompetitorComparison[] = data.competitors.map((c: {
          id: string
          name: string
          logoUrl?: string
          primaryUrl: string
          stats: { changes: number; announcements: number; monitoredUrls: number }
          recentChanges: Array<{ type: string; typeLabel: string; summary: string; detectedAt: string }>
        }) => ({
          id: c.id,
          name: c.name,
          logoUrl: c.logoUrl,
          primaryUrl: c.primaryUrl,
          stats: c.stats,
          recentChanges: c.recentChanges.map((ch) => ({
            id: Math.random().toString(),
            changeType: ch.type,
            summary: ch.summary,
            detectedAt: ch.detectedAt,
          })),
          changesByType: {},
        }))

        // Calculate changes by type
        for (const comp of mapped) {
          const byType: Record<string, number> = {}
          for (const change of comp.recentChanges) {
            byType[change.changeType] = (byType[change.changeType] || 0) + 1
          }
          comp.changesByType = byType
        }

        setCompetitors(mapped)
      }
    } catch (error) {
      console.error("Error fetching comparison:", error)
    } finally {
      setLoading(false)
    }
  }

  async function downloadReport() {
    if (!selectedSetId) return
    setDownloading(true)
    try {
      const res = await fetch(
        `/api/reports/competitive-set/${selectedSetId}?format=markdown&days=30`
      )
      const text = await res.text()
      const blob = new Blob([text], { type: "text/markdown" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "competitive-comparison.md"
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading report:", error)
    } finally {
      setDownloading(false)
    }
  }

  const maxChanges = Math.max(...competitors.map((c) => c.stats.changes), 1)
  const maxAnnouncements = Math.max(...competitors.map((c) => c.stats.announcements), 1)

  return (
    <div>
      <Header
        title="Compare Competitors"
        description="Side-by-side comparison of competitor activity"
        action={
          <Button
            variant="outline"
            onClick={downloadReport}
            disabled={downloading || !selectedSetId}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? "Generating..." : "Export Report"}
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Set Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-500">
                Competitive Set:
              </span>
              <Select value={selectedSetId} onValueChange={setSelectedSetId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a competitive set" />
                </SelectTrigger>
                <SelectContent>
                  {sets.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sets.length === 0 && !loading && (
                <Link href="/competitive-sets" className="text-sm text-blue-600 hover:underline">
                  Create a competitive set first
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-12 rounded-full mb-4" />
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : competitors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              <p>No competitors to compare.</p>
              <p className="text-sm mt-2">
                Select a competitive set with competitors to see the comparison.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Activity Comparison */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitors.map((comp) => (
                <Card key={comp.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comp.logoUrl} />
                        <AvatarFallback>
                          {comp.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/competitors/${comp.id}`}
                          className="font-semibold hover:text-blue-600"
                        >
                          {comp.name}
                        </Link>
                        <a
                          href={comp.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-400 flex items-center gap-1 hover:text-neutral-600"
                        >
                          {new URL(comp.primaryUrl).hostname}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Activity Bars */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-500">Changes</span>
                          <span className="font-medium">{comp.stats.changes}</span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{
                              width: `${(comp.stats.changes / maxChanges) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-500">Announcements</span>
                          <span className="font-medium">{comp.stats.announcements}</span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{
                              width: `${(comp.stats.announcements / maxAnnouncements) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Change Types */}
                    {Object.keys(comp.changesByType).length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-neutral-400 uppercase font-medium mb-2">
                          Change Types
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(comp.changesByType).map(([type, count]) => (
                            <Badge
                              key={type}
                              variant={
                                changeTypeVariant[type as keyof typeof changeTypeVariant] as "feature" | "messaging" | "pricing" | "partnership" | "minor"
                              }
                              className="text-xs"
                            >
                              {changeTypeLabel[type as keyof typeof changeTypeLabel] || type}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Changes */}
                    {comp.recentChanges.length > 0 && (
                      <div>
                        <p className="text-xs text-neutral-400 uppercase font-medium mb-2">
                          Recent Activity
                        </p>
                        <div className="space-y-2">
                          {comp.recentChanges.slice(0, 3).map((change, idx) => (
                            <div
                              key={idx}
                              className="text-sm text-neutral-600 truncate"
                            >
                              {change.summary}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Activity Matrix */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Matrix (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-neutral-500">
                          Competitor
                        </th>
                        {CHANGE_TYPES.filter((t) => t !== "minor").map((type) => (
                          <th
                            key={type}
                            className="text-center py-3 px-2 font-medium text-neutral-500 text-sm"
                          >
                            {changeTypeLabel[type]}
                          </th>
                        ))}
                        <th className="text-center py-3 px-4 font-medium text-neutral-500">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitors.map((comp) => (
                        <tr key={comp.id} className="border-b last:border-b-0">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={comp.logoUrl} />
                                <AvatarFallback className="text-xs">
                                  {comp.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{comp.name}</span>
                            </div>
                          </td>
                          {CHANGE_TYPES.filter((t) => t !== "minor").map((type) => (
                            <td key={type} className="text-center py-3 px-2">
                              {comp.changesByType[type] ? (
                                <Badge
                                  variant={
                                    changeTypeVariant[type] as "feature" | "messaging" | "pricing" | "partnership"
                                  }
                                >
                                  {comp.changesByType[type]}
                                </Badge>
                              ) : (
                                <span className="text-neutral-300">-</span>
                              )}
                            </td>
                          ))}
                          <td className="text-center py-3 px-4 font-semibold">
                            {comp.stats.changes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div>
        <Header title="Compare Competitors" />
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  )
}
