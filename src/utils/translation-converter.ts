import type { TranslationFile, TranslationUnit, TranslationFileFormat } from '@/types/xliff';
import type { PoFile, PoEntry } from './po-parser';
import type { XliffDocument, XliffFile } from './xliff-parser';

import { parsePoFile, serializePoFile } from './po-parser';
import { parseMoFile, serializeMoFile } from './mo-parser';
import { parseXliff, serializeXliff } from './xliff-parser';

export function detectFormat(filename: string): TranslationFileFormat {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.pot')) return 'pot';
  if (ext.endsWith('.po')) return 'po';
  if (ext.endsWith('.mo')) return 'mo';
  if (ext.endsWith('.xliff')) return 'xliff';
  if (ext.endsWith('.xlf')) return 'xliff';
  return 'xliff';
}

export function parseTranslationFile(
  content: string | ArrayBuffer,
  filename: string,
  format?: TranslationFileFormat
): TranslationFile {
  const actualFormat = format || detectFormat(filename);

  switch (actualFormat) {
    case 'po':
    case 'pot':
      return parsePoToTranslationFile(content as string, filename, actualFormat);
    case 'mo':
      return parseMoToTranslationFile(content as ArrayBuffer, filename);
    case 'xliff':
    case 'xliff2':
    default:
      return parseXliffToTranslationFile(content as string, filename);
  }
}

function parseXliffToTranslationFile(content: string, filename: string): TranslationFile {
  const doc: XliffDocument = parseXliff(content);

  const units: TranslationUnit[] = [];
  doc.files.forEach((file: XliffFile) => {
    units.push(...file.translationUnits.map((u) => ({
      id: u.id,
      source: u.source,
      target: u.target,
      state: u.state as TranslationUnit['state'],
      note: u.note,
      approved: u.approved,
      resname: u.resname,
    })));
  });

  return {
    format: 'xliff',
    name: filename.replace(/\.[^.]+$/, ''),
    sourceLanguage: doc.srcLang,
    targetLanguage: doc.trgLang,
    units,
  };
}

function parsePoToTranslationFile(content: string, filename: string, format: 'po' | 'pot'): TranslationFile {
  const po: PoFile = parsePoFile(content);

  const units: TranslationUnit[] = po.entries.map((entry: PoEntry, index: number) => ({
    id: `po-${index + 1}`,
    source: entry.msgid,
    target: entry.msgstr || '',
    state: entry.msgstr && entry.msgstr.trim() ? 'translated' : 'new',
    note: entry.comments?.join('\n') || undefined,
    resname: entry.msgctxt,
  }));

  return {
    format,
    name: filename.replace(/\.[^.]+$/, ''),
    sourceLanguage: po.sourceLanguage || 'en',
    targetLanguage: po.targetLanguage || '',
    units,
    metadata: {
      projectId: po.projectId,
      potCreationDate: po.potCreationDate,
      poRevisionDate: po.poRevisionDate,
      lastTranslator: po.lastTranslator,
      languageTeam: po.languageTeam,
      pluralForms: po.pluralForms,
    },
  };
}

function parseMoToTranslationFile(content: ArrayBuffer, filename: string): TranslationFile {
  const po: PoFile = parseMoFile(content);

  const units: TranslationUnit[] = po.entries.map((entry: PoEntry, index: number) => ({
    id: `mo-${index + 1}`,
    source: entry.msgid,
    target: entry.msgstr || '',
    state: entry.msgstr && entry.msgstr.trim() ? 'translated' : 'new',
    resname: entry.msgctxt,
  }));

  return {
    format: 'mo',
    name: filename.replace(/\.[^.]+$/, ''),
    sourceLanguage: po.sourceLanguage || 'en',
    targetLanguage: po.targetLanguage || '',
    units,
  };
}

export function serializeTranslationFile(
  file: TranslationFile,
  format?: TranslationFileFormat
): string | ArrayBuffer {
  const actualFormat = format || file.format;

  switch (actualFormat) {
    case 'po':
    case 'pot':
      return serializeTranslationToPo(file);
    case 'mo':
      return serializeTranslationToMo(file);
    case 'xliff':
    case 'xliff2':
    default:
      return serializeTranslationToXliff(file);
  }
}

function serializeTranslationToXliff(file: TranslationFile): string {
  const doc: XliffDocument = {
    version: '2.0',
    srcLang: file.sourceLanguage,
    trgLang: file.targetLanguage,
    files: [{
      id: 'f1',
      original: file.name,
      sourceLanguage: file.sourceLanguage,
      targetLanguage: file.targetLanguage,
      datatype: 'plaintext',
      translationUnits: file.units.map(u => ({
        id: u.id,
        source: u.source,
        target: u.target,
        state: u.state,
        note: u.note,
        approved: u.approved,
        resname: u.resname,
      })),
    }],
  };

  return serializeXliff(doc);
}

function serializeTranslationToPo(file: TranslationFile): string {
  const entries: PoEntry[] = file.units.map(u => ({
    msgid: u.source,
    msgstr: u.target || '',
    msgctxt: u.resname,
    comments: u.note ? [u.note] : [],
    isHeader: false,
  }));

  // Create header
  const header: PoEntry = {
    msgid: '',
    msgstr: [
      `Project-Id-Version: ${file.name}`,
      'Report-Msgid-Bugs-To: ',
      `POT-Creation-Date: ${new Date().toISOString()}`,
      `PO-Revision-Date: ${new Date().toISOString()}`,
      'Last-Translator: ',
      'Language-Team: ',
      `Language: ${file.targetLanguage}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
    ].join('\\n'),
    isHeader: true,
    msgstrPlural: [],
    comments: [],
    extractedComments: [],
    references: [],
    flags: [],
  };

  const po: PoFile = {
    header,
    entries,
    sourceLanguage: file.sourceLanguage,
    targetLanguage: file.targetLanguage,
  };

  return serializePoFile(po);
}

function serializeTranslationToMo(file: TranslationFile): ArrayBuffer {
  const entries: PoEntry[] = file.units.map(u => ({
    msgid: u.source,
    msgstr: u.target || '',
    msgctxt: u.resname,
    isHeader: false,
    msgstrPlural: [],
    comments: [],
    extractedComments: [],
    references: [],
    flags: [],
  }));

  // Create header
  const header: PoEntry = {
    msgid: '',
    msgstr: [
      `Project-Id-Version: ${file.name}`,
      'Report-Msgid-Bugs-To: ',
      `PO-Revision-Date: ${new Date().toISOString()}`,
      'Last-Translator: ',
      'Language-Team: ',
      `Language: ${file.targetLanguage}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
    ].join('\\n'),
    isHeader: true,
    msgstrPlural: [],
    comments: [],
    extractedComments: [],
    references: [],
    flags: [],
  };

  const po: PoFile = {
    header,
    entries,
    sourceLanguage: file.sourceLanguage,
    targetLanguage: file.targetLanguage,
  };

  return serializeMoFile(po);
}

export function getFormatExtension(format: TranslationFileFormat): string {
  switch (format) {
    case 'po': return '.po';
    case 'pot': return '.pot';
    case 'mo': return '.mo';
    case 'xliff': return '.xlf';
    case 'xliff2': return '.xliff';
    default: return '.xlf';
  }
}

export function getFormatName(format: TranslationFileFormat): string {
  switch (format) {
    case 'po': return 'GNU Gettext PO';
    case 'pot': return 'GNU Gettext POT (Template)';
    case 'mo': return 'GNU Gettext MO (Compiled)';
    case 'xliff': return 'XLIFF 1.2';
    case 'xliff2': return 'XLIFF 2.0';
    default: return 'XLIFF';
  }
}
