"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export interface WeakArea {
  topic: string;
  count: number;
  total: number;
}

interface WeakAreasProps {
  areas: WeakArea[];
}

export function WeakAreas({ areas }: WeakAreasProps) {
  if (areas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weak Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No weak areas identified yet. Keep practicing to get personalized insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Weak Areas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {areas.map((area) => {
            const pct = Math.round((area.count / area.total) * 100);
            return (
              <li key={area.topic} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium">{area.topic}</span>
                  <span className="text-muted-foreground text-xs">
                    {area.count}/{area.total} sessions
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 pt-3 border-t">
          <Link
            href="/coaching"
            className="text-sm text-primary hover:underline"
          >
            View coaching tips to improve
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
