import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Check,
  AlertTriangle,
  Clock,
  Edit3,
  MessageSquare,
  Copy,
  CheckCheck,
  Save,
  X,
  Loader2,
} from 'lucide-react';
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
  onSaveAll: (updates: { id: string; target: string; state: string }[]) => Promise<void>;
}

interface EditorState {
  editingId: string | null;
  editedTarget: string;
  saving: boolean;
}

const STATE_COLORS: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string; icon: typeof Check }
> = {
  new: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
    icon: Clock,
  },
  'needs-translation': {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-900/40',
    darkText: 'dark:text-amber-300',
    icon: AlertTriangle,
  },
  'needs-review-translation': {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    darkBg: 'dark:bg-orange-900/40',
    darkText: 'dark:text-orange-300',
    icon: AlertTriangle,
  },
  translated: {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    darkBg: 'dark:bg-sky-900/40',
    darkText: 'dark:text-sky-300',
    icon: Edit3,
  },
  final: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-900/40',
    darkText: 'dark:text-emerald-300',
    icon: Check,
  },
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopied(false), 1500);
        } catch {
          // give up silently
        }
        document.body.removeChild(textarea);
      }
    },
    [text]
  );

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
    >
      {copied ? (
        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function TranslationEditor({
  units,
  sourceLanguage,
  targetLanguage,
  onUpdateUnit,
  onAddToMemory,
  onSaveAll,
}: TranslationEditorProps) {
  const [editorState, setEditorState] = useState<EditorState>({
    editingId: null,
    editedTarget: '',
    saving: false,
  });
  const [suggestions, setSuggestions] = useState<Map<string, AISuggestion[]>>(new Map());
  const [filter, setFilter] = useState<'all' | 'untranslated' | 'review'>('all');

  // Batch-edit state: map of unitId -> edited target
  const [batchMode, setBatchMode] = useState(false);
  const [batchEdits, setBatchEdits] = useState<Map<string, string>>(new Map());
  const [savingAll, setSavingAll] = useState(false);

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

      const unit = units.find((u) => u.id === editorState.editingId);
      if (unit && editorState.editedTarget.trim()) {
        try {
          await onAddToMemory(unit.source, editorState.editedTarget);
        } catch {
          // non-fatal
        }
      }

      setEditorState({ editingId: null, editedTarget: '', saving: false });
    } catch (error) {
      console.error('Failed to save:', error);
      setEditorState((prev) => ({ ...prev, saving: false }));
    }
  }, [editorState, onUpdateUnit, onAddToMemory, units]);

  const handleApplySuggestion = useCallback((suggestion: AISuggestion) => {
    setEditorState((prev) => ({
      ...prev,
      editedTarget: suggestion.translation,
    }));
  }, []);

  // Batch mode handlers
  const handleEnterBatch = useCallback(() => {
    setBatchMode(true);
    setEditorState({ editingId: null, editedTarget: '', saving: false });
    // Seed batch edits with current targets
    const initial = new Map<string, string>();
    units.forEach((u) => {
      initial.set(u.id, u.target || '');
    });
    setBatchEdits(initial);
  }, [units]);

  const handleExitBatch = useCallback(() => {
    setBatchMode(false);
    setBatchEdits(new Map());
  }, []);

  const handleBatchChange = useCallback((unitId: string, value: string) => {
    setBatchEdits((prev) => {
      const next = new Map(prev);
      next.set(unitId, value);
      return next;
    });
  }, []);

  const handleSaveAll = useCallback(async () => {
    const updates: { id: string; target: string; state: string }[] = [];
    units.forEach((u) => {
      const edited = batchEdits.get(u.id);
      if (edited !== undefined && edited !== (u.target || '')) {
        const state = edited.trim() ? 'translated' : 'new';
        updates.push({ id: u.id, target: edited, state });
      }
    });

    if (updates.length === 0) {
      handleExitBatch();
      return;
    }

    setSavingAll(true);
    try {
      await onSaveAll(updates);

      // Add changed translations to memory (non-blocking, non-fatal)
      updates.forEach((upd) => {
        const unit = units.find((u) => u.id === upd.id);
        if (unit && upd.target.trim()) {
          onAddToMemory(unit.source, upd.target).catch(() => {});
        }
      });

      handleExitBatch();
    } catch (error) {
      console.error('Failed to save all:', error);
    } finally {
      setSavingAll(false);
    }
  }, [units, batchEdits, onSaveAll, onAddToMemory, handleExitBatch]);

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

  const pendingBatchCount = batchMode
    ? units.filter((u) => {
        const edited = batchEdits.get(u.id);
        return edited !== undefined && edited !== (u.target || '');
      }).length
    : 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          Translation Units
        </h2>
        <div className="flex items-center gap-2">
          {batchMode ? (
            <>
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                {pendingBatchCount} pending
              </span>
              <button
                onClick={handleExitBatch}
                disabled={savingAll}
                className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                onClick={handleSaveAll}
                disabled={savingAll || pendingBatchCount === 0}
                className="px-2.5 py-1 text-xs rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {savingAll ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    Save All ({pendingBatchCount})
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  filter === 'all'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All ({units.length})
              </button>
              <button
                onClick={() => setFilter('untranslated')}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  filter === 'untranslated'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Untranslated ({untranslatedCount})
              </button>
              <button
                onClick={() => setFilter('review')}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  filter === 'review'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Review ({reviewCount})
              </button>
              <button
                onClick={handleEnterBatch}
                className="px-2.5 py-1 text-xs rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60 transition-colors flex items-center gap-1 ml-1"
                title="Edit all units at once, then save in one batch"
              >
                <Edit3 className="w-3 h-3" />
                Batch Edit
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredUnits.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No translation units found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredUnits.map((unit, index) => {
              const stateConfig = STATE_COLORS[unit.state] || STATE_COLORS.new;
              const StateIcon = stateConfig.icon;
              const isEditing = editorState.editingId === unit.id;
              const unitSuggestions = suggestions.get(unit.id) || [];
              const batchValue = batchEdits.get(unit.id);
              const batchChanged =
                batchMode && batchValue !== undefined && batchValue !== (unit.target || '');

              return (
                <div
                  key={unit.id}
                  className={`group ${
                    isEditing
                      ? 'bg-sky-50 dark:bg-sky-900/20'
                      : batchChanged
                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  } transition-colors`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        #{index + 1}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${stateConfig.bg} ${stateConfig.text} ${stateConfig.darkBg} ${stateConfig.darkText}`}
                      >
                        <StateIcon className="w-3 h-3" />
                        {unit.state || 'new'}
                      </span>
                      {unit.resname && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {unit.resname}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Source row */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1 w-8 shrink-0">
                          {sourceLanguage.toUpperCase()}
                        </span>
                        <div className="flex-1 flex items-start gap-1">
                          <div className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-800 dark:text-gray-200">
                            {unit.source}
                          </div>
                          <CopyButton text={unit.source} label="source" />
                        </div>
                      </div>

                      {/* Target row */}
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1 w-8 shrink-0">
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
                              className="flex-1 p-2 border border-sky-300 dark:border-sky-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                              rows={3}
                              autoFocus
                              placeholder="Enter translation..."
                            />
                          </div>

                          {unitSuggestions.length > 0 && (
                            <div className="ml-10 space-y-2">
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                Suggestions
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {unitSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    onClick={() => handleApplySuggestion(suggestion)}
                                    className="group relative px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-left hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors"
                                    title={suggestion.explanation}
                                  >
                                    <div className="flex items-center gap-1 mb-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          suggestion.source === 'memory'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                            : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                                        }`}
                                      >
                                        {suggestion.source === 'memory' ? 'TM' : 'AI'}
                                      </span>
                                      <span className="text-gray-400 dark:text-gray-500">
                                        {Math.round(suggestion.confidence * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700 dark:text-gray-300">
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
                              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
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
                      ) : batchMode ? (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1 w-8 shrink-0">
                            {targetLanguage.toUpperCase()}
                          </span>
                          <textarea
                            value={batchValue ?? ''}
                            onChange={(e) => handleBatchChange(unit.id, e.target.value)}
                            className={`flex-1 p-2 border rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none ${
                              batchChanged
                                ? 'border-emerald-400 dark:border-emerald-600'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                            rows={2}
                            placeholder="Enter translation..."
                          />
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 group/edit">
                          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1 w-8 shrink-0">
                            {targetLanguage.toUpperCase()}
                          </span>
                          <button
                            onClick={() => handleStartEdit(unit)}
                            className="flex-1 flex items-start gap-1 text-left"
                          >
                            <div className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-800 dark:text-gray-200 min-h-[40px] bg-white dark:bg-gray-800 group-hover/edit:border-sky-300 dark:group-hover/edit:border-sky-600 transition-colors">
                              {unit.target || (
                                <span className="text-gray-400 dark:text-gray-500 italic">
                                  Click to translate...
                                </span>
                              )}
                            </div>
                          </button>
                          {unit.target && (
                            <CopyButton text={unit.target} label="target" />
                          )}
                        </div>
                      )}
                    </div>

                    {unit.note && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic ml-10">
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
