import { formatDistanceToNow } from '@/utils/date';
import { FileText, Trash2, Download, Globe } from 'lucide-react';

interface XliffFileInfo {
  id: string;
  name: string;
  source_language: string;
  target_language: string;
  unit_count: number;
  translated_count: number;
  updated_at: string;
}

interface FileListProps {
  files: XliffFileInfo[];
  onSelect: (file: XliffFileInfo) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  selectedId?: string;
  isLoading: boolean;
}

export function FileList({
  files,
  onSelect,
  onDelete,
  onExport,
  selectedId,
  isLoading,
}: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No XLIFF files yet</p>
        <p className="text-xs mt-1">Upload a file to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const progress = file.unit_count > 0
          ? Math.round((file.translated_count / file.unit_count) * 100)
          : 0;
        const isSelected = file.id === selectedId;

        return (
          <div
            key={file.id}
            className={`
              group relative p-4 rounded-lg border transition-all cursor-pointer
              ${
                isSelected
                  ? 'border-sky-500 bg-sky-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }
            `}
            onClick={() => onSelect(file)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate text-sm">
                  {file.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {file.source_language.toUpperCase()} → {file.target_language.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(file.id);
                  }}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="Export"
                  disabled={isLoading}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file.id);
                  }}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                  title="Delete"
                  disabled={isLoading}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Progress</span>
                <span className="font-medium text-gray-700">
                  {file.translated_count} / {file.unit_count}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    progress === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Updated {formatDistanceToNow(new Date(file.updated_at))}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
