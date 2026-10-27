'use client'

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  type: string
  isPublic: boolean
  isFreeTier: boolean
  createdAt: string
  createdBy: {
    name: string | null
    email: string
  } | null
}

export default function AdminTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [jsonFile, setJsonFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/")
    } else if (status === "authenticated" && session?.user?.role === "ADMIN") {
      fetchTemplates()
    }
  }, [status, session, router])

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/templates")
      const data = await res.json()
      setTemplates(data)
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      await fetch(`/api/admin/templates?id=${id}`, { method: "DELETE" })
      fetchTemplates()
    } catch (error) {
      console.error("Error deleting template:", error)
    }
  }

  const togglePublic = async (template: Template) => {
    try {
      await fetch("/api/admin/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, isPublic: !template.isPublic }),
      })
      fetchTemplates()
    } catch (error) {
      console.error("Error updating template:", error)
    }
  }

  const toggleFreeTier = async (template: Template) => {
    try {
      await fetch("/api/admin/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, isFreeTier: !template.isFreeTier }),
      })
      fetchTemplates()
    } catch (error) {
      console.error("Error updating template free tier:", error)
    }
  }

  const createTemplateFromJson = async () => {
    setSubmitError(null)

    if (!jsonFile) {
      setSubmitError("Select a .json file to upload.")
      return
    }

    let payload: any
    try {
      const text = await jsonFile.text()
      payload = JSON.parse(text)
    } catch {
      setSubmitError("Invalid JSON file. Please fix and try again.")
      return
    }

    if (Array.isArray(payload)) {
      payload = { templates: payload }
    }

    try {
      setIsSubmitting(true)
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data?.error || "Failed to upload template.")
        return
      }

      setJsonFile(null)
      setIsDialogOpen(false)
      fetchTemplates()
    } catch (error) {
      console.error("Error uploading template:", error)
      setSubmitError("Failed to upload template.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-white">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Templates</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Upload Template JSON</DialogTitle>
              <DialogDescription>
                Upload a .json file containing a single template object or an array of templates.
                The payload should include `name` and `data.blocks`.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setJsonFile(file)
                }}
                className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-gray-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700"
              />
              {jsonFile && (
                <div className="text-xs text-gray-400">Selected: {jsonFile.name}</div>
              )}
              {submitError && (
                <div className="text-sm text-red-400">{submitError}</div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createTemplateFromJson} disabled={isSubmitting}>
                {isSubmitting ? "Uploading..." : "Upload Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-gray-900 rounded-xl border border-gray-800 p-4"
          >
            <div className="flex items-start justify-between mb-2 gap-2">
              <h3 className="font-semibold text-white">{template.name}</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    template.isPublic
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {template.isPublic ? "Public" : "Private"}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    template.isFreeTier
                      ? "bg-sky-500/20 text-sky-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {template.isFreeTier ? "Free Users" : "Premium"}
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
              {template.description || "No description"}
            </p>
            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <span>{template.category}</span>
              <span>{template.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePublic(template)}
                className="text-gray-400 hover:text-white"
              >
                {template.isPublic ? "Make Private" : "Make Public"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFreeTier(template)}
                className="text-sky-300 hover:text-sky-200"
              >
                {template.isFreeTier ? "Make Premium" : "Allow Free Users"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteTemplate(template.id)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
