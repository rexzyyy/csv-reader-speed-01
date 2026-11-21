export function run(input) {
  const text = String(input.text);
  const length = text.length;
  const header = input.header === true;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  while (true) {
    while (pos < length) {
      const code = text.charCodeAt(pos);
      if (code === 10) { pos++; line++; }
      else if (code === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= length) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let lastWasQuoted;

    do {
      ended = 0;
      lastWasQuoted = text.charCodeAt(pos) === 34;
      let fallbackUnquoted = false;
      let value = '';

      if (lastWasQuoted) {
        const open = pos;
        const openLine = line;
        let scan = open + 1;
        let close = -1;
        while (scan < length) {
          scan = text.indexOf('"', scan);
          if (scan < 0) break;
          if (text.charCodeAt(scan + 1) === 34) { scan += 2; continue; }
          close = scan;
          break;
        }

        if (close < 0) {
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          fallbackUnquoted = true;
          value = '"';
        } else {
          const raw = text.slice(open + 1, close);
          value = raw;
          if (raw.indexOf('""') >= 0) value = raw.replace(/""/g, '"');
          if (raw.indexOf('\r') >= 0) value = value.replace(/\r\n|\r/g, '\n');

          let found = raw.indexOf('\n');
          while (found >= 0) {
            line++;
            found = raw.indexOf('\n', found + 1);
          }
          found = raw.indexOf('\r');
          while (found >= 0) {
            if (raw.charCodeAt(found + 1) !== 10) line++;
            found = raw.indexOf('\r', found + 1);
          }

          pos = close + 1;
          if (pos < length && text.charCodeAt(pos) === 44) { pos++; ended = 1; }
          else if (pos < length && text.charCodeAt(pos) === 10) { pos++; line++; ended = 2; }
          else if (pos + 1 < length && text.charCodeAt(pos) === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; ended = 2; }
          else if (pos >= length) ended = 3;
          else {
            let segment = pos;
            let junk = '';
            let junkLength = 0;
            while (pos < length) {
              let comma = text.indexOf(',', pos);
              let lf = text.indexOf('\n', pos);
              let stop = length;
              if (comma >= 0 && comma < stop) stop = comma;
              if (lf >= 0 && lf < stop) stop = lf;
              const cr = text.indexOf('\r', pos);
              if (cr >= 0 && cr < stop) stop = cr;
              if (stop > pos) pos = stop;
              if (pos >= length) break;
              const code = text.charCodeAt(pos);
              if (code === 44) { junk += text.slice(segment, pos); junkLength += pos - segment; pos++; segment = pos; ended = 1; break; }
              if (code === 10) { junk += text.slice(segment, pos); junkLength += pos - segment; pos++; segment = pos; line++; ended = 2; break; }
              if (text.charCodeAt(pos + 1) === 10) { junk += text.slice(segment, pos); junkLength += pos - segment; pos += 2; segment = pos; line++; ended = 2; break; }
              const part = text.slice(segment, pos);
              junk += part;
              junkLength += part.length;
              errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
              pos++;
              segment = pos;
            }
            const tail = text.slice(segment, pos);
            junk += tail;
            junkLength += tail.length;
            value += junk;
            if (junkLength > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
            if (ended === 0) ended = 3;
          }
        }
      }

      if (!lastWasQuoted || fallbackUnquoted) {
        const initial = value;
        const start = pos;
        let comma = text.indexOf(',', pos);
        let lf = text.indexOf('\n', pos);
        let stop = length;
        if (comma >= 0 && comma < stop) stop = comma;
        if (lf >= 0 && lf < stop) stop = lf;
        let cr = text.indexOf('\r', pos);
        if (cr >= 0 && cr < stop && text.charCodeAt(cr + 1) === 10) stop = cr;
        if (cr >= 0 && cr < stop) {
          let segment = start;
          let parts = '';
          while (cr >= 0 && cr < stop) {
            parts += text.slice(segment, cr);
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            pos = cr + 1;
            segment = pos;
            comma = text.indexOf(',', pos);
            lf = text.indexOf('\n', pos);
            stop = length;
            if (comma >= 0 && comma < stop) stop = comma;
            if (lf >= 0 && lf < stop) stop = lf;
            cr = text.indexOf('\r', pos);
            if (cr >= 0 && cr < stop && text.charCodeAt(cr + 1) === 10) stop = cr;
            if (cr < 0 || cr >= stop) break;
          }
          parts += text.slice(segment, stop);
          value = initial + parts;
        } else {
          value = initial + text.slice(start, stop);
        }
        pos = stop;
        if (pos >= length) ended = 3;
        else {
          const code = text.charCodeAt(pos);
          if (code === 44) { pos++; ended = 1; }
          else if (code === 10) { pos++; line++; ended = 2; }
          else { pos += 2; line++; ended = 2; }
        }
      }
      fields.push(value);
    } while (ended === 1);

    if (fields.length === 1 && fields[0] === '' && !lastWasQuoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
