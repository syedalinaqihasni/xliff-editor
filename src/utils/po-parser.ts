export interface PoEntry {
  msgid: string;
  msgstr: string;
  msgctxt?: string;
  msgidPlural?: string;
  msgstrPlural?: string[];
  comments?: string[];
  extractedComments?: string[];
  references?: string[];
  flags?: string[];
  isHeader?: boolean;
  isObsolete?: boolean;
}

export interface PoFile {
  header: PoEntry | null;
  entries: PoEntry[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId?: string;
  reportMsgidBugsTo?: string;
  potCreationDate?: string;
  poRevisionDate?: string;
  lastTranslator?: string;
  languageTeam?: string;
  pluralForms?: string;
}

export function parsePoFile(content: string): PoFile {
  const lines = content.split('\n');
  const entries: PoEntry[] = [];
  let currentEntry: Partial<PoEntry> = {};
  let currentField: string | null = null;
  let currentValue = '';
  let isPlural = false;
  let isHeader = false;
  let isObsolete = false;

  // Parse header metadata
  const metadata: Partial<PoFile> = {};
  let headerEntry: PoEntry | null = null;

  const finishEntry = () => {
    if (currentEntry.msgid !== undefined) {
      const entry: PoEntry = {
        msgid: currentEntry.msgid || '',
        msgstr: currentEntry.msgstr || '',
        msgctxt: currentEntry.msgctxt,
        msgidPlural: currentEntry.msgidPlural,
        msgstrPlural: currentEntry.msgstrPlural,
        comments: currentEntry.comments || [],
        extractedComments: currentEntry.extractedComments || [],
        references: currentEntry.references || [],
        flags: currentEntry.flags || [],
        isHeader,
        isObsolete,
      };
      entries.push(entry);
      if (isHeader && entry.msgstr) {
        headerEntry = entry;
        parseHeaderMetadata(entry.msgstr, metadata);
      }
    }
    currentEntry = {};
    currentField = null;
    currentValue = '';
    isPlural = false;
    isHeader = false;
    isObsolete = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '' || line.startsWith('#~')) {
      if (line.startsWith('#~')) {
        isObsolete = true;
        continue;
      }
      if (currentField) {
        (currentEntry as Record<string, string>)[currentField] = currentValue;
      }
      finishEntry();
      continue;
    }

    // Comments
    if (line.startsWith('#')) {
      if (!currentEntry.comments) currentEntry.comments = [];
      currentEntry.comments.push(line);
    } else if (line.startsWith('#.')) {
      if (!currentEntry.extractedComments) currentEntry.extractedComments = [];
      currentEntry.extractedComments.push(line);
    } else if (line.startsWith('#:')) {
      if (!currentEntry.references) currentEntry.references = [];
      currentEntry.references.push(line);
    } else if (line.startsWith('#,')) {
      if (!currentEntry.flags) currentEntry.flags = [];
      currentEntry.flags.push(line);
    }
    // Fields
    else if (line.startsWith('msgctxt ')) {
      currentEntry.msgctxt = parsePoString(line.substring(8));
      currentField = 'msgctxt';
    } else if (line.startsWith('msgid_plural ')) {
      currentEntry.msgidPlural = parsePoString(line.substring(12));
      currentField = 'msgidPlural';
      isPlural = true;
    } else if (line.startsWith('msgid ')) {
      currentEntry.msgid = parsePoString(line.substring(6));
      currentField = 'msgid';
      isHeader = currentEntry.msgid === '';
    } else if (line.startsWith('msgstr')) {
      if (isPlural) {
        if (!currentEntry.msgstrPlural) currentEntry.msgstrPlural = [];
        if (line.startsWith('msgstr[')) {
          const match = line.match(/msgstr\[(\d+)\]\s+"(.*)"\s*$/);
          if (match) {
            const index = parseInt(match[1], 10);
            currentEntry.msgstrPlural[index] = parsePoString('"' + match[2] + '"');
          }
        } else {
          currentEntry.msgstr = parsePoString(line.substring(7));
        }
        currentField = 'msgstrPlural';
      } else {
        currentEntry.msgstr = parsePoString(line.substring(7));
        currentField = 'msgstr';
      }
    } else if (line.startsWith('"') && line.endsWith('"')) {
      // Continuation of previous field
      const value = parsePoString(line);
      if (currentField) {
        if (currentField === 'msgstrPlural' && currentEntry.msgstrPlural) {
          // Handle plural continuation
        } else {
          (currentEntry as Record<string, string>)[currentField] =
            ((currentEntry as Record<string, string>)[currentField] || '') + value;
        }
      }
    }
  }

  // Finish last entry
  if (currentField) {
    (currentEntry as Record<string, string>)[currentField] = currentValue;
  }
  finishEntry();

  return {
    header: headerEntry,
    entries: entries.filter(e => !e.isHeader),
    sourceLanguage: metadata.sourceLanguage || 'en',
    targetLanguage: metadata.targetLanguage || '',
    projectId: metadata.projectId,
    reportMsgidBugsTo: metadata.reportMsgidBugsTo,
    potCreationDate: metadata.potCreationDate,
    poRevisionDate: metadata.poRevisionDate,
    lastTranslator: metadata.lastTranslator,
    languageTeam: metadata.languageTeam,
    pluralForms: metadata.pluralForms,
  };
}

function parsePoString(str: string): string {
  // Remove surrounding quotes if present
  let result = str.trim();
  if (result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(1, -1);
  }

  // Unescape special characters
  result = result
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  return result;
}

function parseHeaderMetadata(header: string, metadata: Partial<PoFile>) {
  const lines = header.split('\\n');
  for (const line of lines) {
    if (line.includes(': ')) {
      const [key, ...valueParts] = line.split(': ');
      const value = valueParts.join(': ');
      switch (key.toLowerCase()) {
        case 'project-id-version':
          metadata.projectId = value;
          break;
        case 'report-msgid-bugs-to':
          metadata.reportMsgidBugsTo = value;
          break;
        case 'pot-creation-date':
          metadata.potCreationDate = value;
          break;
        case 'po-revision-date':
          metadata.poRevisionDate = value;
          break;
        case 'last-translator':
          metadata.lastTranslator = value;
          break;
        case 'language-team':
          metadata.languageTeam = value;
          break;
        case 'language':
          metadata.targetLanguage = value.replace(/_/g, '-').toLowerCase();
          break;
        case 'x-source-language':
          metadata.sourceLanguage = value.replace(/_/g, '-').toLowerCase();
          break;
        case 'plural-forms':
          metadata.pluralForms = value;
          break;
      }
    }
  }
}

export function serializePoFile(po: PoFile): string {
  const lines: string[] = [];

  // Write header
  if (po.header) {
    lines.push(serializeEntry(po.header, true));
    lines.push('');
  }

  // Write entries
  for (const entry of po.entries) {
    lines.push(serializeEntry(entry));
    lines.push('');
  }

  return lines.join('\n');
}

function serializeEntry(entry: PoEntry, isHeader = false): string {
  const lines: string[] = [];

  // Comments
  for (const comment of entry.comments || []) {
    lines.push(comment);
  }

  // Context
  if (entry.msgctxt) {
    lines.push(`msgctxt ${quoteString(entry.msgctxt)}`);
  }

  // msgid
  if (isHeader) {
    lines.push('msgid ""');
  } else {
    lines.push(`msgid ${quoteString(entry.msgid)}`);
  }

  // Plural form
  if (entry.msgidPlural !== undefined) {
    lines.push(`msgid_plural ${quoteString(entry.msgidPlural)}`);
    if (entry.msgstrPlural) {
      entry.msgstrPlural.forEach((str, index) => {
        lines.push(`msgstr[${index}] ${quoteString(str || '')}`);
      });
    } else {
      lines.push('msgstr[0] ""');
    }
  } else {
    // msgstr
    if (isHeader || !entry.msgstr || entry.msgstr.length === 0) {
      lines.push('msgstr ""');
    } else {
      lines.push(`msgstr ${quoteString(entry.msgstr)}`);
    }
  }

  return lines.join('\n');
}

function quoteString(str: string): string {
  // Escape special characters
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');

  return `"${escaped}"`;
}
