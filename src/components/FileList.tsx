import { formatDistanceToNow } from '@/utils/date';
import { FileText, Trash2, Download, Globe, ChevronDown, Code } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { TranslationFileFormat } from '@/types/xliff';
import { getFormatName } from '@/utils/translation-converter';

interface XliffFileInfo {
  id: string;
  name: string;
  format: string;
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
  onExport: (id: string, format: TranslationFileFormat) => void;
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
  const [exportMenuOpen, setExportMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No translation files yet</p>
        <p className="text-xs mt-1">Upload a file to get started</p>
      </div>
    );
  }

  const getFormatBadge = (format: string) => {
    const colors: Record<string, string> = {
      xliff: 'bg-sky-100 text-sky-700 border-sky-200',
      xliff2: 'bg-sky-100 text-sky-700 border-sky-200',
      po: 'bg-purple-100 text-purple-700 border-purple-200',
      pot: 'bg-purple-100 text-purple-700 border-purple-200',
      mo: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return colors[format] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

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
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 truncate text-sm">
                    {file.name}
                  </h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${getFormatBadge(file.format)}`}>
                    {file.format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {file.source_language.toUpperCase()} → {file.target_language.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportMenuOpen(exportMenuOpen === file.id ? null : file.id);
                    }}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    title="Export"
                    disabled={isLoading}
                  >
                    <Download className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {exportMenuOpen === file.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                      {(['xliff', 'po', 'mo'] as TranslationFileFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={(e) => {
                            e.stopPropagation();
                            onExport(file.id, fmt);
                            setExportMenuOpen(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Code className="w-3 h-3 text-gray-400" />
                          <span>{getFormatName(fmt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
