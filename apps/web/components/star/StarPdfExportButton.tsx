"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { slugify } from "@/lib/slugify";
import type { StarStoryForPDF, StarAnalysisForPDF } from "./StarStoryPDF";

interface StarPdfExportButtonProps {
  story: StarStoryForPDF;
  analyses: StarAnalysisForPDF[];
}

export function StarPdfExportButton({ story, analyses }: StarPdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // Dynamic imports keep the ~500 KB PDF library out of the initial bundle
      const { pdf } = await import("@react-pdf/renderer");
      const { StarStoryPDF } = await import("./StarStoryPDF");

      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const blob = await pdf(
        <StarStoryPDF story={story} analyses={analyses} date={date} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `star-${slugify(story.title)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [story, analyses]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="mr-1.5 h-4 w-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}
