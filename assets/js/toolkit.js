/*
  Gamry .DTA -> Excel converter (client-side)

  What it supports (broadly):
  - Gamry DTA "...\tTABLE" blocks (EIS ZCURVE, OCVCURVE, CV curves, etc.)
  - Fortran-style D exponents (e.g., 1.23D-04)

  Output:
  - One Excel sheet per TABLE block
  - Optional "Header" sheet with key/value metadata parsed from the file header

  Notes:
  - Runs fully in-browser; your file is processed locally (no upload).
*/

(function () {
  function $(id) { return document.getElementById(id); }

  const fileInput = $('dtaFile');
  const convertBtn = $('convertBtn');
  const statusEl = $('toolkitStatus');
  const includeHeaderSheet = $('includeHeaderSheet');

  if (!fileInput || !convertBtn || !statusEl) return; // section not present

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function toFloat(tok) {
    if (tok == null) return NaN;
    const s = String(tok).trim().replace(/D/gi, 'E');
    // Some DTAs use comma as thousands separators occasionally; strip commas.
    const v = Number(s.replace(/,/g, ''));
    return Number.isFinite(v) ? v : NaN;
  }

  function safeSheetName(name) {
    const bad = /[\[\]:*?/\\]/g;
    let out = String(name).replace(bad, '_').trim();
    if (!out) out = 'Sheet';
    return out.slice(0, 31);
  }

  function splitAny(line) {
    // DTA tables can be tab-indented; whitespace split works fine.
    return String(line).trim().split(/\s+/).filter(Boolean);
  }

  function isTableStart(line) {
    // Examples:
    //   OCVCURVE\tTABLE\t39
    //   ZCURVE\tTABLE
    //   CURVE1\tTABLE
    // Accept letters/numbers/underscore in the table name.
    const m = String(line || '').match(/^\s*([A-Za-z][A-Za-z0-9_]*)(?:\s+|\t+)TABLE\b/i);
    return m ? m[1] : null;
  }

  function isNumericRow(line) {
    const s = String(line || '').trim();
    if (!s) return false;
    // Typical data rows start with an integer point index.
    return /^[+-]?\d+(?:\s+|\t+)/.test(s);
  }

  function isHeaderKV(line) {
    // Key/value lines often look like: KEY\tLABEL\tVALUE\t...
    const parts = String(line || '').split(/\t+/).filter(x => x !== '');
    return parts.length >= 3 && /^[A-Za-z&]/.test(parts[0]);
  }

  function parseHeader(lines) {
    const header = {};
    for (let i = 0; i < lines.length; i++) {
      const raw = (lines[i] || '').trim();
      if (!raw) continue;

      // Stop once we hit the first TABLE block
      if (isTableStart(raw)) break;

      if (!isHeaderKV(raw)) continue;

      const parts = raw.split(/\t+/).filter(x => x !== '');
      if (parts.length < 3) continue;

      const key = parts[0];
      const rest = parts.slice(2);

      // Heuristic: collect numeric-ish tokens until we hit a "word" token
      const vals = [];
      for (const tok of rest) {
        const t = String(tok);
        const startsWithLetterOrAmp = /^[A-Za-z&]/.test(t);
        const startsWithSignOrDigit = /^[+-]?\d/.test(t);
        if (startsWithLetterOrAmp && !startsWithSignOrDigit) break;
        vals.push(t);
      }

      const nums = vals.map(toFloat).filter(v => !Number.isNaN(v));
      if (nums.length === 0) header[key] = rest.join(' ').trim();
      else if (nums.length === 1) header[key] = nums[0];
      else header[key] = nums;
    }
    return header;
  }

  function parseTables(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const n = lines.length;

    const header = parseHeader(lines);
    const tables = [];

    let i = 0;
    while (i < n) {
      const name = isTableStart(lines[i]);
      if (!name) { i++; continue; }

      // Jump to next non-empty line after the TABLE line
      i++;
      while (i < n && !(lines[i] || '').trim()) i++;
      if (i >= n) break;

      // Column header line (often tab-indented)
      const colLine = (lines[i] || '').trim();
      const cols = splitAny(colLine);
      i++;

      // Units line (optional but common)
      let units = '';
      if (i < n) {
        const maybeUnits = (lines[i] || '').trim();
        // Units rows often start with "#" or have non-numeric tokens and same count as cols
        // We'll accept it if it's not a numeric data row.
        if (maybeUnits && !isNumericRow(maybeUnits) && !isTableStart(maybeUnits)) {
          units = maybeUnits;
          i++;
        }
      }

      const rows = [];
      while (i < n) {
        const line = lines[i] || '';
        const trimmed = line.trim();
        if (!trimmed) { i++; break; }

        // Stop if next table begins
        if (isTableStart(trimmed)) break;

        // Many DTAs have other header-ish blocks after tables; stop if we leave numeric rows
        if (!isNumericRow(trimmed)) {
          // If it's clearly another KEY/VALUE block, end this table.
          if (isHeaderKV(trimmed)) break;
          // Otherwise, skip weird lines inside the table.
          i++;
          continue;
        }

        let toks = splitAny(trimmed);
        // Normalize token count to columns
        if (toks.length < cols.length) {
          toks = toks.concat(Array(cols.length - toks.length).fill(''));
        } else if (toks.length > cols.length) {
          toks = toks.slice(0, cols.length);
        }

        const numRow = toks.map(tok => {
          const v = toFloat(tok);
          return Number.isNaN(v) ? null : v;
        });
        rows.push(numRow);
        i++;
      }

      tables.push({ name, cols, units, rows });
    }

    return { header, tables };
  }

  function headerToSheetAOA(headerObj) {
    const keys = Object.keys(headerObj);
    const aoa = [['Key', 'Value']];
    for (const k of keys) {
      const v = headerObj[k];
      if (Array.isArray(v)) aoa.push([k, v.join(', ')]);
      else aoa.push([k, v]);
    }
    return aoa;
  }

  function tableToSheetAOA(tbl) {
    const aoa = [];
    aoa.push(tbl.cols);

    if (tbl.units && String(tbl.units).trim()) {
      const unitRow = splitAny(tbl.units);
      // pad/trim
      const out = unitRow.slice(0, tbl.cols.length);
      while (out.length < tbl.cols.length) out.push('');
      aoa.push(out);
    }

    for (const r of (tbl.rows || [])) aoa.push(r);
    return aoa;
  }

  async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsText(file);
    });
  }

  function baseName(filename) {
    return String(filename).replace(/\.[^.]+$/, '');
  }

  async function handleConvert() {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!window.XLSX) {
      setStatus('Excel exporter library failed to load. Please refresh the page.');
      return;
    }

    convertBtn.disabled = true;
    setStatus('Reading file…');

    try {
      const text = await readFileAsText(file);
      setStatus('Parsing .DTA…');

      const parsed = parseTables(text);
      const tables = parsed.tables || [];

      if (tables.length === 0) {
        setStatus('No TABLE blocks found in this .DTA. If it’s a special format, use the desktop version.');
        return;
      }

      setStatus(`Building Excel… (${tables.length} table${tables.length === 1 ? '' : 's'})`);

      const wb = XLSX.utils.book_new();

      if (includeHeaderSheet && includeHeaderSheet.checked) {
        const aoa = headerToSheetAOA(parsed.header || {});
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Header');
      }

      const usedNames = new Set();
      tables.forEach((t, idx) => {
        const aoa = tableToSheetAOA(t);
        let sheet = safeSheetName(t.name || `Table ${idx + 1}`);
        // de-dup sheet names
        if (usedNames.has(sheet)) {
          const base = sheet.slice(0, 27);
          let k = 2;
          while (usedNames.has(safeSheetName(`${base}_${k}`))) k++;
          sheet = safeSheetName(`${base}_${k}`);
        }
        usedNames.add(sheet);

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
      });

      const outName = `${baseName(file.name)}_export.xlsx`;
      XLSX.writeFile(wb, outName);

      setStatus(`Done! Downloaded: ${outName}`);
    } catch (err) {
      console.error(err);
      setStatus('Conversion failed. If this persists, share the DTA file format and I can extend the parser.');
    } finally {
      convertBtn.disabled = false;
    }
  }

  // Wire up UI
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      convertBtn.disabled = true;
      setStatus('Choose a file to enable conversion.');
      return;
    }
    convertBtn.disabled = false;
    setStatus(`Ready: ${file.name}`);
  });

  convertBtn.addEventListener('click', handleConvert);
})();
