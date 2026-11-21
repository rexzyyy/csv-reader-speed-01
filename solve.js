export function run(input) {
  const text = String(input.text);
  const n = text.length;
  const header = input.header === true;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  const addError = (code, extraKey, extraValue) => {
    const e = { code, line: recordLine, row: recordRow };
    if (extraKey) e[extraKey] = extraValue;
    errors.push(e);
  };

  while (true) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    let ended;
    do {
      ended = 0;
      lastQuoted = text.charCodeAt(pos) === 34;
      let value = '';
      if (lastQuoted) {
        const open = pos;
        const openLine = line;
        let q = pos + 1;
        let close = -1;
        while (q < n) {
          q = text.indexOf('"', q);
          if (q < 0) break;
          if (text.charCodeAt(q + 1) === 34) { q += 2; continue; }
          close = q;
          break;
        }
        if (close < 0) {
          pos = open + 1;
          line = openLine;
          addError('unterminated_quote');
          lastQuoted = false;
          value = '"';
        } else {
          const raw = text.slice(open + 1, close);
          value = raw;
          if (raw.includes('""')) value = value.split('""').join('"');
          if (raw.includes('\r')) value = value.replace(/\r\n|\r/g, '\n');
          for (let k = open + 1; k < close; k++) {
            const ch = text.charCodeAt(k);
            if (ch === 13) { line++; if (text.charCodeAt(k + 1) === 10) k++; }
            else if (ch === 10) line++;
          }
          pos = close + 1;
          if (pos < n && text.charCodeAt(pos) === 44) { pos++; ended = 1; }
          else if (pos < n && text.charCodeAt(pos) === 10) { pos++; line++; ended = 2; }
          else if (pos + 1 < n && text.charCodeAt(pos) === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; ended = 2; }
          else if (pos >= n) ended = 3;
          else {
            let segmentStart = pos;
            let junkParts = '';
            let junkKept = 0;
            while (pos < n) {
              const d = text.charCodeAt(pos);
              if (d === 44 || d === 10 || (d === 13 && text.charCodeAt(pos + 1) === 10)) break;
              if (d === 13) {
                const kept = text.slice(segmentStart, pos);
                junkParts += kept; junkKept += kept.length;
                addError('stray_cr'); pos++; segmentStart = pos;
              } else pos++;
            }
            const tail = text.slice(segmentStart, pos);
            junkParts += tail; junkKept += tail.length;
            value += junkParts;
            if (junkKept) addError('quote_junk');
            if (pos < n && text.charCodeAt(pos) === 44) { pos++; ended = 1; }
            else if (pos < n && text.charCodeAt(pos) === 10) { pos++; line++; ended = 2; }
            else if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; ended = 2; }
            else if (pos < n && text.charCodeAt(pos) === 13) {
              addError('stray_cr'); pos++;
              while (pos < n && text.charCodeAt(pos) !== 44 && text.charCodeAt(pos) !== 10 && text.charCodeAt(pos) !== 13) pos++;
              if (pos < n && text.charCodeAt(pos) === 44) { pos++; ended = 1; }
              else if (pos < n && text.charCodeAt(pos) === 10) { pos++; line++; ended = 2; }
              else if (pos + 1 < n && text.charCodeAt(pos) === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; ended = 2; }
              else ended = 3;
            }
            else ended = 3;
          }
        }
      }
      if (!lastQuoted) {
        const start = pos;
        let first = value;
        while (pos < n) {
          let comma = text.indexOf(',', pos);
          let lf = text.indexOf('\n', pos);
          let cr = text.indexOf('\r', pos);
          let stop = n;
          if (comma >= 0 && comma < stop) stop = comma;
          if (lf >= 0 && lf < stop) stop = lf;
          if (cr >= 0 && cr < stop) stop = cr;
          if (stop > pos) { value = first + text.slice(pos, stop); first = ''; pos = stop; }
          if (pos >= n) break;
          const d = text.charCodeAt(pos);
          if (d === 44) { pos++; ended = 1; break; }
          if (d === 10) { pos++; line++; ended = 2; break; }
          if (text.charCodeAt(pos + 1) === 10) { pos += 2; line++; ended = 2; break; }
          addError('stray_cr');
          pos++;
          first = value;
          value = '';
        }
        if (pos >= n && ended === 0) ended = 3;
      }
      fields.push(value);
    } while (ended === 1);

    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      addError('short_row', 'fields', fields.length);
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      const extra = fields.splice(width);
      addError('long_row', 'extra', extra);
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
