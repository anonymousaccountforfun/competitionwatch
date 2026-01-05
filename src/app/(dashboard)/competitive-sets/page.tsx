"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import {
  Plus,
  Layers,
  MoreVertical,
  Trash2,
  Edit2,
  BarChart3,
  ExternalLink,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime } from "@/lib/utils"

interface CompetitiveSet {
  id: string
  name: string
  createdAt: string
  members: Array<{
    competitor: {
      id: string
      name: string
      logoUrl?: string
      primaryUrl: string
    }
  }>
  _count: {
    members: number
  }
}

interface Competitor {
  id: string
  name: string
  logoUrl?: string
}

export default function CompetitiveSetsPage() {
  const [sets, setSets] = useState<CompetitiveSet[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    competitorIds: [] as string[],
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [setsRes, competitorsRes] = await Promise.all([
        fetch("/api/competitive-sets"),
        fetch("/api/competitors"),
      ])

      const setsData = await setsRes.json()
      const competitorsData = await competitorsRes.json()

      setSets(Array.isArray(setsData) ? setsData : [])
      setCompetitors(Array.isArray(competitorsData) ? competitorsData : [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch("/api/competitive-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create set")
      }

      const newSet = await res.json()
      setSets([newSet, ...sets])
      setDialogOpen(false)
      setFormData({ name: "", competitorIds: [] })
      toast({
        title: "Competitive set created",
        description: `${newSet.name} has been created.`,
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create set",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const res = await fetch(`/api/competitive-sets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")

      setSets(sets.filter((s) => s.id !== id))
      toast({
        title: "Set deleted",
        description: `${name} has been deleted.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete set",
        variant: "destructive",
      })
    }
  }

  function toggleCompetitor(competitorId: string) {
    setFormData((prev) => ({
      ...prev,
      competitorIds: prev.competitorIds.includes(competitorId)
        ? prev.competitorIds.filter((id) => id !== competitorId)
        : [...prev.competitorIds, competitorId],
    }))
  }

  return (
    <div>
      <Header
        title="Competitive Sets"
        description="Group competitors for side-by-side comparison"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Set
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Competitive Set</DialogTitle>
                  <DialogDescription>
                    Group competitors together for easy comparison and reporting.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Set Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enterprise CRM Competitors"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Select Competitors</Label>
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {competitors.length === 0 ? (
                        <p className="p-4 text-sm text-neutral-500 text-center">
                          No competitors yet.{" "}
                          <Link href="/competitors" className="text-blue-600 hover:underline">
                            Add some first
                          </Link>
                        </p>
                      ) : (
                        competitors.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCompetitor(c.id)}
                            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-neutral-50 border-b last:border-b-0 transition-colors ${
                              formData.competitorIds.includes(c.id)
                                ? "bg-blue-50"
                                : ""
                            }`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={c.logoUrl} />
                              <AvatarFallback className="text-xs">
                                {c.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-sm font-medium">
                              {c.name}
                            </span>
                            {formData.competitorIds.includes(c.id) && (
                              <Badge variant="info">Selected</Badge>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                    {formData.competitorIds.length > 0 && (
                      <p className="text-xs text-neutral-500">
                        {formData.competitorIds.length} competitor(s) selected
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Set"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((j) => (
                      <Skeleton key={j} className="h-8 w-8 rounded-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                <Layers className="h-6 w-6 text-neutral-400" />
              </div>
              <h3 className="font-medium text-lg mb-2">No competitive sets yet</h3>
              <p className="text-neutral-500 text-center mb-4 max-w-sm">
                Create a competitive set to group competitors together for easy
                comparison and generate comparison reports.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Set
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sets.map((set) => (
              <Card key={set.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Link
                        href={`/competitive-sets/${set.id}`}
                        className="font-semibold text-lg hover:text-blue-600 transition-colors"
                      >
                        {set.name}
                      </Link>
                      <p className="text-sm text-neutral-500">
                        {set._count.members} competitor{set._count.members !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/competitive-sets/${set.id}`}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/compare?setId=${set.id}`}>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Compare
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(set.id, set.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {set.members.length > 0 && (
                    <div className="flex -space-x-2 mb-4">
                      {set.members.slice(0, 5).map((m) => (
                        <Avatar
                          key={m.competitor.id}
                          className="h-8 w-8 border-2 border-white"
                        >
                          <AvatarImage src={m.competitor.logoUrl} />
                          <AvatarFallback className="text-xs">
                            {m.competitor.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {set.members.length > 5 && (
                        <div className="h-8 w-8 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-xs font-medium text-neutral-600">
                          +{set.members.length - 5}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <span className="text-xs text-neutral-400">
                      Created {formatRelativeTime(set.createdAt)}
                    </span>
                    <Link href={`/competitive-sets/${set.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
