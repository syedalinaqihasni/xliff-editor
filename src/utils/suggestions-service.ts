import type { AISuggestion } from '@/types/xliff';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface SuggestionResponse {
  suggestions: AISuggestion[];
}

export async function fetchSuggestions(
  sourceLanguage: string,
  targetLanguage: string,
  source: string,
  context?: string
): Promise<AISuggestion[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/translate-suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        sourceLanguage,
        targetLanguage,
        source,
        context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const data: SuggestionResponse = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Failed to fetch suggestions:', error);
    return [];
  }
}
