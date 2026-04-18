"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Archive, ArchiveX, Trash2 } from "lucide-react";

interface PlanCardMenuProps {
  planId: string;
  isArchived: boolean;
  onArchive: (planId: string, archived: boolean) => Promise<void>;
  onDelete: (planId: string) => Promise<void>;
  /**
   * When true (read-only grandfathered view for free-tier users), the
   * Archive item is hidden because archive is a Pro-gated mutation. Delete
   * stays visible — cleanup of data the user already owns is always
   * allowed.
   */
  isReadOnly?: boolean;
}

export function PlanCardMenu({
  planId,
  isArchived,
  onArchive,
  onDelete,
  isReadOnly = false,
}: PlanCardMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  async function handleArchive() {
    setIsWorking(true);
    try {
      await onArchive(planId, !isArchived);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsWorking(true);
    try {
      await onDelete(planId);
    } finally {
      setIsWorking(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          aria-label="Plan options"
          disabled={isWorking}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isReadOnly && (
            <DropdownMenuItem onClick={handleArchive}>
              {isArchived ? (
                <>
                  <ArchiveX className="h-4 w-4 mr-2" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The plan and all its progress will
              be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isWorking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
