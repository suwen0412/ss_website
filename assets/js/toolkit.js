
/*
  Gamry .DTA -> Excel converter (client-side)

  Updated:
  - Supports CV/CA/CP AND EIS-style files by parsing ANY "<NAME> TABLE" block
    e.g., "CURVE1 TABLE", "ZCURVE TABLE", "OCVCURVE TABLE", etc.
  - Exports one worksheet per TABLE block
  - Optional "Header" sheet with parsed key/value metadata (no uploads; local-only)

  Notes:
  - Runs fully in-browser; no uploads.
  - Supports Fortran-style D exponents (e.g., 1.23D-04).
*/
(function () {
  function $(id) { return document.getElementById(id); }

  const fileInput = $("dtaFile");
  const btn = $("convertBtn");
  const status = $("toolkitStatus");
  const includeHeaderSheet = $("includeHeaderSheet");

  if (!fileInput || !btn || !status) return;

  function setStatus(msg) { status.textContent = msg; }

  function parseNum(tok) {
    if (tok == null) return NaN;
    const s = String(tok).trim().replace(/D/gi, "E");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function splitWS(line) {
    return String(line).trim().split(/\s+/).filter(Boolean);
  }

  function isTableStart(line) {
    // e.g. "CURVE1 TABLE", "ZCURVE TABLE"
    const m = String(line).trim().match(/^(\S+)\s+TABLE\b/i);
    return m ? m[1] : null;
  }

  function parseHeaderKV(lines) {
    const kv = [];
    for (const raw of lines) {
      const line = String(raw || "").trim();
      if (!line) continue;

      // Common formats: "KEY: VALUE", "KEY = VALUE"
      let m = line.match(/^([^:=]{2,}?)\s*[:=]\s*(.+)$/);
      if (m) {
        kv.push([m[1].trim(), m[2].trim()]);
      }
    }
    return kv;
  }

  function parseTables(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    // Collect header-ish lines until we hit the first TABLE
    const headerLines = [];
    let i = 0;
    while (i < lines.length) {
      const tname = isTableStart(lines[i]);
      if (tname) break;
      headerLines.push(lines[i]);
      i += 1;
    }

    const tables = [];

    while (i < lines.length) {
      const tname = isTableStart(lines[i]);
      if (!tname) { i += 1; continue; }

      i += 1;

      // Find header row (first non-empty line that isn't another TABLE)
      while (i < lines.length && !String(lines[i]).trim()) i += 1;
      if (i >= lines.length) break;
      if (isTableStart(lines[i])) continue;

      const colLine = lines[i];
      const cols = splitWS(colLine);
      i += 1;

      const rows = [];
      while (i < lines.length) {
        const line = lines[i];
        const nextName = isTableStart(line);
        if (nextName) break;

        const s = String(line || "").trim();
        if (!s) { i += 1; continue; }

        const toks = splitWS(s);
        if (toks.length >= 2) {
          // If looks numeric-ish, keep; otherwise skip (some tables have separators)
          const nums = toks.map(parseNum);
          const numericCount = nums.filter(v => Number.isFinite(v)).length;

          // Accept rows where at least half tokens parse as numbers
          if (numericCount >= Math.ceil(toks.length / 2)) {
            // pad/truncate to cols length for cleaner sheets
            const out = [];
            for (let k = 0; k < cols.length; k++) {
              const v = toks[k];
              const n = parseNum(v);
              out.push(Number.isFinite(n) ? n : (v ?? ""));
            }
            rows.push(out);
          }
        }

        i += 1;
      }

      tables.push({ name: tname, cols, rows });
    }

    return { headerLines, tables };
  }

  function workbookFromParsed(parsed, includeHeader) {
    const wb = XLSX.utils.book_new();

    if (includeHeader) {
      const kv = parseHeaderKV(parsed.headerLines);
      const hdr = [["Key", "Value"], ...kv];
      const ws = XLSX.utils.aoa_to_sheet(hdr);
      XLSX.utils.book_append_sheet(wb, ws, "Header");
    }

    if (!parsed.tables.length) {
      const ws = XLSX.utils.aoa_to_sheet([["No TABLE blocks found in this file."]]);
      XLSX.utils.book_append_sheet(wb, ws, "NoData");
      return wb;
    }

    parsed.tables.forEach((t, idx) => {
      const aoa = [t.cols, ...t.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Ensure unique & Excel-safe sheet names (<=31 chars)
      let sheetName = t.name.slice(0, 31);
      if (!sheetName) sheetName = `TABLE_${idx + 1}`;
      if (wb.SheetNames.includes(sheetName)) sheetName = (sheetName.slice(0, 28) + "_" + (idx + 1));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    return wb;
  }

  function defaultOutName(file) {
    const base = (file.name || "gamry").replace(/\.[^.]+$/, "");
    return `${base}.xlsx`;
  }

  fileInput.addEventListener("change", () => {
    btn.disabled = !fileInput.files || !fileInput.files.length;
    setStatus(btn.disabled ? "Choose a file to enable conversion." : "Ready. Click Convert to generate Excel.");
  });

  btn.addEventListener("click", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    btn.disabled = true;
    setStatus("Reading file…");

    try {
      const text = await file.text();
      const parsed = parseTables(text);

      setStatus(`Found ${parsed.tables.length} table(s). Building workbook…`);

      const wb = workbookFromParsed(parsed, includeHeaderSheet && includeHeaderSheet.checked);
      const outName = defaultOutName(file);

      XLSX.writeFile(wb, outName);
      setStatus(`Done: downloaded ${outName}`);
    } catch (e) {
      console.error(e);
      setStatus("Conversion failed. If this is an unusual DTA variant, please share a sample file.");
    } finally {
      btn.disabled = false;
    }
  });

  setStatus("Choose a file to enable conversion.");
})();
