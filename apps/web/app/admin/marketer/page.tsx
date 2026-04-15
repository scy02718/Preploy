"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle, Pencil, Trash2 } from "lucide-react";

interface Post {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  permalink: string;
  classification: string | null;
  summary: string | null;
  postedAt: string;
}

interface Draft {
  id: string;
  postId: string;
  intent: string;
  reply: string;
  status: string;
  createdAt: string;
  post: Post;
}

const DISCARD_REASONS = [
  { value: "spammy", label: "Spammy" },
  { value: "off-topic", label: "Off-topic" },
  { value: "duplicate", label: "Duplicate" },
  { value: "low-quality", label: "Low quality" },
  { value: "other", label: "Other" },
];

function DraftCard({
  draft,
  onApprove,
  onEdit,
  onDiscard,
}: {
  draft: Draft;
  onApprove: (id: string) => Promise<void>;
  onEdit: (id: string, reply: string) => Promise<void>;
  onDiscard: (id: string, reason: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReply, setEditedReply] = useState(draft.reply);
  const [discardReason, setDiscardReason] = useState("");
  const [showDiscard, setShowDiscard] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(draft.id);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await onEdit(draft.id, editedReply);
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (!discardReason) return;
    setLoading(true);
    try {
      await onDiscard(draft.id, discardReason);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs shrink-0">
                r/{draft.post.subreddit}
              </Badge>
              <Badge
                variant={draft.intent === "prepare" ? "default" : "destructive"}
                className="text-xs shrink-0"
              >
                {draft.intent}
              </Badge>
            </div>
            <CardTitle className="text-sm font-medium leading-tight">
              {draft.post.title}
            </CardTitle>
            {draft.post.summary && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                {draft.post.summary}
              </p>
            )}
          </div>
          <a
            href={draft.post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Original post
          </p>
          <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/50 rounded p-2">
            {draft.post.body || "(no body)"}
          </p>
        </div>

        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Draft reply
          </p>
          {isEditing ? (
            <textarea
              className="w-full text-sm border rounded p-2 min-h-[120px] resize-y bg-background"
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
            />
          ) : (
            <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">
              {draft.reply}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={loading}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditedReply(draft.reply);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={loading}
                className="gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Approve &amp; copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={loading}
                className="gap-1"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              {showDiscard ? (
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded border border-input bg-background px-2 text-xs"
                    value={discardReason}
                    onChange={(e) => setDiscardReason(e.target.value)}
                  >
                    <option value="">Reason...</option>
                    {DISCARD_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDiscard}
                    disabled={loading || !discardReason}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowDiscard(false);
                      setDiscardReason("");
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDiscard(true)}
                  disabled={loading}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Discard
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketerAdminPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDrafts = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketer/drafts?page=${p}&limit=20`);
      if (!res.ok) {
        console.error("Failed to fetch drafts", res.status);
        return;
      }
      const data = await res.json();
      setDrafts(data.drafts);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error("Error fetching drafts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts(page);
  }, [page, fetchDrafts]);

  const handleApprove = async (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (draft) {
      try {
        await navigator.clipboard.writeText(draft.reply);
      } catch {
        // clipboard might fail in some browsers — don't block the approve
      }
      window.open(draft.post.permalink, "_blank", "noopener,noreferrer");
    }

    const res = await fetch(`/api/admin/marketer/drafts/${id}/approve`, {
      method: "POST",
    });
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const handleEdit = async (id: string, reply: string) => {
    const res = await fetch(`/api/admin/marketer/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    });
    if (res.ok) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, reply } : d))
      );
    }
  };

  const handleDiscard = async (id: string, reason: string) => {
    const res = await fetch(`/api/admin/marketer/drafts/${id}/discard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const prepareDrafts = drafts.filter((d) => d.intent === "prepare");
  const cheatDrafts = drafts.filter((d) => d.intent === "cheat");

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Marketer Queue</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-muted rounded-lg h-48 w-full"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Marketer Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} pending draft{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No pending drafts</p>
          <p className="text-sm mt-1">
            Run the cron job to fetch new posts and generate drafts.
          </p>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-2 md:gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Prepare
              </Badge>
              <span className="text-sm text-muted-foreground font-normal">
                {prepareDrafts.length} draft{prepareDrafts.length !== 1 ? "s" : ""}
              </span>
            </h2>
            {prepareDrafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prepare drafts pending.</p>
            ) : (
              prepareDrafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onApprove={handleApprove}
                  onEdit={handleEdit}
                  onDiscard={handleDiscard}
                />
              ))
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Badge variant="destructive">Cheat</Badge>
              <span className="text-sm text-muted-foreground font-normal">
                {cheatDrafts.length} draft{cheatDrafts.length !== 1 ? "s" : ""}
              </span>
            </h2>
            {cheatDrafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cheat drafts pending.</p>
            ) : (
              cheatDrafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onApprove={handleApprove}
                  onEdit={handleEdit}
                  onDiscard={handleDiscard}
                />
              ))
            )}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
