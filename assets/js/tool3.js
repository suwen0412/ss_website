(function () {
  const $ = (id) => document.getElementById(id);
  const selValue = (el, fallback = "") => (
    el && typeof el.value !== "undefined" ? el.value : fallback
  );

  const elFile = $("tool3File");
  const elSheet = $("tool3Sheet");
  const elTimeCol = $("tool3TimeCol");
  const elLoadStatus = $("tool3LoadStatus");
  const elFileMeta = $("tool3FileMeta");
  const elNumericMeta = $("tool3NumericMeta");
  const elVars = $("tool3Vars");

  const elFrameDim = $("tool3FrameDim");
  const elMapType = $("tool3MapType");
  const elSummary = $("tool3Summary");

  const elTimeMapControls = $("tool3TimeMapControls");
  const elUseTimeAxisWrap = $("tool3UseTimeAxisWrap");
  const elUseTimeAxis = $("tool3UseTimeAxis");
  const elX = $("tool3X");
  const elY = $("tool3Y");
  const elZ = $("tool3Z");
  const elZWrap = $("tool3ZWrap");

  const elReturnControls = $("tool3ReturnControls");
  const elReturnVar = $("tool3ReturnVar");
  const elLag = $("tool3Lag");
  const elReturnNote = $("tool3ReturnNote");

  const elFrames = $("tool3Frames");
  const elPointSize = $("tool3PointSize");
  const elFramesZipBtn = $("tool3FramesZipBtn");
  const elFramesZipDownload = $("tool3FramesZipDownload");
  const elFramesStatus = $("tool3FramesStatus");

  const elPlot = $("tool3Plot");
  const elMeta = $("tool3Meta");
  const elPreviewHead = $("tool3PreviewHead");
  const elPreviewBody = $("tool3PreviewBody");

  const elMergeZipFile = $("tool3MergeZipFile");
  const elMergeFps = $("tool3MergeFps");
  const elMergeGifBtn = $("tool3MergeGifBtn");
  const elMergeGifDownload = $("tool3MergeGifDownload");
  const elMergeStatus = $("tool3MergeStatus");
  const elMergePreview = $("tool3MergePreview");

  if (!elFile || !elSheet || !elPlot || !window.XLSX || !window.Plotly) return;

  const state = {
    workbook: null,
    fileName: "",
    sheetName: "",
    headers: [],
    rows: [],
    numericHeaders: [],
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

  function yieldToUi() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function setFramesStatus(msg) {
    if (elFramesStatus) elFramesStatus.textContent = msg;
  }

  function setMergeStatus(msg) {
    if (elMergeStatus) elMergeStatus.textContent = msg;
  }

  function setMergePreview(html) {
    if (elMergePreview) elMergePreview.innerHTML = html;
  }

  function setMeta(msg) {
    if (elMeta) elMeta.textContent = msg;
  }

  function setLoadStatus(msg) {
    if (elLoadStatus) elLoadStatus.textContent = msg;
  }

  function revokeObjectUrl(key) {
    if (state[key] && state[key].startsWith("blob:")) URL.revokeObjectURL(state[key]);
    state[key] = "";
  }

  function revokeFrameZipUrl() {
    revokeObjectUrl("frameZipUrl");
  }

  function revokeMergeGifUrl() {
    revokeObjectUrl("mergeGifUrl");
  }

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

  function setFramesZipDownloadEnabled(enabled, href, filename) {
    setDownloadLink(elFramesZipDownload, enabled, href, filename);
  }

  function setMergeGifDownloadEnabled(enabled, href, filename) {
    setDownloadLink(elMergeGifDownload, enabled, href, filename);
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
    selectEl.innerHTML = values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
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
      headers.forEach((h, i) => {
        obj[h] = r[i];
      });
      return obj;
    }).filter((row) => Object.values(row).some((v) => safeText(v) !== ""));

    const numericHeaders = headers.filter((h) => {
      let valid = 0;
      let numeric = 0;
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

  function getVariableOptions() {
    const timeGuess = selValue(elTimeCol) || guessTimeColumn();
    const numeric = state.numericHeaders.length ? state.numericHeaders.slice() : state.headers.slice();
    const nonTime = numeric.filter((h) => h !== timeGuess);
    return nonTime.length ? nonTime : numeric;
  }

  function renderVariableBadges() {
    if (!elVars) return;
    const vars = getVariableOptions();
    if (!vars.length) {
      elVars.innerHTML = '<span class="tool3-subtle">No numeric variables detected yet.</span>';
      return;
    }
    elVars.innerHTML = vars.map((v) => `<span class="tool3-chip">${escapeHtml(v)}</span>`).join("");
  }

  function renderPreviewTable() {
    if (!elPreviewHead || !elPreviewBody) return;
    if (!state.headers.length || !state.rows.length) {
      elPreviewHead.innerHTML = "";
      elPreviewBody.innerHTML = '<tr><td style="padding:14px; color:#6b7280;">Upload a file to see the first 5 rows here.</td></tr>';
      return;
    }
    elPreviewHead.innerHTML = `<tr>${state.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
    const previewRows = state.rows.slice(0, 5);
    elPreviewBody.innerHTML = previewRows.map((row) => {
      return `<tr>${state.headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join("")}</tr>`;
    }).join("");
  }

  function refreshControls() {
    const timeGuess = guessTimeColumn();
    optionList(elTimeCol, state.headers, timeGuess);

    const vars = getVariableOptions();
    optionList(elX, vars, vars[0] || "");
    optionList(elY, vars, vars[1] || vars[0] || "");
    optionList(elZ, vars, vars[2] || vars[0] || "");
    optionList(elReturnVar, vars, vars[0] || "");

    if (elFileMeta) elFileMeta.textContent = state.fileName || "—";
    if (elNumericMeta) elNumericMeta.textContent = state.numericHeaders.length ? `${state.numericHeaders.length} detected` : "0 detected";

    renderVariableBadges();
    renderPreviewTable();

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

    const sheets = state.workbook && state.workbook.SheetNames ? state.workbook.SheetNames : [];
    if (!sheets.length) {
      elSheet.innerHTML = '<option value="">No sheets found</option>';
      state.sheetName = "";
      state.headers = [];
      state.rows = [];
      state.numericHeaders = [];
      refreshControls();
      renderCurrentPlot();
      return;
    }

    elSheet.innerHTML = sheets.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    elSheet.value = sheets[0];
    parseSheet(sheets[0]);
    refreshControls();
    updatePanels();
    renderCurrentPlot();
  }

  function orderedRowsUsingTime(tCol, neededCols) {
    const pts = [];
    for (let i = 0; i < state.rows.length; i++) {
      const row = state.rows[i];
      const obj = { rawTime: row[tCol], tSort: i };
      const tv = num(row[tCol]);
      if (Number.isFinite(tv)) obj.tSort = tv;
      let ok = true;
      for (const c of neededCols) {
        const val = num(row[c]);
        if (!Number.isFinite(val)) {
          ok = false;
          break;
        }
        obj[c] = val;
      }
      if (ok) pts.push(obj);
    }
    pts.sort((a, b) => a.tSort - b.tSort);
    return pts;
  }

  function getTimeMapData() {
    const frameDim = selValue(elFrameDim, "2d");
    const tCol = selValue(elTimeCol) || guessTimeColumn();
    const xCol = selValue(elX);
    const yCol = selValue(elY);
    const useTimeAxis = frameDim === "3d" && selValue(elUseTimeAxis, "yes") === "yes";

    const neededCols = [xCol, yCol].filter(Boolean);
    let zCol = "";
    if (frameDim === "3d" && !useTimeAxis) {
      zCol = selValue(elZ);
      if (zCol) neededCols.push(zCol);
    }

    const pts = orderedRowsUsingTime(tCol, neededCols);
    const out = {
      mapType: "time",
      frameDim,
      useTimeAxis,
      tCol,
      xCol,
      yCol,
      zCol,
      x: [],
      y: [],
      z: [],
      t: []
    };

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      out.x.push(p[xCol]);
      out.y.push(p[yCol]);
      out.t.push(Number.isFinite(num(p.rawTime)) ? num(p.rawTime) : i);
      if (frameDim === "3d") {
        if (useTimeAxis) out.z.push(Number.isFinite(num(p.rawTime)) ? num(p.rawTime) : i);
        else out.z.push(p[zCol]);
      }
    }

    return out;
  }

  function getReturnMapData() {
    const frameDim = selValue(elFrameDim, "2d");
    const tCol = selValue(elTimeCol) || guessTimeColumn();
    const varCol = selValue(elReturnVar);
    const lag = clampInt(selValue(elLag, 1), 1, 100000, 1);
    const pts = orderedRowsUsingTime(tCol, [varCol].filter(Boolean));

    const signal = pts.map((p) => p[varCol]);
    const times = pts.map((p, i) => Number.isFinite(num(p.rawTime)) ? num(p.rawTime) : i);
    const n = Math.max(0, signal.length - lag);
    const out = {
      mapType: "return",
      frameDim,
      tCol,
      varCol,
      lag,
      x: [],
      y: [],
      z: [],
      t: []
    };

    for (let i = 0; i < n; i++) {
      out.x.push(signal[i]);
      out.y.push(signal[i + lag]);
      out.t.push(times[i]);
      if (frameDim === "3d") out.z.push(times[i]);
    }
    return out;
  }

  function getCurrentSpec() {
    if (selValue(elMapType, "time") === "return") return getReturnMapData();
    return getTimeMapData();
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

  function renderTimePreview(d) {
    const pointSize = clampInt(elPointSize.value, 4, 24, 11);
    if (d.frameDim === "3d") {
      const zTitle = d.useTimeAxis ? d.tCol : d.zCol;
      const traces = [
        { x: d.x, y: d.y, z: d.z, type: "scatter3d", mode: "lines", name: "Time-dependent path", line: { width: 5 } },
        { x: d.x.length ? [d.x[d.x.length - 1]] : [], y: d.y.length ? [d.y[d.y.length - 1]] : [], z: d.z.length ? [d.z[d.z.length - 1]] : [], type: "scatter3d", mode: "markers", name: "Current point", marker: { size: pointSize } }
      ];
      const layout = {
        title: d.useTimeAxis ? `${d.yCol} vs ${d.xCol} with z = ${d.tCol}` : `${d.xCol}, ${d.yCol}, ${d.zCol} ordered by ${d.tCol}`,
        margin: { l: 10, r: 10, t: 56, b: 10 },
        scene: build3DScene(d.xCol, d.yCol, zTitle),
        legend: { orientation: "h", y: 1.06 },
        paper_bgcolor: "#fff"
      };
      Plotly.react(elPlot, traces, layout, { responsive: true, displaylogo: false });
      setMeta(`Showing ${d.x.length} valid points ordered by ${d.tCol}.`);
      return;
    }

    const traces = [
      { x: d.x, y: d.y, type: "scatter", mode: "lines", name: "Time-dependent path", line: { width: 3 } },
      { x: d.x.length ? [d.x[d.x.length - 1]] : [], y: d.y.length ? [d.y[d.y.length - 1]] : [], type: "scatter", mode: "markers", name: "Current point", marker: { size: pointSize } }
    ];
    const layout = {
      title: `${d.yCol} vs ${d.xCol} ordered by ${d.tCol}`,
      margin: { l: 62, r: 24, t: 56, b: 58 },
      xaxis: { title: d.xCol, automargin: true },
      yaxis: { title: d.yCol, automargin: true },
      legend: { orientation: "h", y: 1.12 },
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff"
    };
    Plotly.react(elPlot, traces, layout, { responsive: true, displaylogo: false });
    setMeta(`Showing ${d.x.length} valid 2D points ordered by ${d.tCol}.`);
  }

  function renderReturnPreview(d) {
    const pointSize = clampInt(elPointSize.value, 4, 24, 11);
    if (d.frameDim === "3d") {
      const traces = [
        { x: d.x, y: d.y, z: d.z, type: "scatter3d", mode: "lines", name: "Return map path", line: { width: 4 } },
        { x: d.x.length ? [d.x[d.x.length - 1]] : [], y: d.y.length ? [d.y[d.y.length - 1]] : [], z: d.z.length ? [d.z[d.z.length - 1]] : [], type: "scatter3d", mode: "markers", name: "Current point", marker: { size: pointSize } }
      ];
      const layout = {
        title: `3D return map: ${d.varCol}(n), ${d.varCol}(n+${d.lag}), ${d.tCol}`,
        margin: { l: 10, r: 10, t: 56, b: 10 },
        scene: build3DScene(`${d.varCol}(n)`, `${d.varCol}(n+${d.lag})`, d.tCol),
        legend: { orientation: "h", y: 1.06 },
        paper_bgcolor: "#fff"
      };
      Plotly.react(elPlot, traces, layout, { responsive: true, displaylogo: false });
      setMeta(`Showing ${d.x.length} return-map points. Axes: x=${d.varCol}(n), y=${d.varCol}(n+${d.lag}), z=${d.tCol}.`);
      return;
    }

    const traces = [
      {
        x: d.x,
        y: d.y,
        type: "scatter",
        mode: "lines+markers",
        name: `${d.varCol}(n) vs ${d.varCol}(n+${d.lag})`,
        marker: { size: 5 },
        line: { width: 2.5 }
      },
      {
        x: d.x.length ? [d.x[d.x.length - 1]] : [],
        y: d.y.length ? [d.y[d.y.length - 1]] : [],
        type: "scatter",
        mode: "markers",
        name: "Current point",
        marker: { size: Math.max(7, pointSize) }
      }
    ];
    const diagMin = Math.min(...d.x, ...d.y);
    const diagMax = Math.max(...d.x, ...d.y);
    if (Number.isFinite(diagMin) && Number.isFinite(diagMax)) {
      traces.unshift({
        x: [diagMin, diagMax],
        y: [diagMin, diagMax],
        type: "scatter",
        mode: "lines",
        name: "y=x",
        line: { width: 1.5, dash: "dash", color: "#9ca3af" }
      });
    }
    const layout = {
      title: `2D return map: ${d.varCol}(n) vs ${d.varCol}(n+${d.lag})`,
      margin: { l: 62, r: 24, t: 56, b: 58 },
      xaxis: { title: `${d.varCol}(n)`, automargin: true },
      yaxis: { title: `${d.varCol}(n+${d.lag})`, automargin: true, scaleanchor: "x", scaleratio: 1 },
      legend: { orientation: "h", y: 1.12 },
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff"
    };
    Plotly.react(elPlot, traces, layout, { responsive: true, displaylogo: false });
    setMeta(`Showing ${d.x.length} return-map points from the selected variable. Lag = ${d.lag}. Ordered by ${d.tCol}.`);
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
      setMeta("Load a file to preview the selected map here.");
      renderPreviewTable();
      return;
    }

    const spec = getCurrentSpec();
    if (elMapType.value === "return") renderReturnPreview(spec);
    else renderTimePreview(spec);
  }

  function updateSummaryText() {
    const frameDim = selValue(elFrameDim, "2d");
    const mapType = selValue(elMapType, "time");
    if (!elSummary) return;
    if (mapType === "return") {
      if (frameDim === "3d") {
        elSummary.textContent = "3D return map selected. The frames use x = variable(n), y = variable(n+lag), and z = time.";
      } else {
        elSummary.textContent = "2D return map selected. The frames use x = variable(n) and y = variable(n+lag), following the chosen time order.";
      }
      return;
    }

    if (frameDim === "3d") {
      if (selValue(elUseTimeAxis, "yes") === "yes") {
        elSummary.textContent = "3D time-dependent map selected with time as one axis. Choose x and y variables; z is the time column.";
      } else {
        elSummary.textContent = "3D time-dependent map selected without time as an axis. Choose x, y, z variables; the path still follows the chosen time order.";
      }
      return;
    }

    elSummary.textContent = "2D time-dependent map selected. Choose x and y variables; the path follows the chosen time order.";
  }

  function updatePanels() {
    const isReturn = selValue(elMapType, "time") === "return";
    const is3D = selValue(elFrameDim, "2d") === "3d";
    const useTimeAxis = is3D && selValue(elUseTimeAxis, "yes") === "yes";

    if (elTimeMapControls) elTimeMapControls.classList.toggle("tool3-hidden", isReturn);
    if (elReturnControls) elReturnControls.classList.toggle("tool3-hidden", !isReturn);
    if (elUseTimeAxisWrap) elUseTimeAxisWrap.classList.toggle("tool3-hidden", isReturn || !is3D);
    if (elZWrap) elZWrap.classList.toggle("tool3-hidden", isReturn || !is3D || useTimeAxis);
    if (elReturnNote) {
      elReturnNote.textContent = is3D
        ? "3D return map uses x = variable(n), y = variable(n+lag), and z = time."
        : "2D return map uses x = variable(n) and y = variable(n+lag).";
    }
    updateSummaryText();
  }

  function getMinMax(values) {
    let lo = Infinity;
    let hi = -Infinity;
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

  function project3DFactory(xs, ys, zs, width, height) {
    const [xmin, xmax] = getMinMax(xs);
    const [ymin, ymax] = getMinMax(ys);
    const [zmin, zmax] = getMinMax(zs);
    const norm = (v, lo, hi) => ((v - lo) / ((hi - lo) || 1)) * 2 - 1;
    const az = Math.PI / 4.3;
    const el = Math.PI / 8.8;

    const pts = xs.map((x, i) => {
      const X = norm(x, xmin, xmax);
      const Y = norm(ys[i], ymin, ymax);
      const Z = norm(zs[i], zmin, zmax);
      const xr = Math.cos(az) * X - Math.sin(az) * Y;
      const yr0 = Math.sin(az) * X + Math.cos(az) * Y;
      const yr = Math.cos(el) * yr0 - Math.sin(el) * Z;
      return { x: xr, y: yr };
    });

    let minPX = Infinity;
    let maxPX = -Infinity;
    let minPY = Infinity;
    let maxPY = -Infinity;
    pts.forEach((p) => {
      minPX = Math.min(minPX, p.x);
      maxPX = Math.max(maxPX, p.x);
      minPY = Math.min(minPY, p.y);
      maxPY = Math.max(maxPY, p.y);
    });

    const pad = 0.12;
    const sx = (maxPX - minPX) || 1;
    const sy = (maxPY - minPY) || 1;
    minPX -= sx * pad;
    maxPX += sx * pad;
    minPY -= sy * pad;
    maxPY += sy * pad;

    return function (i) {
      const p = pts[i];
      return {
        x: ((p.x - minPX) / ((maxPX - minPX) || 1)) * width,
        y: height - ((p.y - minPY) / ((maxPY - minPY) || 1)) * height
      };
    };
  }

  function render2DTimeFrame(d, idx, cfg) {
    const canvas = createCanvas(cfg);
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 60, r: 24, t: 50, b: 48 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const [xmin, xmax] = getMinMax(d.x);
    const [ymin, ymax] = getMinMax(d.y);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;

    drawBackground(ctx, w, h, `${d.yCol} vs ${d.xCol}`);
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
    ctx.fillText(d.xCol, w / 2 - 10, h - 12);
    ctx.save();
    ctx.translate(16, h / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(d.yCol, 0, 0);
    ctx.restore();
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);
    ctx.fillText(`${d.tCol}: ${formatTick(d.t[activeIdx])}`, w - 170, 44);

    return canvas;
  }

  function render2DReturnFrame(d, idx, cfg) {
    const canvas = createCanvas(cfg);
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 60, r: 24, t: 50, b: 48 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const all = d.x.concat(d.y);
    const [xmin, xmax] = getMinMax(all);
    const [ymin, ymax] = getMinMax(all);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;
    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));

    drawBackground(ctx, w, h, `Return map: ${d.varCol}(n) vs ${d.varCol}(n+${d.lag})`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax);

    ctx.save();
    ctx.strokeStyle = "#9ca3af";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xMap(xmin), yMap(xmin));
    ctx.lineTo(xMap(xmax), yMap(xmax));
    ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#2563eb";
    for (let i = 0; i < d.x.length; i++) {
      ctx.beginPath();
      ctx.arc(xMap(d.x[i]), yMap(d.y[i]), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= activeIdx; i++) {
      const xx = xMap(d.x[i]);
      const yy = yMap(d.y[i]);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    const ps = clampInt(elPointSize.value, 4, 24, 11);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), ps * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#374151";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText(`${d.varCol}(n)`, w / 2 - 24, h - 12);
    ctx.save();
    ctx.translate(16, h / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${d.varCol}(n+${d.lag})`, 0, 0);
    ctx.restore();
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);
    ctx.fillText(`${d.tCol}: ${formatTick(d.t[activeIdx])}`, w - 170, 44);

    return canvas;
  }

  function render3DFrame(d, idx, cfg, title, xLabel, yLabel, zLabel) {
    const canvas = createCanvas(cfg);
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const pad = { l: 24, r: 24, t: 50, b: 28 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;

    drawBackground(ctx, w, h, title);
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
    ctx.fillText(`x = ${xLabel}`, 18, h - 34);
    ctx.fillText(`y = ${yLabel}`, 18, h - 18);
    ctx.fillText(`z = ${zLabel}`, 180, h - 18);
    ctx.fillText(`frame ${activeIdx + 1}/${d.x.length}`, w - 130, 26);
    if (d.t && d.t.length) ctx.fillText(`${d.tCol}: ${formatTick(d.t[activeIdx])}`, w - 170, 44);

    return canvas;
  }

  function buildFrameConfig() {
    return { width: 640, height: 420 };
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

  function collectAnimationSpec() {
    const cfg = buildFrameConfig();
    const nFramesInput = clampInt(elFrames.value, 8, 120, 40);
    const current = getCurrentSpec();
    let frameIndices = [];
    let drawFrame = null;
    let outName = "plot_frames.zip";

    if (current.x.length < 2) throw new Error("Need at least two valid points for frame export.");

    frameIndices = buildFrameIndices(current.x.length, Math.min(nFramesInput, current.x.length));

    if (current.mapType === "time") {
      if (current.frameDim === "2d") {
        drawFrame = (idx) => render2DTimeFrame(current, idx, cfg);
        outName = `${current.xCol.replace(/[^\w.-]+/g, "_")}_${current.yCol.replace(/[^\w.-]+/g, "_")}_time_map_frames.zip`;
      } else {
        const zLabel = current.useTimeAxis ? current.tCol : current.zCol;
        const title = current.useTimeAxis
          ? `${current.xCol}, ${current.yCol}, ${current.tCol}`
          : `${current.xCol}, ${current.yCol}, ${current.zCol}`;
        drawFrame = (idx) => render3DFrame(current, idx, cfg, title, current.xCol, current.yCol, zLabel);
        outName = current.useTimeAxis
          ? `${current.xCol.replace(/[^\w.-]+/g, "_")}_${current.yCol.replace(/[^\w.-]+/g, "_")}_time_axis_frames.zip`
          : `${current.xCol.replace(/[^\w.-]+/g, "_")}_${current.yCol.replace(/[^\w.-]+/g, "_")}_${current.zCol.replace(/[^\w.-]+/g, "_")}_time_ordered_frames.zip`;
      }
    } else {
      if (current.frameDim === "2d") {
        drawFrame = (idx) => render2DReturnFrame(current, idx, cfg);
        outName = `${current.varCol.replace(/[^\w.-]+/g, "_")}_return_map_lag${current.lag}_frames.zip`;
      } else {
        drawFrame = (idx) => render3DFrame(current, idx, cfg, `Return map: ${current.varCol}(n), ${current.varCol}(n+${current.lag}), ${current.tCol}`, `${current.varCol}(n)`, `${current.varCol}(n+${current.lag})`, current.tCol);
        outName = `${current.varCol.replace(/[^\w.-]+/g, "_")}_return_map_3d_lag${current.lag}_frames.zip`;
      }
    }

    return { cfg, frameIndices, drawFrame, outName };
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode PNG frame.")), "image/png");
    });
  }

  async function downloadFramesZip() {
    if (!state.rows.length) {
      setFramesStatus("Upload data first before exporting frames.");
      return;
    }
    if (!window.JSZip) {
      setFramesStatus("Frame ZIP export needs JSZip. Please refresh the page and try again.");
      return;
    }

    if (elFramesZipBtn) {
      elFramesZipBtn.disabled = true;
      elFramesZipBtn.textContent = "Rendering…";
    }

    revokeFrameZipUrl();
    setFramesZipDownloadEnabled(false);

    try {
      const spec = collectAnimationSpec();
      const zip = new window.JSZip();
      const digits = Math.max(3, String(spec.frameIndices.length).length);

      for (let i = 0; i < spec.frameIndices.length; i++) {
        setFramesStatus(`Rendering PNG frame ${i + 1} of ${spec.frameIndices.length}…`);
        const canvas = spec.drawFrame(spec.frameIndices[i]);
        const blob = await canvasToPngBlob(canvas);
        const name = `frame_${String(i + 1).padStart(digits, "0")}.png`;
        zip.file(name, blob);
        await yieldToUi();
      }

      setFramesStatus("Compressing frame ZIP…");
      const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
        setFramesStatus(`Compressing frame ZIP… ${Math.round(meta.percent || 0)}%`);
      });

      state.frameZipUrl = URL.createObjectURL(zipBlob);
      setFramesZipDownloadEnabled(true, state.frameZipUrl, spec.outName);
      setFramesStatus(`Frames ZIP ready. ${spec.frameIndices.length} PNG frames created.`);
      if (elFramesZipDownload) elFramesZipDownload.click();
    } catch (err) {
      console.error(err);
      setFramesStatus(err && err.message ? err.message : "Could not export frame ZIP.");
    } finally {
      if (elFramesZipBtn) {
        elFramesZipBtn.disabled = false;
        elFramesZipBtn.textContent = "Render frames ZIP";
      }
    }
  }

  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read one of the frame images."));
      };
      img.src = url;
    });
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

  function encodeAnimatedGif(frameCanvases, width, height, delayCs, onProgress) {
    const palette = buildGIFPalette332();
    const parts = [];

    parts.push(Uint8Array.from([71, 73, 70, 56, 57, 97]));
    parts.push(le16(width));
    parts.push(le16(height));
    parts.push(Uint8Array.from([0xF7, 0x00, 0x00]));
    parts.push(palette);
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

      parts.push(Uint8Array.from([0x21, 0xF9, 0x04, 0x00]));
      parts.push(le16(delayCs));
      parts.push(Uint8Array.from([0x00, 0x00]));

      parts.push(Uint8Array.from([0x2C]));
      parts.push(le16(0));
      parts.push(le16(0));
      parts.push(le16(width));
      parts.push(le16(height));
      parts.push(Uint8Array.from([0x00]));

      parts.push(Uint8Array.from([0x08]));
      const subs = splitSubBlocks(lzw);
      for (let j = 0; j < subs.length; j++) parts.push(subs[j]);
    }

    parts.push(Uint8Array.from([0x3B]));

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

      const fps = clampInt(elMergeFps && elMergeFps.value, 1, 20, 8);
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

  function handleSheetChange() {
    parseSheet(selValue(elSheet));
    refreshControls();
    updatePanels();
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

  [elTimeCol, elFrameDim, elMapType, elUseTimeAxis, elX, elY, elZ, elReturnVar].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => {
      refreshControls();
      updatePanels();
      renderCurrentPlot();
    });
  });

  [elLag, elPointSize].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => renderCurrentPlot());
    el.addEventListener("change", () => renderCurrentPlot());
  });

  if (elFramesZipBtn) elFramesZipBtn.addEventListener("click", downloadFramesZip);
  if (elMergeGifBtn) elMergeGifBtn.addEventListener("click", mergeFramesZipToGif);

  setFramesZipDownloadEnabled(false);
  setMergeGifDownloadEnabled(false);
  setFramesStatus("Render the selected plot into PNG frames and download them as a ZIP file.");
  setMergeStatus("Upload a ZIP of PNG or JPG frames to merge them into a GIF here.");
  renderPreviewTable();
  updatePanels();
  renderCurrentPlot();
})();
