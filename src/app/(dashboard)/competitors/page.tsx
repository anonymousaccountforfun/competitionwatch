"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import {
  Plus,
  ExternalLink,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  Edit2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime } from "@/lib/utils"

interface Competitor {
  id: string
  name: string
  primaryUrl: string
  logoUrl?: string
  description?: string
  createdAt: string
  monitoredUrls: Array<{
    id: string
    url: string
    urlType: string
    lastCheckedAt?: string
  }>
  _count: {
    changes: number
    announcements: number
  }
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    primaryUrl: "",
    description: "",
    logoUrl: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCompetitors()
  }, [])

  async function fetchCompetitors() {
    try {
      const res = await fetch("/api/competitors")
      const data = await res.json()
      setCompetitors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching competitors:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create competitor")
      }

      const newCompetitor = await res.json()
      setCompetitors([newCompetitor, ...competitors])
      setDialogOpen(false)
      setFormData({ name: "", primaryUrl: "", description: "", logoUrl: "" })
      toast({
        title: "Competitor added",
        description: `${newCompetitor.name} is now being monitored.`,
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add competitor",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return

    try {
      const res = await fetch(`/api/competitors/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")

      setCompetitors(competitors.filter((c) => c.id !== id))
      toast({
        title: "Competitor removed",
        description: `${name} has been archived.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove competitor",
        variant: "destructive",
      })
    }
  }

  return (
    <div>
      <Header
        title="Competitors"
        description="Manage the companies you're tracking"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Competitor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Competitor</DialogTitle>
                  <DialogDescription>
                    Start monitoring a new competitor. We'll automatically track their
                    landing page.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Acme Corp"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="url">Website URL *</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.primaryUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, primaryUrl: e.target.value })
                      }
                      placeholder="https://acme.com"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Brief description of this competitor..."
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="logo">Logo URL</Label>
                    <Input
                      id="logo"
                      type="url"
                      value={formData.logoUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, logoUrl: e.target.value })
                      }
                      placeholder="https://acme.com/logo.png"
                    />
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
                    {submitting ? "Adding..." : "Add Competitor"}
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
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : competitors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-neutral-400" />
              </div>
              <h3 className="font-medium text-lg mb-2">No competitors yet</h3>
              <p className="text-neutral-500 text-center mb-4 max-w-sm">
                Start by adding a competitor to monitor. We'll track their website
                changes and alert you to important updates.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Competitor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {competitors.map((competitor) => (
              <Card
                key={competitor.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={competitor.logoUrl} />
                        <AvatarFallback className="text-lg">
                          {competitor.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/competitors/${competitor.id}`}
                          className="font-semibold hover:text-blue-600 transition-colors"
                        >
                          {competitor.name}
                        </Link>
                        <a
                          href={competitor.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {new URL(competitor.primaryUrl).hostname}
                        </a>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/competitors/${competitor.id}`}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() =>
                            handleDelete(competitor.id, competitor.name)
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {competitor.description && (
                    <p className="text-sm text-neutral-600 mt-3 line-clamp-2">
                      {competitor.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <Badge variant="secondary">
                      {competitor.monitoredUrls.length} URLs
                    </Badge>
                    {(competitor._count.changes > 0 ||
                      competitor._count.announcements > 0) && (
                      <Badge variant="info">
                        {competitor._count.changes + competitor._count.announcements}{" "}
                        unread
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                    <span className="text-xs text-neutral-400">
                      Added {formatRelativeTime(competitor.createdAt)}
                    </span>
                    <Link href={`/competitors/${competitor.id}`}>
                      <Button variant="ghost" size="sm">
                        View Details
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
