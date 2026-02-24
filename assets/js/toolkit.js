/*
  Gamry .DTA -> Excel converter (client-side)
  - Parses header key/value lines until first CURVE# TABLE
  - Parses each CURVE block into a 2D table
  - Exports an .xlsx workbook using SheetJS (XLSX)

  Notes:
  - Runs fully in-browser; no uploads.
  - Supports Fortran-style D exponents (e.g., 1.23D-04).
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
    const s = String(tok).replace(/D/g, 'E');
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }

  function safeSheetName(name) {
    const bad = /[\[\]:*?/\\]/g;
    let out = String(name).replace(bad, '_').trim();
    if (!out) out = 'Sheet';
    return out.slice(0, 31);
  }

  function looksCurveLine(line) {
    return /^\s*CURVE\d+\s+TABLE/i.test(line);
  }

  function splitTabs(line) {
    return line.split(/\t+/).filter(x => x !== '');
  }

  function splitSpaces(line) {
    return line.trim().split(/\s+/).filter(Boolean);
  }

  function parseGamryDTA(text) {
    // Keep original lines (no CR)
    const lines = text.replace(/\r/g, '').split('\n');

    const header = {};
    const curves = [];

    let i = 0;
    const n = lines.length;

    // Header: until first curve line
    while (i < n && !looksCurveLine(lines[i])) {
      const raw = (lines[i] || '').trim();
      if (!raw) { i++; continue; }

      const parts = splitTabs(raw);
      if (parts.length >= 3) {
        const key = parts[0];
        const typ = parts[1]; // unused but kept for compatibility
        const rest = parts.slice(2);

        // Match the python logic: stop collecting numeric-ish tokens when we hit a word-ish token
        const vals = [];
        for (const tok of rest) {
          const startsWithLetterOrAmp = /^[A-Za-z&]/.test(tok);
          const startsWithSignOrDigit = /^[+-]?\d/.test(tok);
          if (startsWithLetterOrAmp && !startsWithSignOrDigit) break;
          vals.push(tok);
        }

        const nums = vals.map(toFloat).filter(v => !Number.isNaN(v));
        if (nums.length === 0) {
          header[key] = rest.join(' ').trim();
        } else if (nums.length === 1) {
          header[key] = nums[0];
        } else {
          header[key] = nums;
        }
      }

      i++;
    }

    // Curves
    while (i < n) {
      while (i < n && !looksCurveLine(lines[i])) i++;
      if (i >= n) break;

      // Skip CURVE# TABLE line
      i++;
      if (i + 1 >= n) break;

      const colLine = (lines[i] || '').trim();
      const unitLine = (lines[i + 1] || '').trim();
      i += 2;

      const cols = splitSpaces(colLine);
      const rows = [];

      while (i < n) {
        const line = (lines[i] || '');
        if (!line.trim()) break;
        if (looksCurveLine(line)) break;

        let row = splitSpaces(line);
        if (row.length < cols.length) {
          row = row.concat(Array(cols.length - row.length).fill(''));
        } else if (row.length > cols.length) {
          row = row.slice(0, cols.length);
        }

        // Convert numeric-looking values; keep NaN for blanks/invalids
        const numRow = row.map(tok => {
          const cleaned = String(tok).replace(/,/g, '');
          const v = toFloat(cleaned);
          return Number.isNaN(v) ? null : v;
        });

        rows.push(numRow);
        i++;
      }

      curves.push({ cols, rows, units: unitLine });

      // Skip blank lines until next curve
      while (i < n && !looksCurveLine(lines[i]) && !(lines[i] || '').trim()) i++;
    }

    return { header, curves };
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

  function curveToSheetAOA(curve, index) {
    const aoa = [];
    aoa.push(curve.cols);
    // Optional: include units row if present
    if (curve.units && curve.units.trim()) {
      const units = splitSpaces(curve.units);
      // Pad/trim units to columns
      const unitRow = units.slice(0, curve.cols.length);
      while (unitRow.length < curve.cols.length) unitRow.push('');
      aoa.push(unitRow);
    }

    for (const row of curve.rows) aoa.push(row);
    return aoa;
  }

  async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => resolve(String(reader.result || ''));
      // Many DTAs are latin-1-ish; browsers read as UTF-8 by default.
      // This usually still works because we mostly parse ASCII tables.
      reader.readAsText(file);
    });
  }

  function baseName(filename) {
    return filename.replace(/\.[^.]+$/, '');
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

      const parsed = parseGamryDTA(text);
      const curves = parsed.curves || [];

      if (curves.length === 0) {
        setStatus('No CURVE tables found in this file. If this is an unusual DTA format, use the desktop version.');
        convertBtn.disabled = false;
        return;
      }

      setStatus(`Building Excel… (${curves.length} curve${curves.length === 1 ? '' : 's'})`);

      const wb = XLSX.utils.book_new();

      if (includeHeaderSheet && includeHeaderSheet.checked) {
        const aoa = headerToSheetAOA(parsed.header || {});
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, 'Header');
      }

      curves.forEach((c, idx) => {
        const aoa = curveToSheetAOA(c, idx + 1);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName(`Curve ${idx + 1}`));
      });

      const outName = `${baseName(file.name)}_export.xlsx`;
      XLSX.writeFile(wb, outName);

      setStatus(`Done! Downloaded: ${outName}`);
    } catch (err) {
      console.error(err);
      setStatus('Conversion failed. Try the desktop version for this file, or share the DTA format if you want broader support.');
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
