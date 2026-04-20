import React, { useState } from "react";
import { 
  File, 
  FileText, 
  Image as ImageIcon, 
  MoreVertical, 
  Download, 
  ExternalLink,
  Eye,
  History,
  FileCode,
  Box
} from "lucide-react";
import type { IssueArtifact } from "@taskcore/shared";
import { cn, formatBytes, relativeTime } from "../lib/utils";

interface IssueArtifactListProps {
  artifacts: IssueArtifact[];
  onDownload?: (artifact: IssueArtifact) => void;
  onPreview?: (artifact: IssueArtifact) => void;
  onViewHistory?: (artifact: IssueArtifact) => void;
}

export const IssueArtifactList: React.FC<IssueArtifactListProps> = ({
  artifacts,
  onDownload,
  onPreview,
  onViewHistory
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (mimeType.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
    if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json")) 
      return <FileCode className="w-4 h-4 text-amber-500" />;
    if (mimeType.includes("markdown")) return <FileText className="w-4 h-4 text-blue-400" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <Box className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500 font-medium">No artifacts generated yet</p>
        <p className="text-xs text-slate-400 mt-1">Agent generated files will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className={cn(
            "group relative flex items-start p-3 gap-3 rounded-xl border border-slate-200 bg-white transition-all duration-200",
            "hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/5",
            hoveredId === artifact.id ? "ring-1 ring-blue-100" : ""
          )}
          onMouseEnter={() => setHoveredId(artifact.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
            {getFileIcon(artifact.mimeType)}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h4 className="text-sm font-semibold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
              {artifact.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                v{artifact.version}
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {formatBytes(artifact.sizeBytes)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Updated {relativeTime(artifact.updatedAt)}
            </p>
          </div>

          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onPreview?.(artifact)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors"
              title="Quick Look"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDownload?.(artifact)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewHistory?.(artifact)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors"
              title="Version History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
