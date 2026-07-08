import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelect: (content: string, filename: string) => void;
  isLoading: boolean;
}

export function FileDropZone({ onFileSelect, isLoading }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);

      const files = Array.from(e.dataTransfer.files);
      const xliffFile = files.find(
        (f) => f.name.endsWith('.xlf') || f.name.endsWith('.xliff') || f.name.endsWith('.xml')
      );

      if (!xliffFile) {
        setError('Please drop an XLIFF file (.xlf, .xliff, or .xml)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onFileSelect(content, xliffFile.name);
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(xliffFile);
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onFileSelect(content, file.name);
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(file);
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
        ${
          isDragging
            ? 'border-sky-500 bg-sky-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept=".xlf,.xliff,.xml"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-3">
        {isLoading ? (
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isDragging ? 'bg-sky-100' : 'bg-gray-100'
            }`}
          >
            <Upload
              className={`w-6 h-6 ${isDragging ? 'text-sky-600' : 'text-gray-500'}`}
            />
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700">
            {isLoading ? 'Processing...' : 'Drop XLIFF file here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            or click to browse (.xlf, .xliff, .xml)
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
        <FileText className="w-4 h-4" />
        <span>Supports XLIFF 1.2 and 2.0</span>
      </div>
    </div>
  );
}
