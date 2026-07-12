// Minimal type declarations for the Chrome Translator API (not yet in TS DOM lib)
type TranslatorAvailability = 'available' | 'downloadable' | 'downloading' | 'unsupported';

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslatorInstance {
  translate: (text: string) => Promise<string>;
  destroy: () => void;
}

interface TranslatorConstructor {
  create: (options: TranslatorOptions) => Promise<TranslatorInstance>;
  availability: (options: TranslatorOptions) => Promise<TranslatorAvailability>;
}

interface TranslatorGlobal {
  Translator: TranslatorConstructor;
}

type NavigatorWithTranslator = Navigator & {
  ai?: {
    translator?: TranslatorConstructor;
  };
};

function getTranslatorAPI(): TranslatorConstructor | null {
  const w = window as unknown as TranslatorGlobal;
  const n = navigator as NavigatorWithTranslator;
  return w.Translator || n.ai?.translator || null;
}

export function isTranslatorSupported(): boolean {
  return getTranslatorAPI() !== null;
}

export async function checkAvailability(
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslatorAvailability> {
  const API = getTranslatorAPI();
  if (!API) return 'unsupported';
  try {
    return await API.availability({ sourceLanguage, targetLanguage });
  } catch {
    return 'unsupported';
  }
}

export interface TranslatorProgress {
  loaded: number;
}

export async function createTranslator(
  sourceLanguage: string,
  targetLanguage: string,
  onProgress?: (progress: TranslatorProgress) => void
): Promise<TranslatorInstance> {
  const API = getTranslatorAPI();
  if (!API) {
    throw new Error('Browser Translator API is not available in this browser.');
  }

  const availability = await API.availability({ sourceLanguage, targetLanguage });
  if (availability === 'unsupported') {
    throw new Error(
      `Translation from "${sourceLanguage}" to "${targetLanguage}" is not supported by the browser.`
    );
  }

  const translator = await API.create({ sourceLanguage, targetLanguage });

  // Listen for download progress if supported
  if (onProgress && 'addEventListener' in (translator as unknown as EventTarget)) {
    (translator as unknown as EventTarget).addEventListener(
      'downloadprogress',
      (e: Event) => {
        const progressEvent = e as ProgressEvent;
        if (progressEvent.lengthComputable) {
          onProgress({ loaded: progressEvent.loaded });
        }
      }
    );
  }

  return translator;
}

export async function translateText(
  translator: TranslatorInstance,
  text: string
): Promise<string> {
  if (!text.trim()) return text;
  return translator.translate(text);
}

export function destroyTranslator(translator: TranslatorInstance): void {
  try {
    translator.destroy();
  } catch {
    // ignore
  }
}

// Common language list for the picker dropdown
export const SUPPORTED_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'cs', name: 'Czech' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'et', name: 'Estonian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'fa', name: 'Persian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'sw', name: 'Swahili' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanian' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'ga', name: 'Irish' },
  { code: 'cy', name: 'Welsh' },
  { code: 'mt', name: 'Maltese' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'eu', name: 'Basque' },
  { code: 'gl', name: 'Galician' },
  { code: 'fo', name: 'Faroese' },
  { code: 'km', name: 'Khmer' },
  { code: 'lo', name: 'Lao' },
  { code: 'my', name: 'Burmese' },
  { code: 'si', name: 'Sinhala' },
  { code: 'am', name: 'Amharic' },
  { code: 'ne', name: 'Nepali' },
  { code: 'ka', name: 'Georgian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'tg', name: 'Tajik' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'yi', name: 'Yiddish' },
];
