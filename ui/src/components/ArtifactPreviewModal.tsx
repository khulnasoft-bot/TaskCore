import React, { useEffect, useState } from "react";
import { 
  X, 
  Download, 
  ExternalLink, 
  Loader2, 
  FileText, 
  FileCode, 
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import type { IssueArtifact } from "@taskcore/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownBody } from "./MarkdownBody";
import { cn, formatBytes } from "../lib/utils";

interface ArtifactPreviewModalProps {
  artifact: IssueArtifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (artifact: IssueArtifact) => void;
}

export const ArtifactPreviewModal: React.FC<ArtifactPreviewModalProps> = ({
  artifact,
  open,
  onOpenChange,
  onDownload
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && artifact) {
      const isText = artifact.mimeType.startsWith("text/") || 
                     artifact.mimeType === "application/json" || 
                     artifact.mimeType === "application/javascript";
      
      if (isText) {
        setLoading(true);
        setError(null);
        fetch(`/api/artifacts/${artifact.id}/content`)
          .then(res => {
            if (!res.ok) throw new Error("Failed to load content");
            return res.text();
          })
          .then(text => {
            setContent(text);
          })
          .catch(err => {
            setError(err.message);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setContent(null);
      }
    } else {
      setContent(null);
      setError(null);
    }
  }, [open, artifact]);

  if (!artifact) return null;

  const isImage = artifact.mimeType.startsWith("image/");
  const isMarkdown = artifact.mimeType === "text/markdown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
              {isImage ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-slate-500" />}
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">{artifact.title}</DialogTitle>
              <div className="text-[10px] text-slate-400 mt-0.5">
                v{artifact.version} • {formatBytes(artifact.sizeBytes)} • {artifact.mimeType}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload?.(artifact)}
              className="h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-slate-50/50">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              <p className="text-xs text-slate-500">Loading content...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <FileText className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-sm font-semibold text-slate-700">Preview Unavailable</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">{error}</p>
              <Button variant="outline" size="sm" onClick={() => onDownload?.(artifact)} className="mt-4">
                Download to view locally
              </Button>
            </div>
          ) : isImage ? (
            <div className="h-full flex items-center justify-center p-4">
              <img
                src={`/api/artifacts/${artifact.id}/content`}
                alt={artifact.title}
                className="max-w-full max-h-full object-contain shadow-xl rounded-lg"
              />
            </div>
          ) : content !== null ? (
            <ScrollArea className="h-full">
              <div className="p-6">
                {isMarkdown ? (
                  <MarkdownBody>{content}</MarkdownBody>
                ) : (
                  <pre className="text-xs font-mono bg-white p-4 rounded-lg border border-slate-200 overflow-x-auto">
                    {content}
                  </pre>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <FileText className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-sm font-semibold text-slate-700">No Preview Available</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                This file type cannot be previewed directly in the browser.
              </p>
              <Button variant="outline" size="sm" onClick={() => onDownload?.(artifact)} className="mt-4">
                Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
