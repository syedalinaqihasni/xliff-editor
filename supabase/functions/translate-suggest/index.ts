import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sourceLanguage, targetLanguage, source, context } = await req.json();

    if (!sourceLanguage || !targetLanguage || !source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search translation memory for exact and fuzzy matches
    const { data: exactMatches } = await supabase
      .from('translation_memory')
      .select('target, usage_count')
      .eq('source_language', sourceLanguage)
      .eq('target_language', targetLanguage)
      .eq('source', source)
      .order('usage_count', { ascending: false })
      .limit(5);

    // Search for similar translations (contains the source text or contained by it)
    const { data: fuzzyMatches } = await supabase
      .from('translation_memory')
      .select('source, target, usage_count')
      .eq('source_language', sourceLanguage)
      .eq('target_language', targetLanguage)
      .or(`source.ilike.%${source}%,source.cs.%${source}%`)
      .neq('source', source)
      .order('usage_count', { ascending: false })
      .limit(10);

    const suggestions: Array<{
      id: string;
      translation: string;
      confidence: number;
      source: 'memory' | 'ai' | 'rules';
      explanation?: string;
    }> = [];

    // Add exact matches with high confidence
    if (exactMatches && exactMatches.length > 0) {
      exactMatches.forEach((match, index) => {
        suggestions.push({
          id: `mem-exact-${index}`,
          translation: match.target,
          confidence: 0.95,
          source: 'memory',
          explanation: 'Exact match from translation memory',
        });
      });
    }

    // Add fuzzy matches with medium confidence
    if (fuzzyMatches && fuzzyMatches.length > 0) {
      fuzzyMatches.slice(0, 3).forEach((match, index) => {
        suggestions.push({
          id: `mem-fuzzy-${index}`,
          translation: match.target,
          confidence: 0.6,
          source: 'memory',
          explanation: `Similar source: "${match.source.substring(0, 50)}..."`,
        });
      });
    }

    // Generate AI-like suggestions based on patterns
    const generatedSuggestions = generatePatternBasedSuggestions(
      source,
      sourceLanguage,
      targetLanguage
    );
    generatedSuggestions.forEach((suggestion, index) => {
      suggestions.push({
        id: `ai-${index}`,
        translation: suggestion.translation,
        confidence: suggestion.confidence,
        source: 'ai',
        explanation: suggestion.explanation,
      });
    });

    // If we have no suggestions, provide a placeholder
    if (suggestions.length === 0) {
      suggestions.push({
        id: 'placeholder',
        translation: '',
        confidence: 0,
        source: 'ai',
        explanation: 'No translation available - please translate manually',
      });
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generatePatternBasedSuggestions(
  source: string,
  sourceLanguage: string,
  targetLanguage: string
): Array<{ translation: string; confidence: number; explanation: string }> {
  const suggestions: Array<{ translation: string; confidence: number; explanation: string }> = [];

  // Simple placeholder suggestions for common patterns
  // In a real implementation, this would call a translation API

  if (isUrl(source)) {
    suggestions.push({
      translation: source,
      confidence: 0.9,
      explanation: 'URLs are typically not translated',
    });
  }

  if (isNumber(source.trim())) {
    suggestions.push({
      translation: source,
      confidence: 0.95,
      explanation: 'Numbers are typically not translated',
    });
  }

  if (isCodeOrVariable(source)) {
    suggestions.push({
      translation: source,
      confidence: 0.85,
      explanation: 'Code variables are typically not translated',
    });
  }

  // Add context-aware suggestions based on common translation patterns
  if (sourceLanguage === 'en' && targetLanguage === 'es') {
    const commonTranslations: Record<string, string> = {
      'Hello': 'Hola',
      'Welcome': 'Bienvenido',
      'Settings': 'Configuración',
      'Save': 'Guardar',
      'Cancel': 'Cancelar',
      'Delete': 'Eliminar',
      'Edit': 'Editar',
      'Add': 'Agregar',
      'Search': 'Buscar',
      'Submit': 'Enviar',
      'OK': 'Aceptar',
      'Yes': 'Sí',
      'No': 'No',
      'Close': 'Cerrar',
      'Open': 'Abrir',
    };

    const lowerSource = source.trim();
    if (commonTranslations[lowerSource]) {
      suggestions.push({
        translation: commonTranslations[lowerSource],
        confidence: 0.7,
        explanation: 'Common UI term',
      });
    }
  }

  if (sourceLanguage === 'en' && targetLanguage === 'fr') {
    const commonTranslations: Record<string, string> = {
      'Hello': 'Bonjour',
      'Welcome': 'Bienvenue',
      'Settings': 'Paramètres',
      'Save': 'Enregistrer',
      'Cancel': 'Annuler',
      'Delete': 'Supprimer',
      'Edit': 'Modifier',
      'Add': 'Ajouter',
      'Search': 'Rechercher',
      'Submit': 'Soumettre',
      'OK': 'OK',
      'Yes': 'Oui',
      'No': 'Non',
      'Close': 'Fermer',
      'Open': 'Ouvrir',
    };

    const lowerSource = source.trim();
    if (commonTranslations[lowerSource]) {
      suggestions.push({
        translation: commonTranslations[lowerSource],
        confidence: 0.7,
        explanation: 'Common UI term',
      });
    }
  }

  if (sourceLanguage === 'en' && targetLanguage === 'de') {
    const commonTranslations: Record<string, string> = {
      'Hello': 'Hallo',
      'Welcome': 'Willkommen',
      'Settings': 'Einstellungen',
      'Save': 'Speichern',
      'Cancel': 'Abbrechen',
      'Delete': 'Löschen',
      'Edit': 'Bearbeiten',
      'Add': 'Hinzufügen',
      'Search': 'Suchen',
      'Submit': 'Absenden',
      'OK': 'OK',
      'Yes': 'Ja',
      'No': 'Nein',
      'Close': 'Schließen',
      'Open': 'Öffnen',
    };

    const lowerSource = source.trim();
    if (commonTranslations[lowerSource]) {
      suggestions.push({
        translation: commonTranslations[lowerSource],
        confidence: 0.7,
        explanation: 'Common UI term',
      });
    }
  }

  return suggestions;
}

function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

function isNumber(text: string): boolean {
  return !isNaN(parseFloat(text)) && isFinite(parseFloat(text));
}

function isCodeOrVariable(text: string): boolean {
  return /^[{[]/.test(text) ||
         /\{.*\}/.test(text) ||
         /\$\{/.test(text) ||
         /^[%{]/.test(text) ||
         /%\d/.test(text) ||
         /\{\d+\}/.test(text);
}
