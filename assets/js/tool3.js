(function () {
  const $ = (id) => document.getElementById(id);

  const elFile = $("tool3File");
  const elLoadExampleBtn = $("tool3LoadExampleBtn");
  const elSheet = $("tool3Sheet");
  const elPlotType = $("tool3PlotType");
  const elShiftPanel = $("tool3ShiftPanel");
  const elTrajPanel = $("tool3TrajectoryPanel");
  const elTimeShift = $("tool3TimeShift");
  const elShiftVar = $("tool3ShiftVar");
  const elSkip = $("tool3Skip");
  const elLagWindow = $("tool3LagWindow");
  const elLagMode = $("tool3LagMode");
  const elTimeTraj = $("tool3TimeTraj");
  const elMode = $("tool3Mode");
  const elX = $("tool3X");
  const elY = $("tool3Y");
  const elZ = $("tool3Z");
  const elZWrap = $("tool3ZWrap");
  const elGifQuality = $("tool3GifQuality");
  const elFrames = $("tool3Frames");
  const elFps = $("tool3Fps");
  const elPointSize = $("tool3PointSize");
  const elMakeGif = $("tool3MakeGif");
  const elFramesZipBtn = $("tool3FramesZipBtn");
  const elFramesZipDownload = $("tool3FramesZipDownload");
  const elGifDownload = $("tool3GifDownload");
  const elGifStatus = $("tool3GifStatus");
  const elGifPreview = $("tool3GifPreview");
  const elMergeZipFile = $("tool3MergeZipFile");
  const elMergeFps = $("tool3MergeFps");
  const elMergeGifBtn = $("tool3MergeGifBtn");
  const elMergeGifDownload = $("tool3MergeGifDownload");
  const elMergeStatus = $("tool3MergeStatus");
  const elMergePreview = $("tool3MergePreview");
  const elLoadStatus = $("tool3LoadStatus");
  const elSummary = $("tool3Summary");
  const elPlot = $("tool3Plot");
  const elMeta = $("tool3Meta");

  if (!elFile || !elSheet || !elPlot) return;

  const state = {
    workbook: null,
    fileName: "",
    sheetName: "",
    headers: [],
    rows: [],
    numericHeaders: [],
    gifUrl: "",
    frameZipUrl: "",
    mergeGifUrl: ""
  };

  function safeText(v) {
    return String(v == null ? "" : v).trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function num(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = safeText(v).replace(/,/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function clampInt(v, lo, hi, fallback) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i += 1; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === ',') {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function parseCsvMatrix(text) {
    const cleaned = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    const lines = cleaned.split("\n");
    return lines.filter((line) => line !== "").map(parseCsvLine);
  }

  function getPlotSize() {
    const width = Math.max(520, Math.floor(elPlot.clientWidth || 920));
    const height = Math.max(420, Math.floor(elPlot.clientHeight || 620));
    return { width, height };
  }

  function setPlotCanvas(canvas) {
    if (!canvas || !elPlot) return;
    elPlot.innerHTML = "";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    elPlot.appendChild(canvas);
  }

  function setPlotPlaceholder(message) {
    if (!elPlot) return;
    elPlot.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:18px;text-align:center;padding:20px;">${escapeHtml(message)}</div>`;
  }

  function setLoadStatus(msg) { if (elLoadStatus) elLoadStatus.textContent = msg; }
  function setGifStatus(msg) { if (elGifStatus) elGifStatus.textContent = msg; }
  function setMeta(msg) { if (elMeta) elMeta.textContent = msg; }
  function setGifPreview(html) { if (elGifPreview) elGifPreview.innerHTML = html; }

  function setDownloadLink(linkEl, enabled, href, filename) {
    if (!linkEl) return;
    if (enabled) {
      linkEl.href = href || "#";
      if (filename) linkEl.download = filename;
      linkEl.removeAttribute("aria-disabled");
      linkEl.style.pointerEvents = "";
      linkEl.style.opacity = "";
    } else {
      linkEl.href = "#";
      linkEl.setAttribute("aria-disabled", "true");
      linkEl.style.pointerEvents = "none";
      linkEl.style.opacity = ".55";
    }
  }

  function setGifDownloadEnabled(enabled, href, filename) {
    setDownloadLink(elGifDownload, enabled, href, filename);
  }

  function setFramesZipDownloadEnabled(enabled, href, filename) {
    setDownloadLink(elFramesZipDownload, enabled, href, filename);
  }

  function setMergeGifDownloadEnabled(enabled, href, filename) {
    setDownloadLink(elMergeGifDownload, enabled, href, filename);
  }

  function revokeObjectUrl(key) {
    if (state[key] && state[key].startsWith("blob:")) URL.revokeObjectURL(state[key]);
    state[key] = "";
  }

  function revokeGifUrl() {
    revokeObjectUrl("gifUrl");
  }

  function revokeFrameZipUrl() {
    revokeObjectUrl("frameZipUrl");
  }

  function revokeMergeGifUrl() {
    revokeObjectUrl("mergeGifUrl");
  }

  function setMergeStatus(msg) { if (elMergeStatus) elMergeStatus.textContent = msg; }
  function setMergePreview(html) { if (elMergePreview) elMergePreview.innerHTML = html; }

  function isLag3D() {
    return !!(elLagMode && elLagMode.value === "3d");
  }

  function yieldToUi() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function uniqueHeaders(row0) {
    const used = new Map();
    return row0.map((raw, i) => {
      const base = safeText(raw) || `Column ${i + 1}`;
      const seen = used.get(base) || 0;
      used.set(base, seen + 1);
      return seen ? `${base} (${seen + 1})` : base;
    });
  }

  function optionList(selectEl, values, preferred) {
    if (!selectEl) return;
    if (!values || !values.length) {
      selectEl.innerHTML = '<option value="">No options</option>';
      return;
    }
    const current = selectEl.value;
    selectEl.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if (preferred && values.includes(preferred)) selectEl.value = preferred;
    else if (current && values.includes(current)) selectEl.value = current;
    else selectEl.value = values[0];
  }

  function parseMatrixToState(name, matrix) {
    if (!matrix.length) {
      state.sheetName = name;
      state.headers = [];
      state.rows = [];
      state.numericHeaders = [];
      return;
    }
    const headers = uniqueHeaders(matrix[0]);
    const rows = matrix.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    }).filter((obj) => Object.values(obj).some((v) => safeText(v) !== ""));

    const numericHeaders = headers.filter((h) => {
      let valid = 0, numeric = 0;
      for (const row of rows) {
        const raw = row[h];
        if (safeText(raw) === "") continue;
        valid += 1;
        if (Number.isFinite(num(raw))) numeric += 1;
      }
      return valid > 0 && numeric / valid >= 0.6;
    });

    state.sheetName = name;
    state.headers = headers;
    state.rows = rows;
    state.numericHeaders = numericHeaders;
  }

  function parseSheet(name) {
    if (!state.workbook || !name) return;
    const ws = state.workbook.Sheets[name];
    if (!ws) return;
    if (ws.__matrix) {
      parseMatrixToState(name, ws.__matrix);
      return;
    }
    if (!window.XLSX) return;
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    parseMatrixToState(name, matrix);
  }

  function guessTimeColumn() {
    const lower = state.headers.map((h) => h.toLowerCase());
    const exact = ["time", "t", "time (s)", "time(s)", "timestamp"];
    for (const target of exact) {
      const idx = lower.indexOf(target);
      if (idx >= 0) return state.headers[idx];
    }
    const partial = state.headers.find((h) => h.toLowerCase().includes("time"));
    return partial || state.headers[0] || "";
  }

  function refreshControls() {
    const timeGuess = guessTimeColumn();
    optionList(elTimeShift, state.headers, timeGuess);
    optionList(elTimeTraj, state.headers, timeGuess);

    const numeric = state.numericHeaders.length ? state.numericHeaders : state.headers;
    const nonTime = numeric.filter((h) => h !== timeGuess);
    const vars = nonTime.length ? nonTime : numeric;

    optionList(elShiftVar, vars, vars[0] || "");
    optionList(elX, vars, vars[0] || "");
    optionList(elY, vars, vars[1] || vars[0] || "");
    optionList(elZ, vars, vars[2] || vars[0] || "");

    setLoadStatus(
      state.rows.length
        ? `Loaded ${state.rows.length} rows from “${state.sheetName}”.`
        : "This sheet is empty or could not be read."
    );
  }

  async function loadWorkbookFromFile(file) {
    state.fileName = file.name || "uploaded file";
    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (ext === "csv" || ext === "txt") {
      const text = await file.text();
      state.workbook = null;
      const matrix = parseCsvMatrix(text);
      elSheet.innerHTML = '<option value="CSV data">CSV data</option>';
      elSheet.value = "CSV data";
      parseMatrixToState("CSV data", matrix);
      refreshControls();
      renderCurrentPlot();
      return;
    }

    if (!window.XLSX) {
      throw new Error("The Excel reader did not load on this page. Use Load built-in example, or save your file as CSV and upload that instead.");
    }

    const buffer = await file.arrayBuffer();
    state.workbook = XLSX.read(buffer, { type: "array" });

    const sheets = (state.workbook && state.workbook.SheetNames) ? state.workbook.SheetNames : [];
    if (!sheets.length) {
      elSheet.innerHTML = '<option value="">No sheets found</option>';
      state.sheetName = "";
      state.headers = [];
      state.rows = [];
      state.numericHeaders = [];
      setLoadStatus("This file did not contain any readable sheets.");
      renderCurrentPlot();
      return;
    }

    elSheet.innerHTML = sheets.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    elSheet.value = sheets[0];
    parseSheet(sheets[0]);
    refreshControls();
    renderCurrentPlot();
  }

  async function loadBuiltInExample() {
    setLoadStatus("Loading built-in example…");
    const res = await fetch("assets/data/toolkit3_example.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load the built-in example data.");
    const payload = await res.json();
    const sheetNames = Object.keys(payload);
    if (!sheetNames.length) throw new Error("Built-in example data is empty.");
    state.workbook = { Sheets: {}, SheetNames: sheetNames.slice() };
    state.fileName = "Built-in example";
    sheetNames.forEach((name) => {
      state.workbook.Sheets[name] = { __matrix: payload[name] };
    });
    elSheet.innerHTML = sheetNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    elSheet.value = sheetNames[0];
    parseMatrixToState(sheetNames[0], payload[sheetNames[0]] || []);
    refreshControls();
    renderCurrentPlot();
    setLoadStatus(`Loaded ${state.rows.length} rows from “${state.sheetName}”.`);
  }

  function getLagData() {
    const tCol = elTimeShift.value;
    const yCol = elShiftVar.value;
    const skip = clampInt(elSkip.value, 1, 100000, 1);

    const timeVals = [];
    const signal = [];
    for (let i = 0; i < state.rows.length; i++) {
      const yv = num(state.rows[i][yCol]);
      const tvRaw = state.rows[i][tCol];
      const tvNum = num(tvRaw);
      if (!Number.isFinite(yv)) continue;
      signal.push(yv);
      timeVals.push(Number.isFinite(tvNum) ? tvNum : i);
    }

    const n = Math.max(0, signal.length - skip);
    const x = [], y = [], t = [];
    for (let i = 0; i < n; i++) {
      x.push(signal[i]);
      y.push(signal[i + skip]);
      t.push(timeVals[i + skip]);
    }

    return { tCol, yCol, skip, x, y, t, signalLength: signal.length };
  }

  function getTrajectoryData() {
    const mode = elMode.value;
    const xCol = elX.value, yCol = elY.value, zCol = elZ.value, tCol = elTimeTraj.value;
    const pts = [];
    for (const row of state.rows) {
      const xv = num(row[xCol]);
      const yv = num(row[yCol]);
      const zv = num(row[zCol]);
      const tvRaw = row[tCol];
      const tvNum = num(tvRaw);
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
      if (mode === "3d" && !Number.isFinite(zv)) continue;
      pts.push({ x: xv, y: yv, z: zv, t: tvRaw, tSort: Number.isFinite(tvNum) ? tvNum : pts.length });
    }
    pts.sort((a, b) => a.tSort - b.tSort);
    const out = { mode, xCol, yCol, zCol, tCol, x: [], y: [], z: [], t: [] };
    for (const p of pts) {
      out.x.push(p.x);
      out.y.push(p.y);
      if (mode === "3d") out.z.push(p.z);
      out.t.push(p.t);
    }
    return out;
  }

  function build3DScene(xTitle, yTitle, zTitle) {
    return {
      xaxis: { title: xTitle, automargin: true },
      yaxis: { title: yTitle, automargin: true },
      zaxis: { title: zTitle, automargin: true },
      aspectmode: "data",
      dragmode: "turntable",
      camera: { eye: { x: 1.55, y: 1.55, z: 1.15 } }
    };
  }

  function renderShiftPreviewCanvas(d) {
    const size = getPlotSize();
    if (isLag3D()) return renderLag3DGifFrame(d, Math.max(0, d.x.length - 1), { width: size.width, height: size.height });
    const canvas = createCanvas(size), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 60, r: 24, t: 50, b: 48 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const all = d.x.concat(d.y);
    const [xmin, xmax] = getMinMax(all);
    const [ymin, ymax] = getMinMax(all);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;
    drawBackground(ctx, w, h, `2D lag plot: ${d.yCol}(n) vs ${d.yCol}(n+${d.skip})`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax);
    ctx.save();
    ctx.strokeStyle = "#9ca3af";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xMap(xmin), yMap(xmin));
    ctx.lineTo(xMap(xmax), yMap(xmax));
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < d.x.length; i++) {
      const xx = xMap(d.x[i]), yy = yMap(d.y[i]);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    const ps = clampInt(elPointSize.value, 4, 24, 11);
    if (d.x.length) {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(xMap(d.x[d.x.length - 1]), yMap(d.y[d.y.length - 1]), ps * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText(`${d.yCol}(n)`, w / 2 - 24, h - 12);
    ctx.save();
    ctx.translate(16, h / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${d.yCol}(n+${d.skip})`, 0, 0);
    ctx.restore();
    return canvas;
  }

  function renderTrajectoryPreviewCanvas(d) {
    const size = getPlotSize();
    if (d.mode === "3d") return renderTrajectory3DGifFrame(d, Math.max(0, d.x.length - 1), { width: size.width, height: size.height });
    const canvas = createCanvas(size), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 60, r: 24, t: 50, b: 48 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const [xmin, xmax] = getMinMax(d.x), [ymin, ymax] = getMinMax(d.y);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;
    drawBackground(ctx, w, h, `${d.xCol}–${d.yCol} trajectory`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = 0; i < d.x.length; i++) {
      const xx = xMap(d.x[i]), yy = yMap(d.y[i]);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    const ps = clampInt(elPointSize.value, 4, 24, 11);
    if (d.x.length) {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(xMap(d.x[d.x.length - 1]), yMap(d.y[d.y.length - 1]), ps * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText(`${d.xCol}`, w / 2 - 10, h - 12);
    ctx.save();
    ctx.translate(16, h / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${d.yCol}`, 0, 0);
    ctx.restore();
    return canvas;
  }

  function renderShiftPlot() {
    const d = getLagData();
    if (!d.x.length) {
      setPlotPlaceholder("No valid lag-plot points were found in the selected columns.");
      setMeta("Choose numeric columns to preview your lag plot.");
      return;
    }
    setPlotCanvas(renderShiftPreviewCanvas(d));
    if (isLag3D()) {
      setMeta(`Showing ${d.x.length} 3D lag points from ${d.signalLength} valid samples. Axes: x=${d.yCol}(n), y=${d.yCol}(n+${d.skip}), z=${d.tCol}. GIF frames use a moving window for clearer local structure.`);
      if (elSummary) elSummary.textContent = "3D lag plot selected. GIF export or frame export uses a moving window so each frame shows the local lag structure clearly.";
    } else {
      setMeta(`Showing ${d.x.length} lag points from ${d.signalLength} valid samples. Time column used for ordering: ${d.tCol}. Skip = ${d.skip}. GIF frames use a moving window for clearer local structure.`);
      if (elSummary) elSummary.textContent = "2D lag plot selected. GIF export uses a moving window of lag points in time order so the local pattern stays visible.";
    }
  }

  function renderTrajectoryPlot() {
    const d = getTrajectoryData();
    if (!d.x.length) {
      setPlotPlaceholder("No valid trajectory points were found in the selected columns.");
      setMeta("Choose numeric columns to preview your trajectory plot.");
      return;
    }
    setPlotCanvas(renderTrajectoryPreviewCanvas(d));
    setMeta(`Showing ${d.x.length} valid trajectory points ordered by ${d.tCol}.`);
    if (elSummary) elSummary.textContent = "Trajectory plot selected. GIF export will move a point along the path.";
  }

  function renderCurrentPlot() {
    if (!state.rows.length) {
      setPlotPlaceholder("Load a file to preview your plot here.");
      setMeta("Load a file to preview your plot here.");
      return;
    }
    if (elPlotType.value === "shift") renderShiftPlot();
    else renderTrajectoryPlot();
  }

  function updatePanels() {
    const isShift = elPlotType.value === "shift";
    elShiftPanel.classList.toggle("tool3-hidden", !isShift);
    elTrajPanel.classList.toggle("tool3-hidden", isShift);
    elZWrap.classList.toggle("tool3-hidden", elMode.value !== "3d");
  }

  function getGifModeConfig() {
    const mode = (elGifQuality && elGifQuality.value === "high") ? "high" : "fast";
    if (mode === "high") {
      return { mode, width: 640, height: 420, maxFrames: 60, defaultFrames: 24, defaultFps: 8 };
    }
    return { mode, width: 480, height: 300, maxFrames: 48, defaultFrames: 16, defaultFps: 6 };
  }

  function syncGifInputsToMode() {
    const cfg = getGifModeConfig();
    elFrames.max = String(cfg.maxFrames);
    if (!elFrames.dataset.userEdited) elFrames.value = String(cfg.defaultFrames);
    if (!elFps.dataset.userEdited) elFps.value = String(cfg.defaultFps);
  }

  function buildFrameIndices(nPoints, nFrames) {
    if (nPoints <= 1) return [0];
    const steps = Math.max(2, nFrames);
    const out = [];
    for (let i = 0; i < steps; i++) {
      out.push(Math.round((i / (steps - 1)) * (nPoints - 1)));
    }
    return Array.from(new Set(out));
  }

  function getLagWindowSize(totalPoints) {
    const fallback = Math.min(120, Math.max(5, totalPoints || 120));
    return clampInt(elLagWindow && elLagWindow.value, 5, 5000, fallback);
  }

  function getActiveWindowBounds(activeIdx, totalPoints, windowSize) {
    const end = Math.max(0, Math.min(activeIdx, totalPoints - 1));
    const start = Math.max(0, end - Math.max(1, windowSize) + 1);
    return { start, end };
  }

  function getMinMax(values) {
    let lo = Infinity, hi = -Infinity;
    for (const v of values) {
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (lo === hi) {
      const pad = Math.abs(lo || 1) * 0.1 || 1;
      return [lo - pad, hi + pad];
    }
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }

  function formatTick(v) {
    if (!Number.isFinite(v)) return "";
    const abs = Math.abs(v);
    if (abs >= 1000 || (abs > 0 && abs < 0.001)) return v.toExponential(1);
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(1);
    if (abs >= 1) return v.toFixed(2);
    return v.toFixed(3);
  }

  function drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax) {
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + ih);
    ctx.lineTo(pad.l + iw, pad.t + ih);
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Inter, Arial, sans-serif";
    for (let k = 0; k <= 4; k++) {
      const frac = k / 4;
      const xx = pad.l + frac * iw;
      const yy = pad.t + ih - frac * ih;
      const xv = xmin + frac * (xmax - xmin);
      const yv = ymin + frac * (ymax - ymin);
      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + iw, yy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xx, pad.t);
      ctx.lineTo(xx, pad.t + ih);
      ctx.stroke();
      ctx.fillText(formatTick(yv), 8, yy + 4);
      ctx.fillText(formatTick(xv), Math.max(pad.l - 12, xx - 12), pad.t + ih + 20);
    }
  }

  function createCanvas(cfg) {
    const canvas = document.createElement("canvas");
    canvas.width = cfg.width;
    canvas.height = cfg.height;
    return canvas;
  }

  function drawBackground(ctx, w, h, title) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#111827";
    ctx.font = "600 20px Inter, Arial, sans-serif";
    ctx.fillText(title, 18, 28);
  }

  function drawSimpleLegend(ctx, items, x, y) {
    ctx.font = "12px Inter, Arial, sans-serif";
    items.forEach((it, i) => {
      const yy = y + i * 18;
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, yy - 4);
      ctx.lineTo(x + 20, yy - 4);
      ctx.stroke();
      ctx.fillStyle = "#374151";
      ctx.fillText(it.label, x + 28, yy);
    });
  }

  function renderShiftGifFrame(d, idx, cfg) {
    const canvas = createCanvas(cfg), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 60, r: 24, t: 50, b: 48 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const all = d.x.concat(d.y);
    const [xmin, xmax] = getMinMax(all);
    const [ymin, ymax] = getMinMax(all);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;
    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));
    const windowSize = getLagWindowSize(d.x.length);
    const { start, end } = getActiveWindowBounds(activeIdx, d.x.length, windowSize);

    drawBackground(ctx, w, h, `2D lag plot: ${d.yCol}(n) vs ${d.yCol}(n+${d.skip})`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax);

    ctx.save();
    ctx.strokeStyle = "#9ca3af";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xMap(xmin), yMap(xmin));
    ctx.lineTo(xMap(xmax), yMap(xmax));
    ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#2563eb";
    for (let i = start; i <= end; i++) {
      ctx.beginPath();
      ctx.arc(xMap(d.x[i]), yMap(d.y[i]), 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = start; i <= end; i++) {
      const xx = xMap(d.x[i]);
      const yy = yMap(d.y[i]);
      if (i === start) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    const ps = clampInt(elPointSize.value, 4, 24, 11);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), ps * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText(`${d.yCol}(n)`, w / 2 - 24, h - 12);
    ctx.save();
    ctx.translate(16, h / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${d.yCol}(n+${d.skip})`, 0, 0);
    ctx.restore();
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);
    ctx.fillText(`${d.tCol}: ${formatTick(d.t[activeIdx])}`, w - 160, 44);
    ctx.fillText(`window ${start + 1}-${end + 1}`, 18, 26);

    return canvas;
  }


  function renderLag3DGifFrame(d, idx, cfg) {
    const canvas = createCanvas(cfg), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 24, r: 24, t: 50, b: 24 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;

    drawBackground(ctx, w, h, `3D lag plot: ${d.yCol}(n), ${d.yCol}(n+${d.skip}), ${d.tCol}`);
    const proj = project3DFactory(d.x, d.y, d.t, iw, ih);
    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));
    const windowSize = getLagWindowSize(d.x.length);
    const { start, end } = getActiveWindowBounds(activeIdx, d.x.length, windowSize);

    ctx.save();
    ctx.translate(pad.l, pad.t);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = start; i <= end; i++) {
      const p = proj(i);
      if (i === start) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    const point = proj(activeIdx);
    const ps = clampInt(elPointSize.value, 4, 24, 11);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(point.x, point.y, ps * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText(`x = ${d.yCol}(n)`, 18, h - 34);
    ctx.fillText(`y = ${d.yCol}(n+${d.skip})`, 18, h - 18);
    ctx.fillText(`z = ${d.tCol}`, 180, h - 18);
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);
    ctx.fillText(`window ${start + 1}-${end + 1}`, 18, 26);
    return canvas;
  }

  function renderTrajectory2DGifFrame(d, idx, cfg) {
    const canvas = createCanvas(cfg), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 60, r: 24, t: 50, b: 48 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const [xmin, xmax] = getMinMax(d.x), [ymin, ymax] = getMinMax(d.y);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;

    drawBackground(ctx, w, h, `${d.xCol}–${d.yCol} trajectory`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < d.x.length; i++) {
      const xx = xMap(d.x[i]), yy = yMap(d.y[i]);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= activeIdx; i++) {
      const xx = xMap(d.x[i]), yy = yMap(d.y[i]);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    const ps = clampInt(elPointSize.value, 4, 24, 11);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), ps * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText(`${d.xCol}`, w / 2 - 10, h - 12);
    ctx.save();
    ctx.translate(16, h / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${d.yCol}`, 0, 0);
    ctx.restore();
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);

    return canvas;
  }

  function project3DFactory(xs, ys, zs, width, height) {
    const [xmin, xmax] = getMinMax(xs);
    const [ymin, ymax] = getMinMax(ys);
    const [zmin, zmax] = getMinMax(zs);
    const norm = (v, lo, hi) => ((v - lo) / ((hi - lo) || 1)) * 2 - 1;
    const az = Math.PI / 4.3, el = Math.PI / 8.8;

    const pts = xs.map((x, i) => {
      const X = norm(x, xmin, xmax);
      const Y = norm(ys[i], ymin, ymax);
      const Z = norm(zs[i], zmin, zmax);
      const xr = Math.cos(az) * X - Math.sin(az) * Y;
      const yr0 = Math.sin(az) * X + Math.cos(az) * Y;
      const yr = Math.cos(el) * yr0 - Math.sin(el) * Z;
      return { x: xr, y: yr };
    });

    let minPX = Infinity, maxPX = -Infinity, minPY = Infinity, maxPY = -Infinity;
    pts.forEach((p) => {
      minPX = Math.min(minPX, p.x);
      maxPX = Math.max(maxPX, p.x);
      minPY = Math.min(minPY, p.y);
      maxPY = Math.max(maxPY, p.y);
    });

    const pad = 0.12;
    const sx = (maxPX - minPX) || 1, sy = (maxPY - minPY) || 1;
    minPX -= sx * pad; maxPX += sx * pad;
    minPY -= sy * pad; maxPY += sy * pad;

    return function (i) {
      const p = pts[i];
      return {
        x: ((p.x - minPX) / ((maxPX - minPX) || 1)) * width,
        y: height - ((p.y - minPY) / ((maxPY - minPY) || 1)) * height
      };
    };
  }

  function renderTrajectory3DGifFrame(d, idx, cfg) {
    const canvas = createCanvas(cfg), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 24, r: 24, t: 50, b: 24 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;

    drawBackground(ctx, w, h, `${d.xCol}–${d.yCol}–${d.zCol} trajectory (3D projection)`);
    const proj = project3DFactory(d.x, d.y, d.z, iw, ih);
    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));

    ctx.save();
    ctx.translate(pad.l, pad.t);

    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < d.x.length; i++) {
      const p = proj(i);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= activeIdx; i++) {
      const p = proj(i);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    const point = proj(activeIdx);
    const ps = clampInt(elPointSize.value, 4, 24, 11);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(point.x, point.y, ps * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText("3D projected view", 18, h - 14);
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);
    return canvas;
  }

  function buildGIFPalette332() {
    const pal = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const r = (i >> 5) & 7;
      const g = (i >> 2) & 7;
      const b = i & 3;
      pal[i * 3 + 0] = Math.round((r / 7) * 255);
      pal[i * 3 + 1] = Math.round((g / 7) * 255);
      pal[i * 3 + 2] = Math.round((b / 3) * 255);
    }
    return pal;
  }

  function rgbaToIndexed332(imageData) {
    const src = imageData.data;
    const out = new Uint8Array(imageData.width * imageData.height);
    let j = 0;
    for (let i = 0; i < src.length; i += 4) {
      let r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];
      if (a !== 255) {
        r = Math.round((r * a + 255 * (255 - a)) / 255);
        g = Math.round((g * a + 255 * (255 - a)) / 255);
        b = Math.round((b * a + 255 * (255 - a)) / 255);
      }
      out[j++] = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
    }
    return out;
  }

  function lzwEncodeGIF(indices, minCodeSize) {
    const CLEAR = 1 << minCodeSize;
    const EOI = CLEAR + 1;
    let nextCode = EOI + 1;
    let codeSize = minCodeSize + 1;
    let dict = new Map();

    function resetDict() {
      dict = new Map();
      nextCode = EOI + 1;
      codeSize = minCodeSize + 1;
    }

    const bytes = [];
    let cur = 0, bits = 0;

    function writeCode(code) {
      cur |= (code << bits);
      bits += codeSize;
      while (bits >= 8) {
        bytes.push(cur & 0xFF);
        cur >>= 8;
        bits -= 8;
      }
    }

    resetDict();
    writeCode(CLEAR);

    let prefix = String(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = prefix + "," + k;
      if (dict.has(key)) {
        prefix = key;
      } else {
        const outCode = prefix.indexOf(",") === -1 ? Number(prefix) : dict.get(prefix);
        writeCode(outCode);

        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
          writeCode(CLEAR);
          resetDict();
        }
        prefix = String(k);
      }
    }

    const finalCode = prefix.indexOf(",") === -1 ? Number(prefix) : dict.get(prefix);
    writeCode(finalCode);
    writeCode(EOI);

    if (bits > 0) bytes.push(cur & 0xFF);
    return Uint8Array.from(bytes);
  }

  function le16(n) {
    return Uint8Array.from([n & 0xFF, (n >> 8) & 0xFF]);
  }

  function splitSubBlocks(dataBytes) {
    const parts = [];
    for (let i = 0; i < dataBytes.length; i += 255) {
      const chunk = dataBytes.slice(i, i + 255);
      parts.push(Uint8Array.from([chunk.length]));
      parts.push(chunk);
    }
    parts.push(Uint8Array.from([0]));
    return parts;
  }


  function encodeAnimatedGifWithGifJs(frameCanvases, cfg, fps, onProgress) {
    return new Promise((resolve, reject) => {
      if (!window.GIF) {
        reject(new Error("GIF.js is not available."));
        return;
      }

      const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1 || 2));
      const qualityValue = cfg.mode === "high" ? 8 : 14;
      const gif = new window.GIF({
        workers: workerCount,
        quality: qualityValue,
        width: cfg.width,
        height: cfg.height,
        repeat: 0,
        background: "#ffffff",
        workerScript: "https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js"
      });

      const delayMs = Math.max(50, Math.round(1000 / fps));
      frameCanvases.forEach((canvas) => {
        gif.addFrame(canvas, { copy: true, delay: delayMs });
      });

      gif.on("progress", (ratio) => {
        if (onProgress) onProgress(ratio, frameCanvases.length);
      });
      gif.on("finished", (blob) => resolve(blob));
      gif.on("abort", () => reject(new Error("GIF export was aborted.")));

      try {
        gif.render();
      } catch (err) {
        reject(err);
      }
    });
  }

  function encodeAnimatedGif(frameCanvases, width, height, delayCs, onProgress) {
    const palette = buildGIFPalette332();
    const parts = [];

    parts.push(Uint8Array.from([71, 73, 70, 56, 57, 97])); // GIF89a
    parts.push(le16(width));
    parts.push(le16(height));
    parts.push(Uint8Array.from([0xF7, 0x00, 0x00]));
    parts.push(palette);

    // Netscape loop extension (infinite)
    parts.push(Uint8Array.from([
      0x21, 0xFF, 0x0B,
      0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30,
      0x03, 0x01, 0x00, 0x00, 0x00
    ]));

    for (let i = 0; i < frameCanvases.length; i++) {
      if (onProgress) onProgress(i, frameCanvases.length);
      const ctx = frameCanvases[i].getContext("2d");
      const img = ctx.getImageData(0, 0, width, height);
      const indexed = rgbaToIndexed332(img);
      const lzw = lzwEncodeGIF(indexed, 8);

      // Graphics Control Extension
      parts.push(Uint8Array.from([0x21, 0xF9, 0x04, 0x00]));
      parts.push(le16(delayCs));
      parts.push(Uint8Array.from([0x00, 0x00]));

      // Image Descriptor
      parts.push(Uint8Array.from([0x2C]));
      parts.push(le16(0));
      parts.push(le16(0));
      parts.push(le16(width));
      parts.push(le16(height));
      parts.push(Uint8Array.from([0x00]));

      // LZW image data
      parts.push(Uint8Array.from([0x08]));
      const subs = splitSubBlocks(lzw);
      for (let j = 0; j < subs.length; j++) parts.push(subs[j]);
    }

    parts.push(Uint8Array.from([0x3B])); // trailer

    let totalLen = 0;
    for (let i = 0; i < parts.length; i++) totalLen += parts[i].length;
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (let i = 0; i < parts.length; i++) {
      out.set(parts[i], off);
      off += parts[i].length;
    }
    return new Blob([out], { type: "image/gif" });
  }

  function collectAnimationSpec() {
    const cfg = getGifModeConfig();
    const fps = clampInt(elFps.value, 1, 20, cfg.defaultFps);
    const nFramesInput = clampInt(elFrames.value, 8, cfg.maxFrames, cfg.defaultFrames);
    let frameIndices = [];
    let drawFrame = null;
    let outName = "plot_animation.gif";

    if (elPlotType.value === "shift") {
      const d = getLagData();
      if (d.x.length < 2) throw new Error("Need at least two valid lag-plot points for export.");
      frameIndices = buildFrameIndices(d.x.length, Math.min(nFramesInput, d.x.length));
      drawFrame = isLag3D() ? (idx) => renderLag3DGifFrame(d, idx, cfg) : (idx) => renderShiftGifFrame(d, idx, cfg);
      outName = isLag3D() ? `${d.yCol.replace(/[^\w.-]+/g, "_")}_lag3d.gif` : `${d.yCol.replace(/[^\w.-]+/g, "_")}_lag_plot.gif`;
    } else {
      const d = getTrajectoryData();
      if (d.x.length < 2) throw new Error("Need at least two valid trajectory points for export.");
      frameIndices = buildFrameIndices(d.x.length, Math.min(nFramesInput, d.x.length));
      drawFrame = d.mode === "3d" ? (idx) => renderTrajectory3DGifFrame(d, idx, cfg) : (idx) => renderTrajectory2DGifFrame(d, idx, cfg);
      outName = d.mode === "3d" ? "trajectory3d.gif" : "trajectory2d.gif";
    }

    return { cfg, fps, frameIndices, drawFrame, outName };
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode PNG frame.")), "image/png");
    });
  }

  async function buildFrameCanvases(spec, statusPrefix) {
    const frameCanvases = [];
    for (let i = 0; i < spec.frameIndices.length; i++) {
      setGifStatus(`${statusPrefix} ${i + 1} of ${spec.frameIndices.length}…`);
      frameCanvases.push(spec.drawFrame(spec.frameIndices[i]));
      await yieldToUi();
    }
    return frameCanvases;
  }

  async function downloadFramesZip() {
    if (!state.rows.length) {
      setGifStatus("Upload data first before exporting frames.");
      return;
    }
    if (!window.JSZip) {
      setGifStatus("Frame ZIP export needs JSZip. Please refresh the page and try again.");
      return;
    }
    if (elFramesZipBtn) {
      elFramesZipBtn.disabled = true;
      elFramesZipBtn.textContent = "Building ZIP…";
    }
    revokeFrameZipUrl();
    setFramesZipDownloadEnabled(false);
    try {
      const spec = collectAnimationSpec();
      const zip = new window.JSZip();
      const digits = Math.max(3, String(spec.frameIndices.length).length);
      for (let i = 0; i < spec.frameIndices.length; i++) {
        setGifStatus(`Rendering PNG frame ${i + 1} of ${spec.frameIndices.length}…`);
        const canvas = spec.drawFrame(spec.frameIndices[i]);
        const blob = await canvasToPngBlob(canvas);
        const name = `frame_${String(i + 1).padStart(digits, "0")}.png`;
        zip.file(name, blob);
        await yieldToUi();
      }
      setGifStatus("Compressing frame ZIP…");
      const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
        setGifStatus(`Compressing frame ZIP… ${Math.round(meta.percent || 0)}%`);
      });
      state.frameZipUrl = URL.createObjectURL(zipBlob);
      const base = spec.outName.replace(/\.gif$/i, "");
      const zipName = `${base}_frames.zip`;
      setFramesZipDownloadEnabled(true, state.frameZipUrl, zipName);
      setGifStatus(`Frames ZIP ready. ${spec.frameIndices.length} PNG frames created.`);
      if (elFramesZipDownload) elFramesZipDownload.click();
    } catch (err) {
      console.error(err);
      setGifStatus(err && err.message ? err.message : "Could not export frame ZIP.");
    } finally {
      if (elFramesZipBtn) {
        elFramesZipBtn.disabled = false;
        elFramesZipBtn.textContent = "Download Frames ZIP";
      }
    }
  }

  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read one of the frame images.")); };
      img.src = url;
    });
  }

  async function mergeFramesZipToGif() {
    const file = elMergeZipFile && elMergeZipFile.files && elMergeZipFile.files[0];
    if (!file) {
      setMergeStatus("Choose a ZIP file containing PNG or JPG frames first.");
      return;
    }
    if (!window.JSZip) {
      setMergeStatus("ZIP import needs JSZip. Please refresh the page and try again.");
      return;
    }
    if (elMergeGifBtn) {
      elMergeGifBtn.disabled = true;
      elMergeGifBtn.textContent = "Merging…";
    }
    revokeMergeGifUrl();
    setMergeGifDownloadEnabled(false);
    setMergePreview("Reading frame ZIP…");
    try {
      const zip = await window.JSZip.loadAsync(file);
      const entries = Object.values(zip.files)
        .filter((f) => !f.dir && /\.(png|jpg|jpeg|webp)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
      if (!entries.length) throw new Error("No PNG/JPG/WebP frames were found in the ZIP file.");
      setMergeStatus(`Reading ${entries.length} frame images…`);
      const images = [];
      for (let i = 0; i < entries.length; i++) {
        const blob = await entries[i].async("blob");
        images.push(await blobToImage(blob));
        setMergeStatus(`Loaded frame ${i + 1} of ${entries.length}…`);
        await yieldToUi();
      }
      const width = images[0].naturalWidth || images[0].width;
      const height = images[0].naturalHeight || images[0].height;
      const canvases = images.map((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
      });
      const fps = clampInt(elMergeFps && elMergeFps.value, 1, 20, 6);
      const delayCs = Math.max(2, Math.round(100 / fps));
      setMergeStatus("Writing merged GIF…");
      const blob = encodeAnimatedGif(canvases, width, height, delayCs, (i, total) => {
        if (i % 2 === 0 || i === total - 1) setMergeStatus(`Writing merged GIF… ${i + 1}/${total}`);
      });
      state.mergeGifUrl = URL.createObjectURL(blob);
      setMergePreview(`<img src="${state.mergeGifUrl}" alt="Merged GIF preview" />`);
      setMergeGifDownloadEnabled(true, state.mergeGifUrl, "merged_frames.gif");
      setMergeStatus(`Merged GIF ready. ${entries.length} frames at ${fps} fps.`);
    } catch (err) {
      console.error(err);
      setMergePreview("Could not merge that frame ZIP.");
      setMergeStatus(err && err.message ? err.message : "Could not merge frame ZIP into GIF.");
    } finally {
      if (elMergeGifBtn) {
        elMergeGifBtn.disabled = false;
        elMergeGifBtn.textContent = "Create GIF from ZIP";
      }
    }
  }

  async function generateGif() {
    if (!state.rows.length) {
      setGifStatus("Upload data first before generating a GIF.");
      return;
    }

    if (elMakeGif) {
      elMakeGif.disabled = true;
      elMakeGif.textContent = "Generating…";
    }

    revokeGifUrl();
    setGifDownloadEnabled(false);
    setGifPreview("Generating GIF…");
    setGifStatus("Preparing frames…");

    try {
      const spec = collectAnimationSpec();
      const frameCanvases = await buildFrameCanvases(spec, "Drawing frame");
      setGifStatus("Writing GIF file…");
      await yieldToUi();
      const delayCs = Math.max(2, Math.round(100 / spec.fps));
      const blob = encodeAnimatedGif(frameCanvases, spec.cfg.width, spec.cfg.height, delayCs, (i, total) => {
        if (i % 2 === 0 || i === total - 1) {
          setGifStatus(`Writing GIF file… ${i + 1}/${total}`);
        }
      });
      state.gifUrl = URL.createObjectURL(blob);
      setGifPreview(`<img src="${state.gifUrl}" alt="GIF preview" />`);
      setGifDownloadEnabled(true, state.gifUrl, spec.outName);
      setGifStatus(`GIF ready (${spec.cfg.mode === "high" ? "High quality" : "Fast"}). ${spec.frameIndices.length} frames at ${spec.fps} fps.`);
    } catch (err) {
      console.error(err);
      const reason = err && err.message ? err.message : "GIF export failed.";
      setGifPreview("GIF export failed. Try the frame ZIP workflow below, then merge the ZIP back into a GIF.");
      setGifStatus(reason);
    } finally {
      if (elMakeGif) {
        elMakeGif.disabled = false;
        elMakeGif.textContent = "Generate GIF";
      }
    }
  }

  function handleSheetChange() {
    parseSheet(elSheet.value);
    refreshControls();
    renderCurrentPlot();
  }

  elFile.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLoadStatus(`Reading ${file.name}…`);
    try {
      await loadWorkbookFromFile(file);
    } catch (err) {
      console.error(err);
      setLoadStatus(err && err.message ? err.message : "Could not read that file. Try the built-in example first, then match your file to that format.");
    }
  });

  if (elLoadExampleBtn) {
    elLoadExampleBtn.addEventListener("click", async () => {
      try {
        await loadBuiltInExample();
      } catch (err) {
        console.error(err);
        setLoadStatus(err && err.message ? err.message : "Could not load the built-in example.");
      }
    });
  }

  elSheet.addEventListener("change", handleSheetChange);

  [elPlotType, elTimeShift, elShiftVar, elSkip, elLagWindow, elLagMode, elTimeTraj, elMode, elX, elY, elZ, elPointSize].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => { updatePanels(); renderCurrentPlot(); });
    el.addEventListener("input", () => {
      if (el === elSkip || el === elPointSize) renderCurrentPlot();
    });
  });

  if (elFrames) elFrames.addEventListener("input", () => { elFrames.dataset.userEdited = "1"; });
  if (elFps) elFps.addEventListener("input", () => { elFps.dataset.userEdited = "1"; });
  if (elGifQuality) {
    elGifQuality.addEventListener("change", () => {
      if (elFrames) delete elFrames.dataset.userEdited;
      if (elFps) delete elFps.dataset.userEdited;
      syncGifInputsToMode();
    });
  }
  if (elMakeGif) elMakeGif.addEventListener("click", generateGif);
  if (elFramesZipBtn) elFramesZipBtn.addEventListener("click", downloadFramesZip);
  if (elMergeGifBtn) elMergeGifBtn.addEventListener("click", mergeFramesZipToGif);

  window.addEventListener("resize", () => {
    if (state.rows.length) renderCurrentPlot();
  });

  updatePanels();
  syncGifInputsToMode();
  setGifDownloadEnabled(false);
  setFramesZipDownloadEnabled(false);
  setMergeGifDownloadEnabled(false);
  setGifStatus("GIF export is available for both plot types. If GIF generation is slow, use Download Frames ZIP first, then merge the ZIP into a GIF in the new block below.");
  setMergeStatus("Upload a ZIP of PNG or JPG frames to merge them into a GIF here.");
  renderCurrentPlot();
})();