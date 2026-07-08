import type { XliffDocument, XliffFile, TranslationUnit } from '@/types/xliff';

export type { XliffDocument, XliffFile, TranslationUnit };

export function parseXliff(content: string): XliffDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XLIFF file: XML parsing error');
  }

  const xliffElement = doc.querySelector('xliff');
  if (!xliffElement) {
    throw new Error('Invalid XLIFF file: Missing xliff root element');
  }

  const version = xliffElement.getAttribute('version') || '2.0';
  const srcLang = xliffElement.getAttribute('srcLang') || xliffElement.getAttribute('source-language') || 'en';
  const trgLang = xliffElement.getAttribute('trgLang') || xliffElement.getAttribute('target-language') || '';

  const files: XliffFile[] = [];
  const fileElements = xliffElement.querySelectorAll('file');

  fileElements.forEach((fileEl) => {
    const file: XliffFile = {
      id: fileEl.getAttribute('id') || generateId(),
      original: fileEl.getAttribute('original') || '',
      sourceLanguage: fileEl.getAttribute('source-language') || srcLang,
      targetLanguage: fileEl.getAttribute('target-language') || trgLang,
      datatype: fileEl.getAttribute('datatype') || 'plaintext',
      translationUnits: [],
    };

    const unitElements = fileEl.querySelectorAll('trans-unit, unit');
    unitElements.forEach((unitEl) => {
      const unit = parseTranslationUnit(unitEl, version);
      if (unit) {
        file.translationUnits.push(unit);
      }
    });

    files.push(file);
  });

  return {
    version,
    srcLang,
    trgLang,
    files,
  };
}

function parseTranslationUnit(element: Element, _version: string): TranslationUnit | null {
  const id = element.getAttribute('id') || generateId();
  const resname = element.getAttribute('resname') || undefined;

  const sourceEl = element.querySelector('source');
  const targetEl = element.querySelector('target');
  const noteEl = element.querySelector('note');

  if (!sourceEl) return null;

  const source = getTextContent(sourceEl);
  const target = targetEl ? getTextContent(targetEl) : undefined;
  const note = noteEl ? noteEl.textContent || undefined : undefined;

  let state: TranslationUnit['state'] = 'new';
  if (targetEl) {
    const stateAttr = targetEl.getAttribute('state') || element.getAttribute('state');
    if (stateAttr) {
      state = normalizeState(stateAttr);
    } else if (target && target.trim()) {
      state = 'translated';
    }
  }

  const approved = element.getAttribute('approved') === 'yes';

  return {
    id,
    resname,
    source,
    target,
    state,
    note,
    approved,
  };
}

function getTextContent(element: Element): string {
  let text = '';
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName === 'cp' && el.hasAttribute('code')) {
        text += String.fromCodePoint(parseInt(el.getAttribute('code') || '0', 16));
      } else {
        text += el.textContent || '';
      }
    }
  });
  return text.trim();
}

function normalizeState(state: string): TranslationUnit['state'] {
  const normalized = state.toLowerCase().replace(/[_\s]/g, '-');
  const validStates: TranslationUnit['state'][] = [
    'new',
    'needs-translation',
    'needs-review-translation',
    'translated',
    'final',
  ];
  if (validStates.includes(normalized as TranslationUnit['state'])) {
    return normalized as TranslationUnit['state'];
  }
  if (normalized.includes('final') || normalized.includes('signed')) {
    return 'final';
  }
  if (normalized.includes('review')) {
    return 'needs-review-translation';
  }
  if (normalized.includes('translated')) {
    return 'translated';
  }
  return 'new';
}

export function serializeXliff(document: XliffDocument): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<xliff xmlns="urn:oasis:names:tc:xliff:document:${document.version}" `;
  xml += `version="${document.version}" `;
  xml += `srcLang="${document.srcLang}" `;
  if (document.trgLang) {
    xml += `trgLang="${document.trgLang}"`;
  }
  xml += '>\n';

  document.files.forEach((file) => {
    xml += '  <file';
    xml += ` id="${escapeXml(file.id)}"`;
    if (file.original) {
      xml += ` original="${escapeXml(file.original)}"`;
    }
    xml += ` source-language="${escapeXml(file.sourceLanguage)}"`;
    if (file.targetLanguage) {
      xml += ` target-language="${escapeXml(file.targetLanguage)}"`;
    }
    if (file.datatype) {
      xml += ` datatype="${escapeXml(file.datatype)}"`;
    }
    xml += '>\n';
    xml += '    <body>\n';

    file.translationUnits.forEach((unit) => {
      xml += '      <trans-unit';
      xml += ` id="${escapeXml(unit.id)}"`;
      if (unit.resname) {
        xml += ` resname="${escapeXml(unit.resname)}"`;
      }
      xml += '>\n';
      xml += `        <source>${escapeXml(unit.source)}</source>\n`;
      if (unit.target !== undefined) {
        xml += `        <target`;
        if (unit.state && unit.state !== 'new') {
          xml += ` state="${unit.state}"`;
        }
        xml += `>${escapeXml(unit.target)}</target>\n`;
      }
      if (unit.note) {
        xml += `        <note>${escapeXml(unit.note)}</note>\n`;
      }
      xml += '      </trans-unit>\n';
    });

    xml += '    </body>\n';
    xml += '  </file>\n';
  });

  xml += '</xliff>\n';
  return xml;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateId(): string {
  return `tu_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export function calculateProgress(files: XliffFile[]): { total: number; translated: number } {
  let total = 0;
  let translated = 0;

  files.forEach((file) => {
    file.translationUnits.forEach((unit) => {
      total++;
      if (unit.target && unit.target.trim() && unit.state !== 'new' && unit.state !== 'needs-translation') {
        translated++;
      }
    });
  });

  return { total, translated };
}

export function mergeTranslationUnits(
  original: XliffDocument,
  updates: Map<string, string>
): XliffDocument {
  return {
    ...original,
    files: original.files.map((file) => ({
      ...file,
      translationUnits: file.translationUnits.map((unit) => {
        const newTarget = updates.get(unit.id);
        if (newTarget !== undefined) {
          return {
            ...unit,
            target: newTarget,
            state: newTarget.trim() ? 'translated' : 'new' as const,
          };
        }
        return unit;
      }),
    })),
  };
}
