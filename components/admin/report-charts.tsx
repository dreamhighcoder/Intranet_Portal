"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

// Mock data for charts
const missedTasksByPosition = [
  { position: "Pharmacist", missed: 3 },
  { position: "Assistant", missed: 8 },
  { position: "Manager", missed: 2 },
]

const completionRateData = [
  { week: "Week 1", rate: 85 },
  { week: "Week 2", rate: 92 },
  { week: "Week 3", rate: 88 },
  { week: "Week 4", rate: 95 },
  { week: "Week 5", rate: 87 },
  { week: "Week 6", rate: 91 },
]

const taskStatusData = [
  { name: "Completed", value: 156, color: "#4CAF50" },
  { name: "Missed", value: 23, color: "#F44336" },
  { name: "Overdue", value: 12, color: "#FF9800" },
  { name: "Due Today", value: 8, color: "#2196F3" },
]

export function ReportCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Missed Tasks by Position */}
      <Card className="card-surface">
        <CardHeader>
          <CardTitle>Missed Tasks by Position (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={missedTasksByPosition}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="position" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="missed" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Task Status Distribution */}
      <Card className="card-surface">
        <CardHeader>
          <CardTitle>Task Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={taskStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {taskStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Completion Rate Trend */}
      <Card className="card-surface lg:col-span-2">
        <CardHeader>
          <CardTitle>Completion Rate Trend (Last 12 Weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={completionRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, "Completion Rate"]} />
              <Line type="monotone" dataKey="rate" stroke="var(--color-secondary)" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
