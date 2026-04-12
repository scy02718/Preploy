"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: "behavioral" | "technical";
  config: Record<string, unknown>;
  createdAt: string;
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/templates");
        if (res.ok) setTemplates(await res.json());
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // Silent
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates ({templates.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No templates saved yet. Save one from the interview setup page.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {t.type === "behavioral" ? "BQ" : "TC"}
                  </Badge>
                  <span className="text-sm truncate">{t.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
