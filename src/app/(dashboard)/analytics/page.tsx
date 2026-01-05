"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Zap,
  Bell,
} from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { changeTypeLabel } from "@/lib/types"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface AnalyticsData {
  period: { days: number; startDate: string; endDate: string }
  summary: {
    totalChanges: number
    materialChanges: number
    totalAnnouncements: number
    activeCompetitors: number
    avgChangesPerDay: string
  }
  dailyActivity: Array<{ date: string; changes: number; announcements: number }>
  changeTypeDistribution: Array<{ type: string; count: number }>
  competitorScores: Array<{
    id: string
    name: string
    logoUrl: string | null
    changes: number
    announcements: number
    activityScore: number
  }>
  trends: {
    changeVelocity: {
      firstHalf: number
      secondHalf: number
      percentChange: number
      direction: string
    }
    announcementVelocity: {
      firstHalf: number
      secondHalf: number
      percentChange: number
      direction: string
    }
    trendingChangeTypes: string[]
  }
  topChanges: Array<{
    id: string
    competitor: string
    competitorLogo: string | null
    changeType: string | null
    summary: string | null
    url: string | null
    urlType: string | null
    detectedAt: string
  }>
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState("30")

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?days=${days}`)
      const analyticsData = await res.json()
      setData(analyticsData)
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  function getTrendIcon(direction: string) {
    switch (direction) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "decreasing":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-neutral-400" />
    }
  }

  function getTrendColor(direction: string) {
    switch (direction) {
      case "increasing":
        return "text-green-600"
      case "decreasing":
        return "text-red-600"
      default:
        return "text-neutral-500"
    }
  }

  return (
    <div>
      <Header
        title="Analytics"
        description="Track competitor activity trends and insights"
        action={
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
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <AnalyticsSkeleton />
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.summary.totalChanges}</p>
                      <p className="text-sm text-neutral-500">Total Changes</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {getTrendIcon(data.trends.changeVelocity.direction)}
                    <span className={`text-sm ${getTrendColor(data.trends.changeVelocity.direction)}`}>
                      {data.trends.changeVelocity.percentChange > 0 ? "+" : ""}
                      {data.trends.changeVelocity.percentChange}% vs previous period
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.summary.materialChanges}</p>
                      <p className="text-sm text-neutral-500">Material Changes</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-neutral-500">
                      {((data.summary.materialChanges / data.summary.totalChanges) * 100 || 0).toFixed(0)}% of total changes
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Bell className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.summary.totalAnnouncements}</p>
                      <p className="text-sm text-neutral-500">Announcements</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {getTrendIcon(data.trends.announcementVelocity.direction)}
                    <span className={`text-sm ${getTrendColor(data.trends.announcementVelocity.direction)}`}>
                      {data.trends.announcementVelocity.percentChange > 0 ? "+" : ""}
                      {data.trends.announcementVelocity.percentChange}% vs previous period
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.summary.avgChangesPerDay}</p>
                      <p className="text-sm text-neutral-500">Avg Changes/Day</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-neutral-500">
                      {data.summary.activeCompetitors} active competitors
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyActivity}>
                      <defs>
                        <linearGradient id="colorChanges" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAnnouncements" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        stroke="#9ca3af"
                        fontSize={12}
                      />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <Area
                        type="monotone"
                        dataKey="changes"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorChanges)"
                        name="Changes"
                      />
                      <Area
                        type="monotone"
                        dataKey="announcements"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorAnnouncements)"
                        name="Announcements"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Change Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Changes by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.changeTypeDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="type"
                          label={({ type, percent }) => `${changeTypeLabel[type as keyof typeof changeTypeLabel] || type} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {data.changeTypeDistribution.map((entry, index) => (
                            <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [value, changeTypeLabel[name as keyof typeof changeTypeLabel] || name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.changeTypeDistribution.slice(0, 5).map((item, index) => (
                      <Badge key={item.type} variant="outline" className="gap-1">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {changeTypeLabel[item.type as keyof typeof changeTypeLabel] || item.type}: {item.count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Competitor Activity Scores */}
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Activity Ranking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.competitorScores.slice(0, 6)}
                        layout="vertical"
                        margin={{ left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          stroke="#9ca3af"
                          fontSize={12}
                          tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + "..." : value}
                        />
                        <Tooltip />
                        <Bar dataKey="activityScore" fill="#3b82f6" name="Activity Score" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {data.competitorScores.slice(0, 5).map((competitor, index) => (
                      <div key={competitor.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-neutral-400 w-4">
                          {index + 1}
                        </span>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={competitor.logoUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {competitor.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium flex-1">{competitor.name}</span>
                        <span className="text-xs text-neutral-500">
                          {competitor.changes} changes, {competitor.announcements} announcements
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Trending & Top Changes */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Trending Change Types</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.trends.trendingChangeTypes.length > 0 ? (
                    <div className="space-y-3">
                      {data.trends.trendingChangeTypes.map((type, index) => (
                        <div key={type} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <span className="font-medium">
                            {changeTypeLabel[type as keyof typeof changeTypeLabel] || type}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No trending changes in this period</p>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Material Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topChanges.length > 0 ? (
                    <div className="space-y-4">
                      {data.topChanges.slice(0, 5).map((change) => (
                        <div key={change.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={change.competitorLogo || undefined} />
                            <AvatarFallback className="text-xs">
                              {change.competitor.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{change.competitor}</span>
                              <Badge variant="outline" className="text-xs">
                                {changeTypeLabel[change.changeType as keyof typeof changeTypeLabel] || change.changeType}
                              </Badge>
                            </div>
                            <p className="text-sm text-neutral-600 line-clamp-1 mt-1">
                              {change.summary || "Change detected"}
                            </p>
                            <p className="text-xs text-neutral-400 mt-1">
                              {formatRelativeTime(change.detectedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No material changes in this period</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-neutral-500">Unable to load analytics data</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-full mb-4" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </>
  )
}
