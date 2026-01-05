"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Building2,
  TrendingUp,
  Bell,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import { formatRelativeTime, formatDate } from "@/lib/utils"
import { changeTypeLabel, changeTypeVariant } from "@/lib/types"

interface DashboardStats {
  totalCompetitors: number
  changesThisWeek: number
  unreadAlerts: number
}

interface TimelineItem {
  type: "change" | "announcement"
  id: string
  date: string
  data: {
    id: string
    changeType?: string
    summary?: string
    title?: string
    sourceType?: string
    competitor: {
      id: string
      name: string
      logoUrl?: string
    }
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const [competitorsRes, timelineRes] = await Promise.all([
        fetch("/api/competitors"),
        fetch("/api/timeline?limit=10"),
      ])

      const competitors = await competitorsRes.json()
      const timelineData = await timelineRes.json()

      // Calculate stats
      const unreadChanges = competitors.reduce(
        (acc: number, c: { _count: { changes: number } }) => acc + (c._count?.changes || 0),
        0
      )
      const unreadAnnouncements = competitors.reduce(
        (acc: number, c: { _count: { announcements: number } }) => acc + (c._count?.announcements || 0),
        0
      )

      setStats({
        totalCompetitors: Array.isArray(competitors) ? competitors.length : 0,
        changesThisWeek: timelineData.items?.length || 0,
        unreadAlerts: unreadChanges + unreadAnnouncements,
      })

      setTimeline(timelineData.items || [])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Dashboard" description="Your competitive intelligence overview" />
        <div className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Dashboard"
        description="Your competitive intelligence overview"
        action={
          <Link href="/competitors">
            <Button>
              <Building2 className="h-4 w-4 mr-2" />
              Add Competitor
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Competitors Tracked
              </CardTitle>
              <Building2 className="h-4 w-4 text-neutral-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCompetitors || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Activity This Week
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-neutral-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.changesThisWeek || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Unread Alerts
              </CardTitle>
              <Bell className="h-4 w-4 text-neutral-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.unreadAlerts || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/timeline">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <p>No activity yet. Add competitors to start monitoring.</p>
                <Link href="/competitors">
                  <Button variant="outline" className="mt-4">
                    Add Your First Competitor
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {timeline.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.data.competitor.logoUrl} />
                      <AvatarFallback>
                        {item.data.competitor.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {item.data.competitor.name}
                        </span>
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
                        {item.type === "announcement" && (
                          <Badge variant="secondary">
                            {item.data.sourceType}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 truncate">
                        {item.type === "change"
                          ? item.data.summary
                          : item.data.title}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {formatRelativeTime(item.date)}
                      </p>
                    </div>
                    <Link
                      href={
                        item.type === "change"
                          ? `/changes/${item.id}`
                          : `/competitors/${item.data.competitor.id}`
                      }
                    >
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
