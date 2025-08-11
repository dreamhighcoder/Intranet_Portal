"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockPublicHolidays } from "@/lib/mock-data"
import { Plus, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import type { PublicHoliday } from "@/lib/types"

export default function PublicHolidaysPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [holidays, setHolidays] = useState(mockPublicHolidays)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newHoliday, setNewHoliday] = useState({
    date: "",
    name: "",
    region: "National",
  })

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  const handleAddHoliday = () => {
    if (newHoliday.date && newHoliday.name) {
      const holiday: PublicHoliday = {
        id: Date.now().toString(),
        date: newHoliday.date,
        name: newHoliday.name,
        region: newHoliday.region,
        source: "Manual",
        created_at: new Date().toISOString(),
      }
      setHolidays([...holidays, holiday])
      setNewHoliday({ date: "", name: "", region: "National" })
      setIsAddDialogOpen(false)
    }
  }

  const handleDeleteHoliday = (id: string) => {
    setHolidays(holidays.filter((h) => h.id !== id))
  }

  const handleImportCSV = () => {
    // Mock CSV import functionality
    console.log("Importing holidays from CSV")
    // In real app, this would open a file picker and parse CSV
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== "admin") return null

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Public Holidays</h1>
          <p className="text-[var(--color-text-secondary)]">
            Manage public holidays for accurate task scheduling and compliance
          </p>
        </div>

        <Card className="card-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Holiday Calendar</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={handleImportCSV} className="bg-transparent">
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Holiday
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Public Holiday</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="holiday-date">Date</Label>
                        <Input
                          id="holiday-date"
                          type="date"
                          value={newHoliday.date}
                          onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="holiday-name">Holiday Name</Label>
                        <Input
                          id="holiday-name"
                          value={newHoliday.name}
                          onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                          placeholder="e.g., Australia Day"
                        />
                      </div>
                      <div>
                        <Label htmlFor="holiday-region">Region</Label>
                        <Select
                          value={newHoliday.region}
                          onValueChange={(value) => setNewHoliday({ ...newHoliday, region: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="National">National</SelectItem>
                            <SelectItem value="NSW">New South Wales</SelectItem>
                            <SelectItem value="VIC">Victoria</SelectItem>
                            <SelectItem value="QLD">Queensland</SelectItem>
                            <SelectItem value="WA">Western Australia</SelectItem>
                            <SelectItem value="SA">South Australia</SelectItem>
                            <SelectItem value="TAS">Tasmania</SelectItem>
                            <SelectItem value="ACT">Australian Capital Territory</SelectItem>
                            <SelectItem value="NT">Northern Territory</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddHoliday}
                          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
                        >
                          Add Holiday
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell>{new Date(holiday.date).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{holiday.name}</div>
                      </TableCell>
                      <TableCell>{holiday.region}</TableCell>
                      <TableCell>{holiday.source}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="text-red-600 hover:text-red-700 bg-transparent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Import Instructions */}
        <Card className="card-surface mt-6">
          <CardHeader>
            <CardTitle>Import Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-[var(--color-text-secondary)] space-y-2">
              <p>To import holidays from a CSV file, ensure your file has the following columns:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>date</strong> - Date in YYYY-MM-DD format
                </li>
                <li>
                  <strong>name</strong> - Holiday name
                </li>
                <li>
                  <strong>region</strong> - Region (National, NSW, VIC, etc.)
                </li>
              </ul>
              <p className="mt-4">
                You can also fetch holidays automatically from the Australian Government API by clicking the Import
                button.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
