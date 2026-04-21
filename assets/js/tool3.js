(function () {
  const $ = (id) => document.getElementById(id);

  const elFile = $("tool3File");
  const elSheet = $("tool3Sheet");
  const elPlotType = $("tool3PlotType");
  const elShiftPanel = $("tool3ShiftPanel");
  const elTrajPanel = $("tool3TrajectoryPanel");
  const elTimeShift = $("tool3TimeShift");
  const elShiftVar = $("tool3ShiftVar");
  const elSkip = $("tool3Skip");
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
  const elGifDownload = $("tool3GifDownload");
  const elGifStatus = $("tool3GifStatus");
  const elGifPreview = $("tool3GifPreview");
  const elLoadStatus = $("tool3LoadStatus");
  const elSummary = $("tool3Summary");
  const elPlot = $("tool3Plot");
  const elMeta = $("tool3Meta");

  if (!elFile || !elSheet || !elPlot || !window.XLSX || !window.Plotly) return;

  const state = {
    workbook: null,
    fileName: "",
    sheetName: "",
    headers: [],
    rows: [],
    numericHeaders: [],
    gifUrl: ""
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

  function setLoadStatus(msg) { if (elLoadStatus) elLoadStatus.textContent = msg; }
  function setGifStatus(msg) { if (elGifStatus) elGifStatus.textContent = msg; }
  function setMeta(msg) { if (elMeta) elMeta.textContent = msg; }
  function setGifPreview(html) { if (elGifPreview) elGifPreview.innerHTML = html; }

  function setGifDownloadEnabled(enabled, href, filename) {
    if (!elGifDownload) return;
    if (enabled) {
      elGifDownload.href = href || "#";
      if (filename) elGifDownload.download = filename;
      elGifDownload.removeAttribute("aria-disabled");
      elGifDownload.style.pointerEvents = "";
      elGifDownload.style.opacity = "";
    } else {
      elGifDownload.href = "#";
      elGifDownload.setAttribute("aria-disabled", "true");
      elGifDownload.style.pointerEvents = "none";
      elGifDownload.style.opacity = ".55";
    }
  }

  function revokeGifUrl() {
    if (state.gifUrl && state.gifUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.gifUrl);
    }
    state.gifUrl = "";
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
      state.workbook = XLSX.read(text, { type: "string" });
    } else {
      const buffer = await file.arrayBuffer();
      state.workbook = XLSX.read(buffer, { type: "array" });
    }

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

  function getShiftData() {
    const tCol = elTimeShift.value;
    const yCol = elShiftVar.value;
    const skip = clampInt(elSkip.value, 1, 100000, 1);

    const t = [], yn = [], ynp = [];
    const n = Math.max(0, state.rows.length - skip);
    for (let i = 0; i < n; i++) {
      const y0 = num(state.rows[i][yCol]);
      const y1 = num(state.rows[i + skip][yCol]);
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
      const tRaw = state.rows[i][tCol];
      t.push(safeText(tRaw) === "" ? i : tRaw);
      yn.push(y0);
      ynp.push(y1);
    }
    return { tCol, yCol, skip, t, yn, ynp };
  }

  function getTrajectoryData() {
    const mode = elMode.value;
    const xCol = elX.value, yCol = elY.value, zCol = elZ.value, tCol = elTimeTraj.value;
    const out = { mode, xCol, yCol, zCol, tCol, x: [], y: [], z: [], t: [] };
    for (const row of state.rows) {
      const xv = num(row[xCol]);
      const yv = num(row[yCol]);
      const zv = num(row[zCol]);
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
      if (mode === "3d" && !Number.isFinite(zv)) continue;
      out.x.push(xv);
      out.y.push(yv);
      if (mode === "3d") out.z.push(zv);
      out.t.push(row[tCol]);
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

  function renderShiftPlot() {
    const d = getShiftData();
    const traces = [
      { x: d.t, y: d.yn, type: "scatter", mode: "lines", name: `${d.yCol} (n)`, line: { width: 3 } },
      { x: d.t, y: d.ynp, type: "scatter", mode: "lines", name: `${d.yCol} (n+${d.skip})`, line: { width: 3, dash: "dash" } }
    ];
    const layout = {
      title: `${d.yCol}: y(n) and y(n+${d.skip}) vs ${d.tCol}`,
      margin: { l: 62, r: 24, t: 56, b: 58 },
      xaxis: { title: d.tCol, automargin: true },
      yaxis: { title: d.yCol, automargin: true },
      legend: { orientation: "h", y: 1.12 },
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff"
    };
    Plotly.react(elPlot, traces, layout, { responsive: true, displaylogo: false });
    setMeta(`Showing ${d.yn.length} aligned points. Time column: ${d.tCol}. Skip = ${d.skip}.`);
    if (elSummary) elSummary.textContent = "Shifted-time plot selected. GIF export will animate the moving comparison of y(n) and y(n+skip).";
  }

  function renderTrajectoryPlot() {
    const d = getTrajectoryData();
    const pointSize = clampInt(elPointSize.value, 4, 24, 11);
    let traces, layout;
    if (d.mode === "3d") {
      traces = [
        { x: d.x, y: d.y, z: d.z, type: "scatter3d", mode: "lines", name: "Trajectory", line: { width: 5 } },
        { x: d.x.length ? [d.x[d.x.length - 1]] : [], y: d.y.length ? [d.y[d.y.length - 1]] : [], z: d.z.length ? [d.z[d.z.length - 1]] : [], type: "scatter3d", mode: "markers", name: "Current point", marker: { size: pointSize } }
      ];
      layout = {
        title: `${d.xCol}–${d.yCol}–${d.zCol} trajectory`,
        margin: { l: 10, r: 10, t: 56, b: 10 },
        scene: build3DScene(d.xCol, d.yCol, d.zCol),
        legend: { orientation: "h", y: 1.06 },
        paper_bgcolor: "#fff"
      };
    } else {
      traces = [
        { x: d.x, y: d.y, type: "scatter", mode: "lines", name: "Trajectory", line: { width: 3 } },
        { x: d.x.length ? [d.x[d.x.length - 1]] : [], y: d.y.length ? [d.y[d.y.length - 1]] : [], type: "scatter", mode: "markers", name: "Current point", marker: { size: pointSize } }
      ];
      layout = {
        title: `${d.xCol}–${d.yCol} trajectory`,
        margin: { l: 62, r: 24, t: 56, b: 58 },
        xaxis: { title: d.xCol, automargin: true },
        yaxis: { title: d.yCol, automargin: true },
        legend: { orientation: "h", y: 1.12 },
        paper_bgcolor: "#fff",
        plot_bgcolor: "#fff"
      };
    }
    Plotly.react(elPlot, traces, layout, { responsive: true, displaylogo: false });
    setMeta(`Showing ${d.x.length} valid trajectory points ordered by ${d.tCol}.`);
    if (elSummary) elSummary.textContent = "Trajectory plot selected. GIF export will move a point along the path.";
  }

  function renderCurrentPlot() {
    if (!state.rows.length) {
      Plotly.react(elPlot, [], {
        annotations: [{ text: "Upload a file to begin.", showarrow: false, xref: "paper", yref: "paper", x: 0.5, y: 0.5, font: { size: 18, color: "#6b7280" } }],
        xaxis: { visible: false },
        yaxis: { visible: false },
        margin: { l: 0, r: 0, t: 10, b: 0 },
        paper_bgcolor: "#fff",
        plot_bgcolor: "#fff"
      }, { responsive: true, displaylogo: false });
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
    const allY = d.yn.concat(d.ynp);
    const [ymin, ymax] = getMinMax(allY);
    const n = Math.max(1, d.yn.length - 1);
    const xMap = (i) => pad.l + (iw * i / n);
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;

    drawBackground(ctx, w, h, `${d.yCol}: y(n) and y(n+${d.skip}) vs ${d.tCol}`);
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
      const yy = pad.t + ih - frac * ih;
      const val = ymin + frac * (ymax - ymin);
      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + iw, yy);
      ctx.stroke();
      ctx.fillText(val.toFixed(3), 8, yy + 4);
    }

    const tickIdx = [0, Math.floor(d.t.length / 2), Math.max(0, d.t.length - 1)];
    tickIdx.forEach((ii) => {
      if (!d.t.length) return;
      const xx = xMap(ii);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(String(d.t[ii]), Math.max(pad.l, xx - 14), h - 12);
    });

    function drawPath(arr, color, upTo, dash) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      if (dash) ctx.setLineDash([8, 5]);
      ctx.beginPath();
      for (let i = 0; i <= upTo; i++) {
        const xx = xMap(i);
        const yy = yMap(arr[i]);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 0.18;
    drawPath(d.yn, "#2563eb", d.yn.length - 1, false);
    drawPath(d.ynp, "#dc2626", d.ynp.length - 1, true);
    ctx.globalAlpha = 1;

    const activeIdx = Math.max(0, Math.min(idx, d.yn.length - 1));
    drawPath(d.yn, "#2563eb", activeIdx, false);
    drawPath(d.ynp, "#dc2626", activeIdx, true);

    const ps = clampInt(elPointSize.value, 4, 24, 11);
    const xActive = xMap(activeIdx);

    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(xActive, yMap(d.yn[activeIdx]), ps * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(xActive, yMap(d.ynp[activeIdx]), ps * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#374151";
    ctx.font = "600 12px Inter, Arial, sans-serif";
    ctx.fillText(`frame ${activeIdx + 1}/${d.yn.length}`, w - 130, 26);
    ctx.fillText(String(d.t[activeIdx]), w - 130, 44);

    drawSimpleLegend(ctx, [
      { color: "#2563eb", label: `${d.yCol} (n)` },
      { color: "#dc2626", label: `${d.yCol} (n+${d.skip})` }
    ], w - 190, 72);

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
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + ih);
    ctx.lineTo(pad.l + iw, pad.t + ih);
    ctx.stroke();

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

  async function generateGif() {
    if (!state.rows.length) {
      setGifStatus("Upload data first before generating a GIF.");
      return;
    }

    revokeGifUrl();
    setGifDownloadEnabled(false);
    setGifPreview("Generating GIF…");
    setGifStatus("Preparing frames…");

    const cfg = getGifModeConfig();
    const fps = clampInt(elFps.value, 1, 20, cfg.defaultFps);
    const nFramesInput = clampInt(elFrames.value, 8, cfg.maxFrames, cfg.defaultFrames);

    let frameIndices = [];
    let drawFrame = null;
    let outName = "plot_animation.gif";

    if (elPlotType.value === "shift") {
      const d = getShiftData();
      if (d.yn.length < 2) {
        setGifStatus("Need at least two valid shifted-time points for GIF export.");
        return;
      }
      frameIndices = buildFrameIndices(d.yn.length, Math.min(nFramesInput, d.yn.length));
      drawFrame = (idx) => renderShiftGifFrame(d, idx, cfg);
      outName = `${d.yCol.replace(/[^\w.-]+/g, "_")}_shifted_time.gif`;
    } else {
      const d = getTrajectoryData();
      if (d.x.length < 2) {
        setGifStatus("Need at least two valid trajectory points for GIF export.");
        return;
      }
      frameIndices = buildFrameIndices(d.x.length, Math.min(nFramesInput, d.x.length));
      drawFrame = d.mode === "3d"
        ? (idx) => renderTrajectory3DGifFrame(d, idx, cfg)
        : (idx) => renderTrajectory2DGifFrame(d, idx, cfg);
      outName = d.mode === "3d" ? "trajectory3d.gif" : "trajectory2d.gif";
    }

    const frameCanvases = [];
    for (let i = 0; i < frameIndices.length; i++) {
      setGifStatus(`Drawing frame ${i + 1} of ${frameIndices.length}…`);
      frameCanvases.push(drawFrame(frameIndices[i]));
      if (i % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setGifStatus("Writing GIF file…");
    await new Promise((resolve) => setTimeout(resolve, 0));

    let blob;
    try {
      if (window.GIF) {
        blob = await encodeAnimatedGifWithGifJs(frameCanvases, cfg, fps, (ratio) => {
          const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
          setGifStatus(`Writing GIF file… ${pct}%`);
        });
      } else {
        const delayCs = Math.max(2, Math.round(100 / fps));
        blob = encodeAnimatedGif(frameCanvases, cfg.width, cfg.height, delayCs, (i, total) => {
          if (i % 2 === 0 || i === total - 1) {
            setGifStatus(`Writing GIF file… ${i + 1}/${total}`);
          }
        });
      }
    } catch (err) {
      console.error(err);
      setGifPreview("GIF export failed. Please try Fast mode or fewer frames.");
      setGifStatus("GIF export failed while writing the file.");
      return;
    }

    revokeGifUrl();
    state.gifUrl = URL.createObjectURL(blob);
    setGifPreview(`<img src="${state.gifUrl}" alt="GIF preview" />`);
    setGifDownloadEnabled(true, state.gifUrl, outName);
    setGifStatus(`GIF ready (${cfg.mode === "high" ? "High quality" : "Fast"}). ${frameIndices.length} frames at ${fps} fps.`);
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
      setLoadStatus("Could not read that file. Try the example Excel first, then match your file to that format.");
    }
  });

  elSheet.addEventListener("change", handleSheetChange);

  [elPlotType, elTimeShift, elShiftVar, elSkip, elTimeTraj, elMode, elX, elY, elZ, elPointSize].forEach((el) => {
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

  updatePanels();
  syncGifInputsToMode();
  setGifDownloadEnabled(false);
  setGifStatus("GIF export is available for both plot types. This version uses a reliable browser-side encoder and falls back to the built-in writer if needed.");
  renderCurrentPlot();
})();