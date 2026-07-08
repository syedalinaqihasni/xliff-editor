export interface XliffFile {
  id: string;
  original: string;
  sourceLanguage: string;
  targetLanguage: string;
  datatype: string;
  translationUnits: TranslationUnit[];
}

export interface TranslationUnit {
  id: string;
  resname?: string;
  source: string;
  target?: string;
  state?: 'new' | 'needs-translation' | 'needs-review-translation' | 'translated' | 'final';
  note?: string;
  approved?: boolean;
}

export interface XliffDocument {
  version: string;
  srcLang: string;
  trgLang: string;
  files: XliffFile[];
}

export interface StoredXliffFile {
  id: string;
  name: string;
  content: XliffDocument;
  sourceLanguage: string;
  targetLanguage: string;
  unitCount: number;
  translatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AISuggestion {
  id: string;
  translation: string;
  confidence: number;
  source: 'memory' | 'ai' | 'rules';
  explanation?: string;
}

export interface TranslationMemory {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  source: string;
  target: string;
  context?: string;
  createdAt: string;
}
