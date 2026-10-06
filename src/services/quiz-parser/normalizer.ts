// Conservative text normalizer - safe transformations without destructive line merging

export function normalizeRawText(raw: string): string {
  if (!raw) return '';

  return raw
    // 1. Line endings to standard \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 2. Tabs to spaces
    .replace(/\t/g, ' ')
    // 3. Special Unicode quotes and dashes
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    // 4. Zero-width spaces and non-breaking spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    // 5. Trim trailing whitespace on each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    // 6. Compress excessive blank lines (3+ -> 2)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

