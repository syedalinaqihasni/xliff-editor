import { useState, useCallback } from 'react';
import { Check, AlertTriangle, Clock, Edit3, MessageSquare } from 'lucide-react';
import type { Database } from '@/types/database';
import type { AISuggestion } from '@/types/xliff';
import { fetchSuggestions } from '@/utils/suggestions-service';

type TranslationUnitRow = Database['public']['Tables']['translation_units']['Row'];

interface TranslationEditorProps {
  units: TranslationUnitRow[];
  sourceLanguage: string;
  targetLanguage: string;
  onUpdateUnit: (id: string, target: string, state: string) => Promise<void>;
  onAddToMemory: (source: string, target: string) => Promise<void>;
}

interface EditorState {
  editingId: string | null;
  editedTarget: string;
  saving: boolean;
}

const STATE_COLORS: Record<string, { bg: string; text: string; icon: typeof Check }> = {
  new: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock },
  'needs-translation': { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  'needs-review-translation': { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  translated: { bg: 'bg-sky-100', text: 'text-sky-700', icon: Edit3 },
  final: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
};

export function TranslationEditor({
  units,
  sourceLanguage,
  targetLanguage,
  onUpdateUnit,
  onAddToMemory,
}: TranslationEditorProps) {
  const [editorState, setEditorState] = useState<EditorState>({
    editingId: null,
    editedTarget: '',
    saving: false,
  });
  const [suggestions, setSuggestions] = useState<Map<string, AISuggestion[]>>(new Map());
  const [filter, setFilter] = useState<'all' | 'untranslated' | 'review'>('all');

  const loadSuggestions = useCallback(
    async (unitId: string, source: string) => {
      try {
        const result = await fetchSuggestions(sourceLanguage, targetLanguage, source);
        setSuggestions((prev) => {
          const next = new Map(prev);
          next.set(unitId, result);
          return next;
        });
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    },
    [sourceLanguage, targetLanguage]
  );

  const handleStartEdit = useCallback(
    (unit: TranslationUnitRow) => {
      setEditorState({
        editingId: unit.id,
        editedTarget: unit.target || '',
        saving: false,
      });
      if (!suggestions.has(unit.id)) {
        loadSuggestions(unit.id, unit.source);
      }
    },
    [suggestions, loadSuggestions]
  );

  const handleCancelEdit = useCallback(() => {
    setEditorState({ editingId: null, editedTarget: '', saving: false });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editorState.editingId) return;

    setEditorState((prev) => ({ ...prev, saving: true }));
    try {
      const state = editorState.editedTarget.trim() ? 'translated' : 'new';
      await onUpdateUnit(editorState.editingId, editorState.editedTarget, state);

      // Add to translation memory
      const unit = units.find((u) => u.id === editorState.editingId);
      if (unit && editorState.editedTarget.trim()) {
        await onAddToMemory(unit.source, editorState.editedTarget);
      }

      setEditorState({ editingId: null, editedTarget: '', saving: false });
    } catch (error) {
      console.error('Failed to save:', error);
      setEditorState((prev) => ({ ...prev, saving: false }));
    }
  }, [editorState, onUpdateUnit, onAddToMemory, units]);

  const handleApplySuggestion = useCallback(
    (suggestion: AISuggestion) => {
      setEditorState((prev) => ({
        ...prev,
        editedTarget: suggestion.translation,
      }));
    },
    []
  );

  const filteredUnits = units.filter((unit) => {
    if (filter === 'untranslated') {
      return !unit.target || unit.target.trim() === '' || unit.state === 'new';
    }
    if (filter === 'review') {
      return unit.state === 'needs-review-translation' || unit.state === 'needs-translation';
    }
    return true;
  });

  const untranslatedCount = units.filter(
    (u) => !u.target || u.target.trim() === '' || u.state === 'new'
  ).length;
  const reviewCount = units.filter(
    (u) => u.state === 'needs-review-translation' || u.state === 'needs-translation'
  ).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50">
        <h2 className="font-semibold text-gray-900 text-sm">Translation Units</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({units.length})
          </button>
          <button
            onClick={() => setFilter('untranslated')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              filter === 'untranslated'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Untranslated ({untranslatedCount})
          </button>
          <button
            onClick={() => setFilter('review')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              filter === 'review'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Review ({reviewCount})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredUnits.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No translation units found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUnits.map((unit, index) => {
              const stateConfig = STATE_COLORS[unit.state] || STATE_COLORS.new;
              const StateIcon = stateConfig.icon;
              const isEditing = editorState.editingId === unit.id;
              const unitSuggestions = suggestions.get(unit.id) || [];

              return (
                <div
                  key={unit.id}
                  className={`group ${isEditing ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400 font-mono">
                        #{index + 1}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${stateConfig.bg} ${stateConfig.text}`}
                      >
                        <StateIcon className="w-3 h-3" />
                        {unit.state || 'new'}
                      </span>
                      {unit.resname && (
                        <span className="text-xs text-gray-500 truncate">
                          {unit.resname}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-400 mt-1 w-8 shrink-0">
                          {sourceLanguage.toUpperCase()}
                        </span>
                        <div className="flex-1 p-2 bg-gray-100 rounded text-sm text-gray-800">
                          {unit.source}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-gray-400 mt-1 w-8 shrink-0">
                              {targetLanguage.toUpperCase()}
                            </span>
                            <textarea
                              value={editorState.editedTarget}
                              onChange={(e) =>
                                setEditorState((prev) => ({
                                  ...prev,
                                  editedTarget: e.target.value,
                                }))
                              }
                              className="flex-1 p-2 border border-sky-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                              rows={3}
                              autoFocus
                              placeholder="Enter translation..."
                            />
                          </div>

                          {unitSuggestions.length > 0 && (
                            <div className="ml-10 space-y-2">
                              <p className="text-xs text-gray-500 font-medium">
                                Suggestions
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {unitSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    onClick={() => handleApplySuggestion(suggestion)}
                                    className="group relative px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-left hover:border-sky-400 hover:bg-sky-50 transition-colors"
                                    title={suggestion.explanation}
                                  >
                                    <div className="flex items-center gap-1 mb-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          suggestion.source === 'memory'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-sky-100 text-sky-700'
                                        }`}
                                      >
                                        {suggestion.source === 'memory'
                                          ? 'TM'
                                          : 'AI'}
                                      </span>
                                      <span className="text-gray-400">
                                        {Math.round(suggestion.confidence * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      {suggestion.translation || '(empty)'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2 ml-10">
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                              disabled={editorState.saving}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={editorState.saving}
                              className="px-4 py-1.5 bg-sky-600 text-white text-xs rounded hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {editorState.saving ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3" />
                                  Save Translation
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(unit)}
                          className="w-full flex items-start gap-2 group/edit"
                        >
                          <span className="text-xs font-medium text-gray-400 mt-1 w-8 shrink-0">
                            {targetLanguage.toUpperCase()}
                          </span>
                          <div className="flex-1 p-2 border border-gray-200 rounded text-sm text-gray-800 min-h-[40px] bg-white group-hover/edit:border-sky-300 transition-colors">
                            {unit.target || (
                              <span className="text-gray-400 italic">
                                Click to translate...
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>

                    {unit.note && (
                      <div className="mt-2 text-xs text-gray-500 italic ml-10">
                        Note: {unit.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
