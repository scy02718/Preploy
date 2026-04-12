"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface ScoreTrendPoint {
  date: string;
  score: number;
  type: "behavioral" | "technical";
}

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

interface ChartDataPoint {
  date: string;
  behavioral?: number;
  technical?: number;
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No score data yet. Complete some sessions to see your progress.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform into chart-ready format: each date has behavioral/technical columns
  const chartMap = new Map<string, ChartDataPoint>();
  for (const point of data) {
    const existing = chartMap.get(point.date) ?? { date: point.date };
    existing[point.type] = point.score;
    chartMap.set(point.date, existing);
  }
  const chartData = Array.from(chartMap.values());

  const hasBehavioral = data.some((d) => d.type === "behavioral");
  const hasTechnical = data.some((d) => d.type === "technical");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                color: "hsl(var(--card-foreground))",
              }}
            />
            <Legend />
            {hasBehavioral && (
              <Line
                type="monotone"
                dataKey="behavioral"
                name="Behavioral"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            )}
            {hasTechnical && (
              <Line
                type="monotone"
                dataKey="technical"
                name="Technical"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
