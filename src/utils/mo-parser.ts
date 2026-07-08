import type { PoEntry, PoFile } from './po-parser';

/**
 * MO (Machine Object) file format parser and serializer
 * Used by GNU gettext for compiled translation files
 *
 * Format reference: https://www.gnu.org/software/gettext/manual/html_node/MO-Files.html
 */

const MO_MAGIC_BE = 0xde120495; // Big-endian magic
const MO_MAGIC_LE = 0x950412de; // Little-endian magic

interface MoHeader {
  magic: number;
  formatRevision: number;
  numStrings: number;
  origTableOffset: number;
  transTableOffset: number;
  hashTableSize: number;
  hashTableOffset: number;
}

export function parseMoFile(buffer: ArrayBuffer): PoFile {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);

  const isLittleEndian = magic === MO_MAGIC_LE;
  if (!isLittleEndian && magic !== MO_MAGIC_BE) {
    throw new Error('Invalid MO file: bad magic number');
  }

  const header: MoHeader = {
    magic,
    formatRevision: view.getUint32(4, isLittleEndian),
    numStrings: view.getUint32(8, isLittleEndian),
    origTableOffset: view.getUint32(12, isLittleEndian),
    transTableOffset: view.getUint32(16, isLittleEndian),
    hashTableSize: view.getUint32(20, isLittleEndian),
    hashTableOffset: view.getUint32(24, isLittleEndian),
  };

  const entries: PoEntry[] = [];
  let headerEntry: PoEntry | null = null;
  let targetLanguage = '';
  let sourceLanguage = 'en';

  for (let i = 0; i < header.numStrings; i++) {
    // Read original string descriptor
    const origDescOffset = header.origTableOffset + i * 8;
    const origLength = view.getUint32(origDescOffset, isLittleEndian);
    const origOffset = view.getUint32(origDescOffset + 4, isLittleEndian);

    // Read translated string descriptor
    const transDescOffset = header.transTableOffset + i * 8;
    const transLength = view.getUint32(transDescOffset, isLittleEndian);
    const transOffset = view.getUint32(transDescOffset + 4, isLittleEndian);

    // Read strings
    const orig = readString(buffer, origOffset, origLength);
    const trans = readString(buffer, transOffset, transLength);

    let msgctxt: string | undefined;
    let msgid = orig;
    let msgidPlural: string | undefined;
    let msgstrPlural: string[] | undefined;

    // Handle context (msgid with context is: context\x04msgid)
    const contextSep = orig.indexOf('\x04');
    if (contextSep > 0) {
      msgctxt = orig.substring(0, contextSep);
      msgid = orig.substring(contextSep + 1);
    }

    // Handle plural forms (msgid contains: singular\x00plural)
    const pluralSep = msgid.indexOf('\x00');
    if (pluralSep > 0) {
      msgidPlural = msgid.substring(pluralSep + 1);
      msgid = msgid.substring(0, pluralSep);

      // msgstr for plurals is separated by \x00
      if (trans) {
        msgstrPlural = trans.split('\x00');
      }
    }

    const isHeader = msgid === '';
    const entry: PoEntry = {
      msgid,
      msgstr: isHeader ? trans : (msgstrPlural ? '' : trans),
      msgctxt,
      msgidPlural,
      msgstrPlural,
      isHeader,
    };

    if (isHeader) {
      headerEntry = entry;
      // Parse language from header
      if (trans) {
        const langMatch = trans.match(/Language:\s*([^\n\\]+)/);
        if (langMatch) {
          targetLanguage = langMatch[1].trim().replace(/_/g, '-').toLowerCase();
        }
        const sourceMatch = trans.match(/X-Source-Language:\s*([^\n\\]+)/);
        if (sourceMatch) {
          sourceLanguage = sourceMatch[1].trim().replace(/_/g, '-').toLowerCase();
        }
      }
    } else {
      entries.push(entry);
    }
  }

  return {
    header: headerEntry,
    entries,
    sourceLanguage,
    targetLanguage,
  };
}

function readString(buffer: ArrayBuffer, offset: number, length: number): string {
  const bytes = new Uint8Array(buffer, offset, length);
  // Try UTF-8 first, fall back to latin-1
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(bytes);
  } catch {
    const decoder = new TextDecoder('latin1');
    return decoder.decode(bytes);
  }
}

export function serializeMoFile(po: PoFile): ArrayBuffer {
  const entries: Array<{ orig: string; trans: string }> = [];

  // Add header first
  if (po.header) {
    entries.push({
      orig: '',
      trans: po.header.msgstr || '',
    });
  }

  // Add other entries
  for (const entry of po.entries) {
    let orig = entry.msgctxt ? `${entry.msgctxt}\x04${entry.msgid}` : entry.msgid;

    if (entry.msgidPlural !== undefined) {
      orig += `\x00${entry.msgidPlural}`;
    }

    let trans = '';
    if (entry.msgstrPlural && entry.msgstrPlural.length > 0) {
      trans = entry.msgstrPlural.join('\x00');
    } else {
      trans = entry.msgstr || '';
    }

    entries.push({ orig, trans });
  }

  const numStrings = entries.length;

  // Calculate sizes
  const headerSize = 32;
  const origTableSize = numStrings * 8;
  const transTableSize = numStrings * 8;

  // Encode all strings
  const encodedEntries = entries.map(({ orig, trans }) => ({
    orig: new TextEncoder().encode(orig),
    trans: new TextEncoder().encode(trans),
  }));

  // Calculate offsets
  let stringDataOffset = headerSize + origTableSize + transTableSize;
  const stringDescriptors: Array<{
    origOffset: number;
    origLength: number;
    transOffset: number;
    transLength: number;
  }> = [];

  for (const entry of encodedEntries) {
    const origOffset = stringDataOffset;
    const transOffset = origOffset + entry.orig.length;

    stringDescriptors.push({
      origOffset,
      origLength: entry.orig.length,
      transOffset,
      transLength: entry.trans.length,
    });

    stringDataOffset = transOffset + entry.trans.length;
  }

  // Build the buffer
  const totalSize = stringDataOffset;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Write header (little-endian format)
  view.setUint32(0, MO_MAGIC_LE, true); // magic
  view.setUint32(4, 0, true); // format revision
  view.setUint32(8, numStrings, true);
  view.setUint32(12, headerSize, true); // orig table offset
  view.setUint32(16, headerSize + origTableSize, true); // trans table offset
  view.setUint32(20, 0, true); // hash table size (0 = no hash)
  view.setUint32(24, 0, true); // hash table offset

  // Write original string table
  let tableOffset = headerSize;
  for (const desc of stringDescriptors) {
    view.setUint32(tableOffset, desc.origLength, true);
    view.setUint32(tableOffset + 4, desc.origOffset, true);
    tableOffset += 8;
  }

  // Write translated string table
  for (const desc of stringDescriptors) {
    view.setUint32(tableOffset, desc.transLength, true);
    view.setUint32(tableOffset + 4, desc.transOffset, true);
    tableOffset += 8;
  }

  // Write string data
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < encodedEntries.length; i++) {
    const entry = encodedEntries[i];
    const desc = stringDescriptors[i];
    bytes.set(entry.orig, desc.origOffset);
    bytes.set(entry.trans, desc.transOffset);
  }

  return buffer;
}

/**
 * Convert PO file to MO format (common workflow)
 */
export function compilePoToMo(po: PoFile): ArrayBuffer {
  return serializeMoFile(po);
}
