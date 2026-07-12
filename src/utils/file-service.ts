import { supabase } from '@/lib/supabase';
import type { TranslationFile, TranslationFileFormat, TranslationUnit } from '@/types/xliff';
import {
  parseTranslationFile,
  serializeTranslationFile,
  detectFormat,
  getFormatExtension,
} from './translation-converter';

interface XliffFileRow {
  id: string;
  name: string;
  format: string;
  source_language: string;
  target_language: string;
  content: Record<string, unknown>;
  unit_count: number;
  translated_count: number;
  created_at: string;
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

interface TranslationMemoryRow {
  id: string;
  source_language: string;
  target_language: string;
  source: string;
  target: string;
  context: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export async function saveTranslationFile(
  file: TranslationFile
): Promise<XliffFileRow> {
  const translatedCount = file.units.filter(
    u => u.target && u.target.trim() && u.state !== 'new'
  ).length;

  const { data, error } = await supabase
    .from('xliff_files')
    .insert({
      name: file.name,
      format: file.format,
      source_language: file.sourceLanguage,
      target_language: file.targetLanguage,
      content: file as unknown as Record<string, unknown>,
      unit_count: file.units.length,
      translated_count: translatedCount,
    } as never)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to insert file');

  const fileId = (data as XliffFileRow).id;

  // Insert translation units
  const units: never[] = [];
  file.units.forEach((unit, index) => {
    units.push({
      xliff_file_id: fileId,
      unit_id: unit.id || `unit-${index + 1}`,
      resname: unit.resname || null,
      source: unit.source,
      target: unit.target || null,
      state: unit.state || 'new',
      note: unit.note || null,
      approved: unit.approved || false,
    } as never);
  });

  if (units.length > 0) {
    const { error: unitsError } = await supabase
      .from('translation_units')
      .insert(units);
    if (unitsError) throw unitsError;
  }

  return data as XliffFileRow;
}

export async function listXliffFiles(): Promise<XliffFileRow[]> {
  const { data, error } = await supabase
    .from('xliff_files')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as XliffFileRow[];
}

export async function getXliffFile(id: string): Promise<XliffFileRow | null> {
  const { data, error } = await supabase
    .from('xliff_files')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as XliffFileRow | null;
}

export async function getTranslationUnits(
  xliffFileId: string
): Promise<TranslationUnitRow[]> {
  const { data, error } = await supabase
    .from('translation_units')
    .select('*')
    .eq('xliff_file_id', xliffFileId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as TranslationUnitRow[];
}

export async function updateTranslationUnit(
  id: string,
  target: string,
  state: string
): Promise<TranslationUnitRow> {
  const { data, error } = await supabase
    .from('translation_units')
    .update({ target, state, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to update translation unit');

  await updateFileProgress((data as TranslationUnitRow).xliff_file_id);

  return data as TranslationUnitRow;
}

export async function batchUpdateTranslationUnits(
  updates: { id: string; target: string; state: string }[]
): Promise<void> {
  if (updates.length === 0) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('translation_units')
    .upsert(
      updates.map((u) => ({
        id: u.id,
        target: u.target,
        state: u.state,
        updated_at: now,
      })) as never,
      { onConflict: 'id' }
    );

  if (error) throw error;

  // Update file progress for affected files
  const { data: affectedFiles } = await supabase
    .from('translation_units')
    .select('xliff_file_id')
    .in('id', updates.map((u) => u.id));

  const fileIds = Array.from(
    new Set((affectedFiles || []).map((r) => (r as { xliff_file_id: string }).xliff_file_id))
  );
  await Promise.all(fileIds.map((fid) => updateFileProgress(fid)));
}

export async function updateFileProgress(xliffFileId: string): Promise<void> {
  const { data: units, error } = await supabase
    .from('translation_units')
    .select('state')
    .eq('xliff_file_id', xliffFileId);

  if (error) throw error;

  const unitList = (units || []) as { state: string }[];
  const total = unitList.length;
  const translated =
    unitList.filter(
      (u) =>
        u.state !== 'new' &&
        u.state !== 'needs-translation' &&
        u.state !== ''
    ).length || 0;

  await supabase
    .from('xliff_files')
    .update({
      unit_count: total,
      translated_count: translated,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', xliffFileId);
}

export async function deleteXliffFile(id: string): Promise<void> {
  const { error } = await supabase.from('xliff_files').delete().eq('id', id);
  if (error) throw error;
}

// Export helpers
export async function exportFile(
  id: string,
  format?: TranslationFileFormat
): Promise<{ content: string | ArrayBuffer; filename: string; format: string }> {
  const file = await getXliffFile(id);
  if (!file) throw new Error('File not found');

  const units = await getTranslationUnits(id);
  const exportFormat = format || (file.format as TranslationFileFormat) || 'xliff';

  const translationFile: TranslationFile = {
    format: exportFormat,
    name: file.name,
    sourceLanguage: file.source_language,
    targetLanguage: file.target_language,
    units: units.map((u) => ({
      id: u.unit_id,
      resname: u.resname || undefined,
      source: u.source,
      target: u.target || undefined,
      state: u.state as TranslationUnit['state'],
      note: u.note || undefined,
      approved: u.approved,
    })),
  };

  const content = serializeTranslationFile(translationFile, exportFormat);
  const extension = getFormatExtension(exportFormat);
  const filename = `${file.name}${extension}`;

  return { content, filename, format: exportFormat };
}

export async function exportXliffFile(id: string): Promise<string> {
  const { content } = await exportFile(id, 'xliff');
  return content as string;
}

export async function exportPoFile(id: string): Promise<string> {
  const { content } = await exportFile(id, 'po');
  return content as string;
}

export async function exportMoFile(id: string): Promise<ArrayBuffer> {
  const { content } = await exportFile(id, 'mo');
  return content as ArrayBuffer;
}

export async function searchTranslationMemory(
  sourceLanguage: string,
  targetLanguage: string,
  source: string
): Promise<{ target: string; usage_count: number }[]> {
  const { data, error } = await supabase
    .from('translation_memory')
    .select('target, usage_count')
    .eq('source_language', sourceLanguage)
    .eq('target_language', targetLanguage)
    .eq('source', source)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return (data || []) as { target: string; usage_count: number }[];
}

export async function addToTranslationMemory(
  sourceLanguage: string,
  targetLanguage: string,
  source: string,
  target: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('translation_memory')
    .select('id, usage_count')
    .eq('source_language', sourceLanguage)
    .eq('target_language', targetLanguage)
    .eq('source', source)
    .eq('target', target)
    .maybeSingle();

  if (existing) {
    const existingRow = existing as TranslationMemoryRow;
    await supabase
      .from('translation_memory')
      .update({
        usage_count: existingRow.usage_count + 1,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', existingRow.id);
  } else {
    await supabase.from('translation_memory').insert({
      source_language: sourceLanguage,
      target_language: targetLanguage,
      source,
      target,
    } as never);
  }
}

// Legacy compatibility
export const saveXliffFile = saveTranslationFile;
export const parseXliffFile = (
  content: string | ArrayBuffer,
  filename: string
): { document: TranslationFile } => {
  const format = detectFormat(filename);
  const doc = parseTranslationFile(content, filename, format);
  return {
    document: doc,
  };
};
