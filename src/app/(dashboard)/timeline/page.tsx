"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
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
import { ExternalLink, Filter, Loader2 } from "lucide-react"
import { formatRelativeTime, formatDate } from "@/lib/utils"
import { changeTypeLabel, changeTypeVariant, CHANGE_TYPES } from "@/lib/types"

interface TimelineItem {
  type: "change" | "announcement"
  id: string
  date: string
  data: {
    id: string
    changeType?: string
    summary?: string
    analysis?: string
    title?: string
    content?: string
    aiSummary?: string
    sourceType?: string
    isRead?: boolean
    monitoredUrl?: {
      url: string
      urlType: string
    }
    competitor: {
      id: string
      name: string
      logoUrl?: string
    }
  }
}

interface Competitor {
  id: string
  name: string
}

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState({
    competitorId: "",
    changeType: "",
  })

  useEffect(() => {
    fetchCompetitors()
    fetchTimeline(1, true)
  }, [])

  useEffect(() => {
    fetchTimeline(1, true)
  }, [filters])

  async function fetchCompetitors() {
    try {
      const res = await fetch("/api/competitors")
      const data = await res.json()
      setCompetitors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching competitors:", error)
    }
  }

  async function fetchTimeline(pageNum: number, reset = false) {
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      })
      if (filters.competitorId) params.set("competitorId", filters.competitorId)
      if (filters.changeType) params.set("changeTypes", filters.changeType)

      const res = await fetch(`/api/timeline?${params}`)
      const data = await res.json()

      if (reset) {
        setItems(data.items || [])
      } else {
        setItems((prev) => [...prev, ...(data.items || [])])
      }

      setPage(pageNum)
      setHasMore(pageNum < data.pagination.totalPages)
    } catch (error) {
      console.error("Error fetching timeline:", error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function loadMore() {
    if (!loadingMore && hasMore) {
      fetchTimeline(page + 1)
    }
  }

  // Group items by date
  const groupedItems = items.reduce(
    (groups, item) => {
      const date = formatDate(item.date)
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(item)
      return groups
    },
    {} as Record<string, TimelineItem[]>
  )

  return (
    <div>
      <Header
        title="Timeline"
        description="Chronological feed of all competitor activity"
      />

      <div className="p-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="h-4 w-4 text-neutral-400" />
              <Select
                value={filters.competitorId}
                onValueChange={(v) => setFilters({ ...filters, competitorId: v })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Competitors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Competitors</SelectItem>
                  {competitors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.changeType}
                onValueChange={(v) => setFilters({ ...filters, changeType: v })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Change Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Change Types</SelectItem>
                  {CHANGE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {changeTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filters.competitorId || filters.changeType) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ competitorId: "", changeType: "" })}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              <p>No activity found.</p>
              {(filters.competitorId || filters.changeType) && (
                <p className="text-sm mt-2">
                  Try adjusting your filters to see more results.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([date, dateItems]) => (
              <div key={date}>
                <div className="sticky top-0 z-10 bg-neutral-50 py-2">
                  <span className="text-sm font-medium text-neutral-500">{date}</span>
                </div>
                <div className="space-y-3">
                  {dateItems.map((item) => (
                    <Card
                      key={`${item.type}-${item.id}`}
                      className={item.data.isRead ? "opacity-60" : ""}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={item.data.competitor.logoUrl} />
                            <AvatarFallback>
                              {item.data.competitor.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/competitors/${item.data.competitor.id}`}
                                className="font-medium hover:text-blue-600"
                              >
                                {item.data.competitor.name}
                              </Link>
                              {item.type === "change" && item.data.changeType && (
                                <Badge
                                  variant={
                                    changeTypeVariant[
                                      item.data.changeType as keyof typeof changeTypeVariant
                                    ] as "feature" | "messaging" | "pricing" | "partnership" | "minor" | "info"
                                  }
                                >
                                  {changeTypeLabel[
                                    item.data.changeType as keyof typeof changeTypeLabel
                                  ] || item.data.changeType}
                                </Badge>
                              )}
                              {item.type === "announcement" && item.data.sourceType && (
                                <Badge variant="secondary">
                                  {item.data.sourceType.replace("_", " ")}
                                </Badge>
                              )}
                              <span className="text-sm text-neutral-400">
                                {formatRelativeTime(item.date)}
                              </span>
                            </div>
                            <p className="text-neutral-800 mt-1">
                              {item.type === "change"
                                ? item.data.summary
                                : item.data.title}
                            </p>
                            {item.type === "change" && item.data.analysis && (
                              <p className="text-sm text-neutral-600 mt-2">
                                {item.data.analysis}
                              </p>
                            )}
                            {item.type === "announcement" && item.data.aiSummary && (
                              <p className="text-sm text-neutral-600 mt-2">
                                {item.data.aiSummary}
                              </p>
                            )}
                            {item.type === "change" && item.data.monitoredUrl && (
                              <a
                                href={item.data.monitoredUrl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                              >
                                {item.data.monitoredUrl.url}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {item.type === "change" && (
                            <Link href={`/changes/${item.id}`}>
                              <Button variant="ghost" size="sm">
                                Details
                              </Button>
                            </Link>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
