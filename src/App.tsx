import { useState, useCallback, useEffect } from 'react';
import { FileText, Languages, Menu, X, Download, Upload, ArrowLeft, Loader2 } from 'lucide-react';
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
  exportXliffFile,
  updateTranslationUnit,
  addToTranslationMemory,
  updateFileProgress,
} from '@/utils/file-service';

interface XliffFileInfo {
  id: string;
  name: string;
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

export default function App() {
  const [files, setFiles] = useState<XliffFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<XliffFileInfo | null>(null);
  const [translationUnits, setTranslationUnits] = useState<TranslationUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listXliffFiles();
      setFiles(data.map(f => ({
        id: f.id,
        name: f.name,
        source_language: f.source_language,
        target_language: f.target_language,
        unit_count: f.unit_count,
        translated_count: f.translated_count,
        updated_at: f.updated_at,
      })));
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    async (content: string, filename: string) => {
      setUploading(true);
      setError(null);
      try {
        const { name, document } = parseXliffFile(content, filename);
        const saved = await saveXliffFile(name, document);
        await loadFiles();
        const fileInfo: XliffFileInfo = {
          id: saved.id,
          name: saved.name,
          source_language: saved.source_language,
          target_language: saved.target_language,
          unit_count: saved.unit_count,
          translated_count: saved.translated_count,
          updated_at: saved.updated_at,
        };
        handleSelectFile(fileInfo);
      } catch (err) {
        console.error('Failed to upload file:', err);
        setError(err instanceof Error ? err.message : 'Failed to parse XLIFF file');
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
    async (id: string) => {
      setExporting(true);
      try {
        const content = await exportXliffFile(id);
        const file = files.find((f) => f.id === id);
        const filename = `${file?.name || 'translation'}.xlf`;

        const blob = new Blob([content], { type: 'application/xml' });
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
        setExporting(false);
      }
    },
    [files]
  );

  const handleUpdateUnit = useCallback(
    async (id: string, target: string, state: string) => {
      await updateTranslationUnit(id, target, state);
      setTranslationUnits((prev) =>
        prev.map((u) => (u.id === id ? { ...u, target, state } : u))
      );
      // Update file progress
      if (selectedFile) {
        await updateFileProgress(selectedFile.id);
        const updated = await getXliffFile(selectedFile.id);
        if (updated) {
          setSelectedFile(updated);
          setFiles((prev) =>
            prev.map((f) => (f.id === updated.id ? updated : f))
          );
        }
      }
    },
    [selectedFile]
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

  // Calculate progress for current file
  const progress = selectedFile
    ? {
        percent:
          selectedFile.unit_count > 0
            ? Math.round(
                (selectedFile.translated_count / selectedFile.unit_count) * 100
              )
            : 0,
        translated: selectedFile.translated_count,
        total: selectedFile.unit_count,
      }
    : null;

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`
          ${
            sidebarOpen ? 'w-80' : 'w-16'
          } transition-all duration-300 flex flex-col bg-white border-r border-gray-200 shrink-0
        `}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Languages className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">XLIFF Editor</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-100 rounded"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4 text-gray-500" />
            ) : (
              <Menu className="w-4 h-4 text-gray-500" />
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
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <FileList
                files={files}
                onSelect={handleSelectFile}
                onDelete={handleDeleteFile}
                onExport={handleExport}
                selectedId={selectedFile?.id}
                isLoading={exporting}
              />
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
          {selectedFile ? (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="p-1.5 hover:bg-gray-100 rounded"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div>
                  <h1 className="font-medium text-gray-900 text-sm">
                    {selectedFile.name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
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
              <button
                onClick={() => handleExport(selectedFile.id)}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export XLIFF
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Select a file to view translations</span>
            </div>
          )}
        </header>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-red-600">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedFile ? (
            loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <TranslationEditor
                units={translationUnits}
                sourceLanguage={selectedFile.source_language}
                targetLanguage={selectedFile.target_language}
                onUpdateUnit={handleUpdateUnit}
                onAddToMemory={handleAddToMemory}
              />
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <div className="w-20 h-20 bg-gradient-to-br from-sky-100 to-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                <Languages className="w-10 h-10 text-sky-500" />
              </div>
              <h2 className="text-lg font-medium text-gray-700 mb-2">
                XLIFF Translation Editor
              </h2>
              <p className="text-sm text-gray-500 text-center max-w-md">
                Import XLIFF files to translate content with AI-powered suggestions.
                Your translations are saved automatically and can be exported at any time.
              </p>
              <div className="flex items-center gap-4 mt-6 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  Import XLIFF
                </span>
                <span className="flex items-center gap-1">
                  <Languages className="w-4 h-4" />
                  AI Suggestions
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  Export XLIFF
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
