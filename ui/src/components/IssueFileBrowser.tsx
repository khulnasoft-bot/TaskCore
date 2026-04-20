import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { buildFileTree, PackageFileTree } from "./PackageFileTree";
import { Loader2, Search, FileX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { queryKeys } from "../lib/queryKeys";

interface IssueFileBrowserProps {
  executionWorkspaceId: string;
}

export const IssueFileBrowser: React.FC<IssueFileBrowserProps> = ({
  executionWorkspaceId
}) => {
  const [filter, setFilter] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const { data: files, isLoading, error } = useQuery({
    queryKey: ["execution-workspaces", executionWorkspaceId, "files"],
    queryFn: () => executionWorkspacesApi.listFiles(executionWorkspaceId),
    enabled: !!executionWorkspaceId,
  });

  const fileTree = useMemo(() => {
    if (!files) return [];
    
    // Transform array of strings into the Record<string, unknown> expected by buildFileTree
    const filesObj: Record<string, unknown> = {};
    files.forEach(f => {
      if (filter && !f.toLowerCase().includes(filter.toLowerCase())) return;
      filesObj[f] = {};
    });
    
    return buildFileTree(filesObj);
  }, [files, filter]);

  const handleToggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Loading workspace files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-100 bg-red-50 rounded-xl">
        <p className="text-sm text-red-600">Failed to load files from workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files..."
          className="pl-10 bg-white border-slate-200"
        />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {fileTree.length > 0 ? (
          <div className="p-2 max-h-[500px] overflow-y-auto">
            <PackageFileTree
              nodes={fileTree}
              selectedFile={null}
              expandedDirs={expandedDirs}
              onToggleDir={handleToggleDir}
              onSelectFile={(path) => {
                // Future: handle file selection/viewing
                console.log("Selected file:", path);
              }}
              showCheckboxes={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <FileX className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No files found matching filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
