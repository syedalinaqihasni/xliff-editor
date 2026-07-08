import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelect: (content: string | ArrayBuffer, filename: string, isBinary?: boolean) => void;
  isLoading: boolean;
}

const SUPPORTED_EXTENSIONS = ['.xlf', '.xliff', '.xml', '.po', '.pot', '.mo'];
const BINARY_EXTENSIONS = ['.mo'];

export function FileDropZone({ onFileSelect, isLoading }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getExtension = (filename: string): string => {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() : '';
  };

  const isBinary = (filename: string): boolean => {
    const ext = getExtension(filename);
    return BINARY_EXTENSIONS.includes(ext);
  };

  const isSupported = (filename: string): boolean => {
    const ext = getExtension(filename);
    return SUPPORTED_EXTENSIONS.includes(ext);
  };

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
      const file = files.find((f) => isSupported(f.name));

      if (!file) {
        setError(`Please drop a supported file (${SUPPORTED_EXTENSIONS.join(', ')})`);
        return;
      }

      const binary = isBinary(file.name);

      if (binary) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as ArrayBuffer;
          onFileSelect(content, file.name, true);
        };
        reader.onerror = () => {
          setError('Failed to read file');
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          onFileSelect(content, file.name, false);
        };
        reader.onerror = () => {
          setError('Failed to read file');
        };
        reader.readAsText(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      if (!isSupported(file.name)) {
        setError(`Please select a supported file (${SUPPORTED_EXTENSIONS.join(', ')})`);
        return;
      }

      const binary = isBinary(file.name);

      if (binary) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as ArrayBuffer;
          onFileSelect(content, file.name, true);
        };
        reader.onerror = () => {
          setError('Failed to read file');
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          onFileSelect(content, file.name, false);
        };
        reader.onerror = () => {
          setError('Failed to read file');
        };
        reader.readAsText(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200
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
        accept=".xlf,.xliff,.xml,.po,.pot,.mo"
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
            {isLoading ? 'Processing...' : 'Drop translation file here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            or click to browse
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          .xlf / .xliff
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          .po / .pot
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          .mo
        </span>
      </div>
    </div>
  );
}
