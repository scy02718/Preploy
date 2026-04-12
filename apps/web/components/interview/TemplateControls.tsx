"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, FolderOpen } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

interface TemplateControlsProps {
  type: "behavioral" | "technical";
  currentConfig: Record<string, unknown>;
  onLoadTemplate: (config: Record<string, unknown>) => void;
}

export function TemplateControls({
  type,
  currentConfig,
  onLoadTemplate,
}: TemplateControlsProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch(`/api/templates?type=${type}`);
        if (res.ok) setTemplates(await res.json());
      } catch {
        // Silent
      }
    }
    fetchTemplates();
  }, [type]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), type, config: currentConfig }),
      });
      if (res.ok) {
        const template = await res.json();
        setTemplates((prev) => [template, ...prev]);
        setSaveName("");
        setShowSave(false);
        setMessage("Template saved!");
        setTimeout(() => setMessage(null), 2000);
      }
    } catch {
      // Silent
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onLoadTemplate(template.config);
      setMessage(`Loaded "${template.name}"`);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Load Template */}
      {templates.length > 0 && (
        <div className="flex items-center gap-1">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={(v) => { if (v) handleLoad(String(v)); }}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Load template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Save as Template */}
      {showSave ? (
        <div className="flex items-center gap-1">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name..."
            className="h-8 w-40 text-xs"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setShowSave(false);
            }}
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSave} disabled={isSaving || !saveName.trim()}>
            {isSaving ? "..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowSave(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSave(true)}>
          <Save className="mr-1 h-3 w-3" />
          Save as Template
        </Button>
      )}

      {/* Message */}
      {message && (
        <span className="text-xs text-green-600 dark:text-green-400">{message}</span>
      )}
    </div>
  );
}
