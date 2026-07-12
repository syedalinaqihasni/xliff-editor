import { useState, useCallback, useEffect } from 'react';
import {
  FileText,
  Languages,
  Menu,
  X,
  Download,
  Upload,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Code,
  Moon,
  Sun,
} from 'lucide-react';
import { FileDropZone } from '@/components/FileDropZone';
import { FileList } from '@/components/FileList';
import { TranslationEditor } from '@/components/TranslationEditor';
import {
  parseXliffFile,
  saveXliffFile,
  listXliffFiles,
  getXliffFile,
  getTranslationUnits,
  deleteXliffFile,
  exportFile,
  updateTranslationUnit,
  addToTranslationMemory,
  updateFileProgress,
  batchUpdateTranslationUnits,
} from '@/utils/file-service';
import type { TranslationFileFormat } from '@/types/xliff';
import { getFormatExtension, getFormatName } from '@/utils/translation-converter';

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

interface TranslationUnitRow {
  id: string;
  xliff_file_id: string;
  unit_id: string;
  resname: string | null;
  source: string;
  target: string | null;
  state: string;
  note: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

const THEME_STORAGE_KEY = 'translation-editor-theme';

export default function App() {
  const [files, setFiles] = useState<XliffFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<XliffFileInfo | null>(null);
  const [translationUnits, setTranslationUnits] = useState<TranslationUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') {
      setDarkMode(true);
    } else if (stored === 'light') {
      setDarkMode(false);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listXliffFiles();
      setFiles(
        data.map((f) => ({
          id: f.id,
          name: f.name,
          format: f.format,
          source_language: f.source_language,
          target_language: f.target_language,
          unit_count: f.unit_count,
          translated_count: f.translated_count,
          updated_at: f.updated_at,
        }))
      );
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    async (content: string | ArrayBuffer, filename: string, isBinary?: boolean) => {
      setUploading(true);
      setError(null);
      try {
        const { document } = parseXliffFile(
          isBinary ? (content as ArrayBuffer) : (content as string),
          filename
        );
        const saved = await saveXliffFile(document);
        await loadFiles();
        const fileInfo: XliffFileInfo = {
          id: saved.id,
          name: saved.name,
          format: saved.format,
          source_language: saved.source_language,
          target_language: saved.target_language,
          unit_count: saved.unit_count,
          translated_count: saved.translated_count,
          updated_at: saved.updated_at,
        };
        handleSelectFile(fileInfo);
      } catch (err) {
        console.error('Failed to upload file:', err);
        setError(err instanceof Error ? err.message : 'Failed to parse translation file');
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const handleSelectFile = useCallback(async (file: XliffFileInfo) => {
    setSelectedFile(file);
    setLoading(true);
    try {
      const units = await getTranslationUnits(file.id);
      setTranslationUnits(units);
    } catch (err) {
      console.error('Failed to load units:', err);
      setError('Failed to load translation units');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteFile = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this file?')) return;
      try {
        await deleteXliffFile(id);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        if (selectedFile?.id === id) {
          setSelectedFile(null);
          setTranslationUnits([]);
        }
      } catch (err) {
        console.error('Failed to delete:', err);
        setError('Failed to delete file');
      }
    },
    [selectedFile]
  );

  const handleExport = useCallback(
    async (id: string, format: TranslationFileFormat) => {
      setExporting(id + format);
      try {
        const { content, filename } = await exportFile(id, format);

        const mimeType = format === 'mo' ? 'application/octet-stream' : 'text/plain';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to export:', err);
        setError('Failed to export file');
      } finally {
        setExporting(null);
      }
    },
    []
  );

  const refreshFileProgress = useCallback(async (fileId: string) => {
    try {
      await updateFileProgress(fileId);
      const updated = await getXliffFile(fileId);
      if (updated) {
        const fileInfo: XliffFileInfo = {
          id: updated.id,
          name: updated.name,
          format: updated.format,
          source_language: updated.source_language,
          target_language: updated.target_language,
          unit_count: updated.unit_count,
          translated_count: updated.translated_count,
          updated_at: updated.updated_at,
        };
        setSelectedFile(fileInfo);
        setFiles((prev) => prev.map((f) => (f.id === updated.id ? fileInfo : f)));
      }
    } catch (err) {
      console.error('Failed to refresh progress:', err);
      // Non-fatal: don't blank the screen
    }
  }, []);

  const handleUpdateUnit = useCallback(
    async (id: string, target: string, state: string) => {
      await updateTranslationUnit(id, target, state);
      setTranslationUnits((prev) =>
        prev.map((u) => (u.id === id ? { ...u, target, state } : u))
      );
      if (selectedFile) {
        // Fire-and-forget: refresh progress without blocking the UI
        refreshFileProgress(selectedFile.id);
      }
    },
    [selectedFile, refreshFileProgress]
  );

  const handleSaveAll = useCallback(
    async (updates: { id: string; target: string; state: string }[]) => {
      await batchUpdateTranslationUnits(updates);
      setTranslationUnits((prev) => {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        return prev.map((u) => {
          const upd = updateMap.get(u.id);
          return upd ? { ...u, target: upd.target, state: upd.state } : u;
        });
      });
      if (selectedFile) {
        await refreshFileProgress(selectedFile.id);
      }
    },
    [selectedFile, refreshFileProgress]
  );

  const handleAddToMemory = useCallback(
    async (source: string, target: string) => {
      if (!selectedFile) return;
      try {
        await addToTranslationMemory(
          selectedFile.source_language,
          selectedFile.target_language,
          source,
          target
        );
      } catch (err) {
        console.error('Failed to add to memory:', err);
      }
    },
    [selectedFile]
  );

  const handleBack = useCallback(() => {
    setSelectedFile(null);
    setTranslationUnits([]);
  }, []);

  const progress = selectedFile
    ? {
        percent:
          selectedFile.unit_count > 0
            ? Math.round((selectedFile.translated_count / selectedFile.unit_count) * 100)
            : 0,
        translated: selectedFile.translated_count,
        total: selectedFile.unit_count,
      }
    : null;

  const exportFormats: TranslationFileFormat[] = ['xliff', 'po', 'mo'];

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'w-80' : 'w-16'}
          transition-all duration-300 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shrink-0
        `}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Languages className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                Translation Editor
              </span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <Menu className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>

        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <FileDropZone onFileSelect={handleFileSelect} isLoading={uploading} />
            </div>

            {loading && files.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
              </div>
            ) : (
              <FileList
                files={files}
                onSelect={handleSelectFile}
                onDelete={handleDeleteFile}
                onExport={handleExport}
                selectedId={selectedFile?.id}
                isLoading={exporting !== null}
              />
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 shrink-0">
          {selectedFile ? (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      {selectedFile.name}
                    </h1>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${
                        selectedFile.format === 'po' || selectedFile.format === 'pot'
                          ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700'
                          : selectedFile.format === 'mo'
                            ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700'
                            : 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700'
                      }`}
                    >
                      {selectedFile.format.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {selectedFile.source_language.toUpperCase()} →{' '}
                      {selectedFile.target_language.toUpperCase()}
                    </span>
                    {progress && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {progress.percent}% complete
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setExportMenuOpen(!exportMenuOpen)}
                    disabled={exporting !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50"
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Export
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                      {exportFormats.map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => {
                            handleExport(selectedFile.id, fmt);
                            setExportMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200"
                        >
                          <Code className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <span>{getFormatName(fmt)}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                            {getFormatExtension(fmt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Select a file to view translations</span>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          )}
        </header>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedFile && !loading ? (
            <TranslationEditor
              units={translationUnits}
              sourceLanguage={selectedFile.source_language}
              targetLanguage={selectedFile.target_language}
              onUpdateUnit={handleUpdateUnit}
              onAddToMemory={handleAddToMemory}
              onSaveAll={handleSaveAll}
            />
          ) : selectedFile && loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500" />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="w-20 h-20 bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/40 dark:to-emerald-900/40 rounded-2xl flex items-center justify-center mb-4">
                <Languages className="w-10 h-10 text-sky-500 dark:text-sky-400" />
              </div>
              <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
                Translation File Editor
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md px-4">
                Import translation files (XLIFF, PO/POT, or MO) to translate content with
                AI-powered suggestions. Your translations are saved automatically and can be
                exported to any format.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  Import
                </span>
                <span className="flex items-center gap-1">
                  <Languages className="w-4 h-4" />
                  AI Suggestions
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  Multiple Formats
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs text-gray-400 dark:text-gray-600">
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">.xlf</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">.xliff</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">.po</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">.pot</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">.mo</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
