(function () {
  const $ = (id) => document.getElementById(id);

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
  const elExportResolution = $("tool3ExportResolution");
  const elFrameTitle = $("tool3FrameTitle");
  const elFrameXLabel = $("tool3FrameXLabel");
  const elFrameYLabel = $("tool3FrameYLabel");
  const elFrameZLabel = $("tool3FrameZLabel");
  const elFrameTimeLabel = $("tool3FrameTimeLabel");
  const elAxisXMin = $("tool3AxisXMin");
  const elAxisXMax = $("tool3AxisXMax");
  const elAxisYMin = $("tool3AxisYMin");
  const elAxisYMax = $("tool3AxisYMax");
  const elAxisZMin = $("tool3AxisZMin");
  const elAxisZMax = $("tool3AxisZMax");
  const elFramesZipBtn = $("tool3FramesZipBtn");
  const elFramesZipDownload = $("tool3FramesZipDownload");
  const elFramesStatus = $("tool3FramesStatus");

  const elCanvasPreview = $("tool3Plot");
  const elPlot = $("tool3InteractivePlot");
  const elCreateGif = $("tool3CreateGif");
  const elDirectStatus = $("tool3DirectStatus");
  const elCancel = $("tool3Cancel");
  const elProgress = $("tool3Progress");
  const elGifDownload = $("tool3GifDownload");
  const elGifPreview = $("tool3GifPreview");
  const elGifMeta = $("tool3GifMeta");
  const elFps = $("tool3Fps");
  const elExample = $("tool3ExampleBtn");
  const elInteractiveToggle = $("tool3InteractiveToggle");
  const elMeta = $("tool3Meta");
  const elPreviewHead = $("tool3PreviewHead");
  const elPreviewBody = $("tool3PreviewBody");

  const elMergeZipFile = $("tool3MergeZipFile");
  const elMergeFps = $("tool3MergeFps");
  const elMergeGifBtn = $("tool3MergeGifBtn");
  const elMergeGifDownload = $("tool3MergeGifDownload");
  const elMergeStatus = $("tool3MergeStatus");
  const elMergePreview = $("tool3MergePreview");

  if (!elFile || !elSheet || !elPlot || !elCanvasPreview) return;

  const state = {
    workbook: null,
    fileName: "",
    sheetName: "",
    headers: [],
    rows: [],
    numericHeaders: [],
    frameZipUrl: "",
    mergeGifUrl: "",
    directGifUrl: "",
    job: null,
    previewMode: "export",
    dataRevision: 0,
    colorRules: []
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

  function optionalFloat(v) {
    if (v == null) return null;
    const s = safeText(v);
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
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
      linkEl.classList.remove("tool3-hidden");
      linkEl.href = href || "#";
      if (filename) linkEl.download = filename;
      linkEl.removeAttribute("aria-disabled");
      linkEl.style.pointerEvents = "";
      linkEl.style.opacity = "";
    } else {
      linkEl.classList.add("tool3-hidden");
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

    // Discard empty leading rows from spreadsheets without losing numeric zeroes.
    while (matrix.length && !matrix[0].some(v => safeText(v) !== "")) matrix = matrix.slice(1);
    if (!matrix.length) return parseMatrixToState(name, []);
    const headers = uniqueHeaders(matrix[0]);
    const rows = matrix.slice(1).map((r) => {
      const obj = Object.create(null);
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
    const matrix = ws.matrix || XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
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
    const numeric = state.numericHeaders.length ? state.numericHeaders.slice() : state.headers.slice();
    return numeric;
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
    const prevTime = elTimeCol && elTimeCol.value ? elTimeCol.value : "";
    const prevX = elX && elX.value ? elX.value : "";
    const prevY = elY && elY.value ? elY.value : "";
    const prevZ = elZ && elZ.value ? elZ.value : "";
    const prevReturnVar = elReturnVar && elReturnVar.value ? elReturnVar.value : "";

    optionList(elTimeCol, state.headers, prevTime || timeGuess);
    elSheet.disabled = !state.rows.length || !!state.job;
    elTimeCol.disabled = !state.rows.length || !!state.job;

    const vars = getVariableOptions();
    optionList(elX, vars, prevX || vars[0] || "");
    optionList(elY, vars, prevY || vars[1] || vars[0] || "");
    optionList(elZ, vars, prevZ || vars[2] || vars[0] || "");
    const signalVars = vars.filter(v => v !== elTimeCol.value);
    optionList(elReturnVar, vars, prevReturnVar || signalVars[0] || vars[0] || "");

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

  function parseDelimited(text) {
    const clean = text.replace(/^\uFEFF/, "");
    const firstLine = clean.split(/\r?\n/,1)[0];
    const delimiters = [",", "\t", ";"], counts = new Map(delimiters.map(c=>[c,0]));
    let inQuotes = false;
    for (let i=0;i<firstLine.length;i++) {
      if (firstLine[i] === '"') {
        if (inQuotes && firstLine[i+1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && counts.has(firstLine[i])) counts.set(firstLine[i],counts.get(firstLine[i])+1);
    }
    const delimiter = delimiters.sort((a,b)=>counts.get(b)-counts.get(a))[0];
    const rows = []; let row = [], cell = "", quoted = false;
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (c === '"') {
        if (quoted && clean[i+1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && c === delimiter) { row.push(cell); cell = ""; }
      else if (!quoted && (c === "\n" || c === "\r")) {
        if (c === "\r" && clean[i+1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (quoted) throw new Error("The CSV has an unclosed quoted field. Check the file format.");
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function useWorkbook(workbook, fileName) {
    state.workbook = workbook;
    state.fileName = fileName;
    state.colorRules = [];
    const names = workbook.SheetNames || [];
    if (!names.length) throw new Error("No readable sheets were found.");
    elSheet.innerHTML = names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    elSheet.value = names[0];
    parseSheet(names[0]);
    // Reset column defaults for each new file; changing sheets preserves matching choices.
    [elTimeCol,elX,elY,elZ,elReturnVar].forEach(el => { el.innerHTML = ""; });
    refreshControls(); updatePanels(); renderColorRules(); renderCurrentPlot();
    setDirectStatus("Ready. Choose Create GIF to render and encode your animation.");
  }

  async function loadWorkbookFromFile(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "csv" || ext === "txt") {
      const matrix = parseDelimited(await file.text());
      useWorkbook({ SheetNames:["Data"], Sheets:{Data:{matrix}} },file.name);
    } else {
      if (!window.XLSX) throw new Error("Excel support could not load. Reload with an internet connection, or save the sheet as CSV.");
      useWorkbook(XLSX.read(await file.arrayBuffer(),{type:"array"}),file.name);
    }
  }

  function orderedRowsUsingTime(tCol, neededCols) {
    const pts = [];
    for (let i = 0; i < state.rows.length; i++) {
      const row = state.rows[i];
      const obj = { rawTime: row[tCol], tSort: i, sourceRow: row };
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
    const frameDim = elFrameDim.value;
    const tCol = elTimeCol.value;
    const xCol = elX.value;
    const yCol = elY.value;
    const useTimeAxis = frameDim === "3d" && elUseTimeAxis.value === "yes";

    const neededCols = [xCol, yCol];
    let zCol = "";
    if (frameDim === "3d" && !useTimeAxis) {
      zCol = elZ.value;
      neededCols.push(zCol);
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
      t: [],
      rows: [],
      branchDirections: {}
    };

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      out.rows.push(p.sourceRow);
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
    const frameDim = elFrameDim.value;
    const tCol = elTimeCol.value;
    const varCol = elReturnVar.value;
    const lag = clampInt(elLag.value, 1, 100000, 1);
    const pts = orderedRowsUsingTime(tCol, [varCol]);

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
      t: [],
      rows: [],
      branchDirections: {}
    };

    for (let i = 0; i < n; i++) {
      out.rows.push(pts[i].sourceRow);
      out.x.push(signal[i]);
      out.y.push(signal[i + lag]);
      out.t.push(times[i]);
      if (frameDim === "3d") out.z.push(times[i]);
    }
    return out;
  }

  function applyAxisFilterToSpec(spec) {
    const ranges = getAxisScaleOverrides();
    const keepX = (v) => ranges.xMin == null || v >= ranges.xMin;
    const keepX2 = (v) => ranges.xMax == null || v <= ranges.xMax;
    const keepY = (v) => ranges.yMin == null || v >= ranges.yMin;
    const keepY2 = (v) => ranges.yMax == null || v <= ranges.yMax;
    const keepZ = (v) => ranges.zMin == null || v >= ranges.zMin;
    const keepZ2 = (v) => ranges.zMax == null || v <= ranges.zMax;

    const out = { ...spec, x: [], y: [], z: [], t: [], sourceIndices: [], originalCount: spec.x.length, rows: [], branchDirections: Object.fromEntries(Object.keys(spec.branchDirections || {}).map(k=>[k,[]])) };
    for (let i = 0; i < spec.x.length; i++) {
      const x = spec.x[i];
      const y = spec.y[i];
      const z = spec.frameDim === "3d" ? spec.z[i] : null;
      const inRange = keepX(x) && keepX2(x) && keepY(y) && keepY2(y) && (spec.frameDim !== "3d" || (keepZ(z) && keepZ2(z)));
      if (!inRange) continue;
      out.sourceIndices.push(i);
      out.rows.push(spec.rows[i]);
      for (const key of Object.keys(out.branchDirections)) out.branchDirections[key].push(spec.branchDirections[key][i]);
      out.x.push(x);
      out.y.push(y);
      out.t.push(spec.t[i]);
      if (spec.frameDim === "3d") out.z.push(z);
    }
    return out;
  }

  function getCurrentSpec() {
    const raw = elMapType.value === "return" ? getReturnMapData() : getTimeMapData();
    for (const column of new Set(state.colorRules.filter(r=>r.kind==="branch").map(r=>r.column))) {
      let direction = 0;
      const values = raw.rows.map(row=>num(row[column]));
      const directions = values.map((value,i)=>{
        if (i>0 && Number.isFinite(value) && Number.isFinite(values[i-1]) && value!==values[i-1]) direction = Math.sign(value-values[i-1]);
        return direction;
      });
      const first = directions.find(v=>v!==0) || 0;
      for (let i=0;i<directions.length && directions[i]===0;i++) directions[i]=first;
      raw.branchDirections[column] = directions;
    }
    return applyAxisFilterToSpec(raw);
  }

  function build3DScene(xTitle, yTitle, zTitle) {
    // Fixed clear 3D camera + equal visual scaling. This prevents the preview
    // from becoming flat or hidden after changing variables with very different ranges.
    return {
      xaxis: { title: xTitle, automargin: true, showspikes: false },
      yaxis: { title: yTitle, automargin: true, showspikes: false },
      zaxis: { title: zTitle, automargin: true, showspikes: false },
      aspectmode: "cube",
      dragmode: "orbit",
      camera: {
        eye: { x: 1.85, y: -1.85, z: 1.25 },
        up: { x: 0, y: 0, z: 1 },
        center: { x: 0, y: 0, z: 0 }
      }
    };
  }

  function renderPlotly3D(target,traces,layout) {
    return Plotly.react(target,traces,layout,{responsive:true,displaylogo:false,scrollZoom:false}).then(()=>Plotly.Plots.resize(target));
  }

  let webGLAvailable;
  function supportsWebGL() {
    if (webGLAvailable !== undefined) return webGLAvailable;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      webGLAvailable = !!gl;
      if (gl) gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch(e) { webGLAvailable = false; }
    return webGLAvailable;
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
        scene: {
          ...build3DScene(d.xCol, d.yCol, zTitle),
          xaxis: { title: d.xCol, automargin: true, range: resolveAxisRange(d.x, getAxisScaleOverrides().xMin, getAxisScaleOverrides().xMax) },
          yaxis: { title: d.yCol, automargin: true, range: resolveAxisRange(d.y, getAxisScaleOverrides().yMin, getAxisScaleOverrides().yMax) },
          zaxis: { title: zTitle, automargin: true, range: resolveAxisRange(d.z, getAxisScaleOverrides().zMin, getAxisScaleOverrides().zMax) }
        },
        legend: { orientation: "h", y: 1.06 },
        paper_bgcolor: "#fff"
      };
      const rendering = renderPlotly3D(elPlot, traces, professionalLayout(layout, d, traces));
      setMeta(`Showing ${d.x.length} valid points ordered by ${d.tCol}. Preview uses equal visual scaling and a fixed clear 3D camera.`);
      return rendering;
    }

    const traces = [
      { x: d.x, y: d.y, type: "scatter", mode: "lines", name: "Time-dependent path", line: { width: 3 } },
      { x: d.x.length ? [d.x[d.x.length - 1]] : [], y: d.y.length ? [d.y[d.y.length - 1]] : [], type: "scatter", mode: "markers", name: "Current point", marker: { size: pointSize } }
    ];
    const layout = {
      title: `${d.yCol} vs ${d.xCol} ordered by ${d.tCol}`,
      margin: { l: 62, r: 24, t: 56, b: 58 },
      xaxis: { title: d.xCol, automargin: true, range: resolveAxisRange(d.x, getAxisScaleOverrides().xMin, getAxisScaleOverrides().xMax) },
      yaxis: { title: d.yCol, automargin: true, range: resolveAxisRange(d.y, getAxisScaleOverrides().yMin, getAxisScaleOverrides().yMax) },
      legend: { orientation: "h", y: 1.12 },
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff"
    };
    const rendering = Plotly.react(elPlot, traces, professionalLayout(layout, d, traces), { responsive: true, displaylogo: false, scrollZoom: false });
    setMeta(`Showing ${d.x.length} valid 2D points ordered by ${d.tCol}.`);
    return rendering;
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
        scene: {
          ...build3DScene(`${d.varCol}(n)`, `${d.varCol}(n+${d.lag})`, d.tCol),
          xaxis: { title: `${d.varCol}(n)`, automargin: true, range: resolveAxisRange(d.x, getAxisScaleOverrides().xMin, getAxisScaleOverrides().xMax) },
          yaxis: { title: `${d.varCol}(n+${d.lag})`, automargin: true, range: resolveAxisRange(d.y, getAxisScaleOverrides().yMin, getAxisScaleOverrides().yMax) },
          zaxis: { title: d.tCol, automargin: true, range: resolveAxisRange(d.z, getAxisScaleOverrides().zMin, getAxisScaleOverrides().zMax) }
        },
        legend: { orientation: "h", y: 1.06 },
        paper_bgcolor: "#fff"
      };
      const rendering = renderPlotly3D(elPlot, traces, professionalLayout(layout, d, traces));
      setMeta(`Showing ${d.x.length} return-map points. Axes: x=${d.varCol}(n), y=${d.varCol}(n+${d.lag}), z=${d.tCol}. Preview uses equal visual scaling and a fixed clear 3D camera.`);
      return rendering;
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
    const xr = getMinMax(d.x), yr = getMinMax(d.y);
    const diagMin = Math.min(xr[0], yr[0]);
    const diagMax = Math.max(xr[1], yr[1]);
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
      xaxis: { title: `${d.varCol}(n)`, automargin: true, range: resolveAxisRange(d.x, getAxisScaleOverrides().xMin, getAxisScaleOverrides().xMax) },
      yaxis: { title: `${d.varCol}(n+${d.lag})`, automargin: true, scaleanchor: "x", scaleratio: 1, range: resolveAxisRange(d.y, getAxisScaleOverrides().yMin, getAxisScaleOverrides().yMax) },
      legend: { orientation: "h", y: 1.12 },
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff"
    };
    const rendering = Plotly.react(elPlot, traces, professionalLayout(layout, d, traces), { responsive: true, displaylogo: false, scrollZoom: false });
    setMeta(`Showing ${d.x.length} return-map points from the selected variable. Lag = ${d.lag}. Ordered by ${d.tCol}.`);
    return rendering;
  }

  function professionalLayout(layout, d, traces) {
    const labels = getFrameAnnotationConfig(d);
    layout.title = {text:labels.title,font:{size:15},x:.07};
    layout.font = {family:"Inter, Arial, sans-serif",size:11,color:"#334556"};
    layout.colorway = ["#30648a","#922b3e","#6b8799"];
    layout.uirevision = `${d.frameDim}-${d.mapType}-${state.dataRevision}`;
    if (layout.scene) {
      layout.scene.xaxis.title = labels.xLabel;
      layout.scene.yaxis.title = labels.yLabel;
      layout.scene.zaxis.title = labels.zLabel;
    } else {
      layout.xaxis.title = labels.xLabel; layout.yaxis.title = labels.yLabel;
      layout.legend = {orientation:"h",y:-.22};
      for (const axis of [layout.xaxis,layout.yaxis]) {
        axis.gridcolor = "#edf0f2"; axis.zerolinecolor = "#cbd3d9";
      }
    }
    // Plotly must respect the same gaps created by axis cropping as the exported canvas.
    traces.forEach(trace => {
      if (!trace.x || trace.x.length !== d.x.length || !trace.mode.includes("lines")) return;
      for (const key of ["x","y","z"]) {
        if (!trace[key]) continue;
        const values = [];
        for (let i=0;i<trace[key].length;i++) {
          if (i>0 && isPathStart(d,i)) values.push(null);
          values.push(trace[key][i]);
        }
        trace[key] = values;
      }
      trace.connectgaps = false;
    });
    applyInteractiveColors(traces,d);
    return layout;
  }

  function axisValidation() {
    const is3D = elFrameDim.value === "3d";
    const pairs = [[elAxisXMin,elAxisXMax,"X"],[elAxisYMin,elAxisYMax,"Y"],...(is3D?[[elAxisZMin,elAxisZMax,"Z"]]:[])];
    for (const [lo,hi,label] of pairs) {
      const invalid = (lo.value!=="" && !lo.validity.valid) || (hi.value!=="" && !hi.validity.valid) || (lo.value!=="" && hi.value!=="" && Number(lo.value)>=Number(hi.value));
      lo.setAttribute("aria-invalid",String(invalid)); hi.setAttribute("aria-invalid",String(invalid));
      if (invalid) return `${label} minimum must be less than ${label} maximum.`;
    }
    return "";
  }

  function previewEmpty(message) {
    elCanvasPreview.innerHTML = `<div class="tool3-empty"><span aria-hidden="true">↗</span><h3>Your plot starts here</h3><p>${escapeHtml(message)}</p></div>`;
    elCanvasPreview.classList.remove("tool3-hidden");
    elPlot.classList.add("tool3-hidden");
  }

  async function renderCurrentPlot() {
    const revision = ++state.previewRevision;
    renderColorLegend();
    updateAvailability();
    $("tool3CameraNote").classList.toggle("tool3-hidden",elFrameDim.value!=="3d");
    if (!state.rows.length) { previewEmpty("Upload a file or use the included example."); setMeta("No data loaded."); renderPreviewTable(); return; }
    const error = axisValidation() || colorValidation();
    if (error) { previewEmpty(error); setMeta(error); setDirectStatus(error); return; }
    const spec = getCurrentSpec();
    if (!spec.x.length) {
      const message = elMapType.value === "return" ? "No return-map points. Reduce the lag or reset the axis limits." : "No numeric points within the selected axis limits. Check the columns or reset the limits.";
      previewEmpty(message); setMeta(message); setDirectStatus(message); return;
    }
    try {
      const labels = getFrameAnnotationConfig(spec), cfg = {width:960,height:630};
      const canvas = spec.frameDim === "3d" ? render3DFrame(spec,spec.x.length-1,cfg,labels)
        : spec.mapType === "return" ? render2DReturnFrame(spec,spec.x.length-1,cfg,labels) : render2DTimeFrame(spec,spec.x.length-1,cfg,labels);
      canvas.setAttribute("role","img"); canvas.setAttribute("aria-label", `${labels.title}. ${spec.x.length} plotted points. ${spec.frameDim.toUpperCase()} ${spec.mapType} map.`);
      elCanvasPreview.replaceChildren(canvas);
      setMeta(`${spec.x.length.toLocaleString()} plotted points${spec.x.length!==spec.originalCount?` of ${spec.originalCount.toLocaleString()} after axis cropping`:""} · ordered by ${spec.tCol}. Preview matches the GIF export view.`);
      if (state.previewMode === "interactive" && spec.frameDim === "3d" && !supportsWebGL()) {
        state.previewMode = "export"; elInteractiveToggle.textContent = "Interactive view";
        showPane("plot");
        setMeta("Interactive 3D is unavailable in this browser. The export preview and GIF creation work normally.");
      }
      if (state.previewMode === "interactive" && window.Plotly) {
        elPlot.classList.remove("tool3-hidden"); elCanvasPreview.classList.add("tool3-hidden");
        await (spec.mapType === "return" ? renderReturnPreview(spec) : renderTimePreview(spec));
        if (revision !== state.previewRevision) return;
      } else { elPlot.classList.add("tool3-hidden"); elCanvasPreview.classList.remove("tool3-hidden"); }
    } catch (error) {
      state.previewMode = "export"; elInteractiveToggle.textContent = "Interactive view";
      elCanvasPreview.classList.remove("tool3-hidden"); elPlot.classList.add("tool3-hidden");
      setMeta("The interactive view is unavailable. The export preview and GIF creation remain available.");
    }
  }

  function updateSummaryText() {
    const frameDim = elFrameDim.value;
    const mapType = elMapType.value;
    if (mapType === "return") {
      if (frameDim === "3d") {
        elSummary.textContent = "3D return map selected. The frames use x = variable(n), y = variable(n+lag), and z = time.";
      } else {
        elSummary.textContent = "2D return map selected. The frames use x = variable(n) and y = variable(n+lag), following the chosen time order.";
      }
      return;
    }

    if (frameDim === "3d") {
      if (elUseTimeAxis.value === "yes") {
        elSummary.textContent = "3D time-dependent map selected with time as one axis. Choose x and y variables; z is the time column.";
      } else {
        elSummary.textContent = "3D time-dependent map selected without time as an axis. Choose x, y, z variables; the path still follows the chosen time order.";
      }
      return;
    }

    elSummary.textContent = "2D time-dependent map selected. Choose x and y variables; the path follows the chosen time order.";
  }

  function updatePanels() {
    const isReturn = elMapType.value === "return";
    const is3D = elFrameDim.value === "3d";
    const useTimeAxis = is3D && elUseTimeAxis.value === "yes";

    if (elTimeMapControls) elTimeMapControls.classList.toggle("tool3-hidden", isReturn);
    if (elReturnControls) elReturnControls.classList.toggle("tool3-hidden", !isReturn);
    if (elUseTimeAxisWrap) elUseTimeAxisWrap.classList.toggle("tool3-hidden", isReturn || !is3D);
    if (elZWrap) elZWrap.classList.toggle("tool3-hidden", isReturn || !is3D || useTimeAxis);
    if (elReturnNote) {
      elReturnNote.textContent = is3D
        ? "3D return map uses x = variable(n), y = variable(n+lag), and z = time."
        : "2D return map uses x = variable(n) and y = variable(n+lag).";
    }
    $("tool3ZLimits").classList.toggle("tool3-hidden",!is3D);
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

  function drawBackground(ctx, w, h, title, scale = 1) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    const maxTitleWidth = w - 48 * scale;
    let titleSize = 22 * scale;
    do {
      ctx.font = `600 ${titleSize}px Inter, Arial, sans-serif`;
      if (ctx.measureText(title).width <= maxTitleWidth || titleSize <= 12 * scale) break;
      titleSize -= .5 * scale;
    } while (true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, Math.round(w / 2), Math.round(34 * scale), maxTitleWidth);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax, scale = 1) {
    const majorTicks = 5;
    ctx.save();
    ctx.strokeStyle = "rgba(15,23,42,0.10)";
    ctx.lineWidth = Math.max(0.7, 0.9 * scale);
    for (let k = 0; k < majorTicks; k++) {
      const frac = k / (majorTicks - 1);
      const xx = pad.l + frac * iw;
      const yy = pad.t + ih - frac * ih;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + iw, yy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xx, pad.t);
      ctx.lineTo(xx, pad.t + ih);
      ctx.stroke();
    }

    if (xmin < 0 && xmax > 0) {
      const x0 = pad.l + ((0 - xmin) / ((xmax - xmin) || 1)) * iw;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = Math.max(0.9, 1.05 * scale);
      ctx.beginPath();
      ctx.moveTo(x0, pad.t);
      ctx.lineTo(x0, pad.t + ih);
      ctx.stroke();
    }
    if (ymin < 0 && ymax > 0) {
      const y0 = pad.t + ih - ((0 - ymin) / ((ymax - ymin) || 1)) * ih;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = Math.max(0.9, 1.05 * scale);
      ctx.beginPath();
      ctx.moveTo(pad.l, y0);
      ctx.lineTo(pad.l + iw, y0);
      ctx.stroke();
    }

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = Math.max(1.25, 1.35 * scale);
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + ih);
    ctx.lineTo(pad.l + iw, pad.t + ih);
    ctx.stroke();

    ctx.fillStyle = "#374151";
    ctx.font = `${Math.max(12, Math.round(12 * scale))}px Inter, Arial, sans-serif`;
    ctx.textAlign = "right";
    for (let k = 0; k < majorTicks; k++) {
      const frac = k / (majorTicks - 1);
      const yy = pad.t + ih - frac * ih;
      const yv = ymin + frac * (ymax - ymin);
      ctx.fillText(formatTick(yv), pad.l - Math.round(12 * scale), yy + Math.round(4 * scale));
    }
    ctx.textAlign = "center";
    for (let k = 0; k < majorTicks; k++) {
      const frac = k / (majorTicks - 1);
      const xx = pad.l + frac * iw;
      const xv = xmin + frac * (xmax - xmin);
      ctx.fillText(formatTick(xv), xx, pad.t + ih + Math.round(24 * scale));
    }
    ctx.restore();
  }

  function projectPoint3D(x, y, z, camera) {
    // Mild perspective only; strong perspective compressed some 3D frames.
    const cz = z + camera.distance;
    const perspective = camera.distance / Math.max(1.5, cz);
    const mix = 0.18;
    const p = 1 + (perspective - 1) * mix;
    return {
      x: x * p,
      y: y * p,
      depth: p,
      rawZ: z
    };
  }

  function build3DProjectionScene(xs, ys, zs, width, height, ranges = {}) {
    const [xmin, xmax] = resolveAxisRange(xs, ranges.xMin, ranges.xMax);
    const [ymin, ymax] = resolveAxisRange(ys, ranges.yMin, ranges.yMax);
    const [zmin, zmax] = resolveAxisRange(zs, ranges.zMin, ranges.zMax);
    const norm01 = (v, lo, hi) => (v - lo) / ((hi - lo) || 1);

    // Open-axis 3D projection for exported frames:
    // z is vertical at the left, x is along the bottom, and y begins at
    // the end of x. This creates three open axis lines with two joints.
    // All normalized corners fit: 0.86 - 0.56 - 0.24 = 0.06 > 0.
    const zBase = { x: width * 0.17, y: height * 0.86 };
    const zEnd  = { x: width * 0.17, y: height * 0.30 };
    const xEnd  = { x: width * 0.66, y: height * 0.86 };
    const yEnd  = { x: width * 0.89, y: height * 0.62 };

    const vx = { x: xEnd.x - zBase.x, y: xEnd.y - zBase.y };
    const vy = { x: yEnd.x - xEnd.x, y: yEnd.y - xEnd.y };
    const vz = { x: zEnd.x - zBase.x, y: zEnd.y - zBase.y };

    function toScreen(x, y, z) {
      const X = norm01(x, xmin, xmax);
      const Y = norm01(y, ymin, ymax);
      const Z = norm01(z, zmin, zmax);
      return {
        x: zBase.x + X * vx.x + Y * vy.x + Z * vz.x,
        y: zBase.y + X * vx.y + Y * vy.y + Z * vz.y,
        depth: 1 + 0.25 * Y + 0.12 * Z,
        rawZ: Z
      };
    }

    const points = xs.map((x, i) => toScreen(x, ys[i], zs[i]));
    return {
      points,
      axisPoints: { origin: zBase, xEnd, yEnd, zEnd },
      axisRanges: { xmin, xmax, ymin, ymax, zmin, zmax },
      projectIndex(i) { return this.points[i]; }
    };
  }

  function draw3DAxesTripod(ctx, scene, scale, labels) {
    const { origin, xEnd, yEnd, zEnd } = scene.axisPoints;
    const r = scene.axisRanges;

    function drawLineWithArrow(p1, p2) {
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = Math.max(2.0, 2.4 * scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const ah = Math.max(9, 10 * scale);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - ux * ah + px * ah * 0.45, p2.y - uy * ah + py * ah * 0.45);
      ctx.lineTo(p2.x - ux * ah - px * ah * 0.45, p2.y - uy * ah - py * ah * 0.45);
      ctx.closePath();
      ctx.fillStyle = "#111827";
      ctx.fill();
    }

    function labelAlongAxis(text, p1, p2, along = 0.55, normalSign = 1, offset = 34, rotate = false) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const px = (-dy / len) * normalSign;
      const py = (dx / len) * normalSign;
      ctx.save();
      ctx.fillStyle = "#111827";
      ctx.font = `700 ${Math.max(14, Math.round(15 * scale))}px Inter, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(p1.x + dx * along + px * offset * scale, p1.y + dy * along + py * offset * scale);
      if (rotate) ctx.rotate(Math.atan2(dy,dx));
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    function tickLabel(text, x, y, align = "center", baseline = "middle") {
      ctx.save();
      ctx.fillStyle = "#475569";
      ctx.font = `600 ${Math.max(12, Math.round(13 * scale))}px Inter, Arial, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    ctx.save();
    drawLineWithArrow(origin, zEnd);
    drawLineWithArrow(origin, xEnd);
    drawLineWithArrow(xEnd, yEnd);

    // Axis titles are deliberately farther away from tick numbers.
    labelAlongAxis(labels.zLabel, origin, zEnd, 0.55, -1, 46);
    labelAlongAxis(labels.xLabel, origin, xEnd, 0.50, 1, 44);
    labelAlongAxis(labels.yLabel, xEnd, yEnd, 0.58, 1, 66, true);

    // Tick labels are offset away from axes and axis titles.
    tickLabel(formatTick(r.zmin), origin.x - 20 * scale, origin.y + 8 * scale, "right", "middle");
    tickLabel(formatTick(r.zmax), zEnd.x - 20 * scale, zEnd.y - 4 * scale, "right", "middle");
    tickLabel(formatTick(r.xmin), origin.x, origin.y + 30 * scale, "center", "top");
    tickLabel(formatTick(r.xmax), xEnd.x, xEnd.y + 30 * scale, "center", "top");
    tickLabel(formatTick(r.ymin), xEnd.x + 18 * scale, xEnd.y + 20 * scale, "left", "top");
    tickLabel(formatTick(r.ymax), yEnd.x + 20 * scale, yEnd.y - 4 * scale, "left", "middle");
    ctx.restore();
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

  function getFrameScale(cfg) {
    return Math.max(cfg.width / 640, cfg.height / 420);
  }

  function getFrameConfig() {
    const raw = safeText(elExportResolution && elExportResolution.value) || "1280x840";
    const match = raw.match(/^(\d+)x(\d+)$/i);
    if (!match) return { width: 1280, height: 840 };
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }

  function getFrameAnnotationConfig(current) {
    const titleOverride = safeText(elFrameTitle && elFrameTitle.value);
    const xOverride = safeText(elFrameXLabel && elFrameXLabel.value);
    const yOverride = safeText(elFrameYLabel && elFrameYLabel.value);
    const zOverride = safeText(elFrameZLabel && elFrameZLabel.value);
    const timeOverride = safeText(elFrameTimeLabel && elFrameTimeLabel.value);

    if (current.mapType === "time") {
      const defaultTitle = current.frameDim === "2d"
        ? `${current.yCol} vs ${current.xCol}`
        : (current.useTimeAxis
          ? `${current.xCol}, ${current.yCol}, ${current.tCol}`
          : `${current.xCol}, ${current.yCol}, ${current.zCol}`);
      return {
        title: titleOverride || defaultTitle,
        xLabel: xOverride || current.xCol,
        yLabel: yOverride || current.yCol,
        zLabel: zOverride || (current.useTimeAxis ? current.tCol : current.zCol),
        timeLabel: timeOverride || current.tCol
      };
    }

    const defaultTitle = current.frameDim === "2d"
      ? `Return map: ${current.varCol}(n) vs ${current.varCol}(n+${current.lag})`
      : `Return map: ${current.varCol}(n), ${current.varCol}(n+${current.lag}), ${current.tCol}`;
    return {
      title: titleOverride || defaultTitle,
      xLabel: xOverride || `${current.varCol}(n)`,
      yLabel: yOverride || `${current.varCol}(n+${current.lag})`,
      zLabel: zOverride || current.tCol,
      timeLabel: timeOverride || current.tCol
    };
  }

  function getAxisScaleOverrides() {
    return {
      xMin: optionalFloat(elAxisXMin && elAxisXMin.value),
      xMax: optionalFloat(elAxisXMax && elAxisXMax.value),
      yMin: optionalFloat(elAxisYMin && elAxisYMin.value),
      yMax: optionalFloat(elAxisYMax && elAxisYMax.value),
      zMin: optionalFloat(elAxisZMin && elAxisZMin.value),
      zMax: optionalFloat(elAxisZMax && elAxisZMax.value)
    };
  }

  function resolveAxisRange(values, minOverride, maxOverride) {
    let [lo, hi] = getMinMax(values);
    if (Number.isFinite(minOverride)) lo = minOverride;
    if (Number.isFinite(maxOverride)) hi = maxOverride;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (lo === hi) {
      const pad = Math.abs(lo || 1) * 0.1 || 1;
      return [lo - pad, hi + pad];
    }
    if (lo > hi) return [hi, lo];
    return [lo, hi];
  }

  function drawFrameHeader(ctx, w, scale, leftText, rightText) {
    ctx.save();
    const y = Math.round(64 * scale);
    ctx.fillStyle = "#475569";
    ctx.font = `500 ${Math.max(11, Math.round(11.5 * scale))}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(leftText, Math.round(26 * scale), y);
    ctx.textAlign = "right";
    ctx.fillText(rightText, w - Math.round(26 * scale), y);
    ctx.restore();
  }

  function drawCenteredAxisLabel(ctx, text, x, y, scale) {
    ctx.save();
    ctx.fillStyle = "#111827";
    ctx.font = `600 ${Math.max(13, Math.round(13 * scale))}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawVerticalAxisLabel(ctx, text, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#111827";
    ctx.font = `600 ${Math.max(13, Math.round(13 * scale))}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function render2DTimeFrame(d, idx, cfg, labels) {
    const canvas = createCanvas(cfg);
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const scale = getFrameScale(cfg);
    const ranges = getAxisScaleOverrides();
    const pad = { l: Math.round(108 * scale), r: Math.round(48 * scale), t: Math.round(96 * scale), b: Math.round(96 * scale) };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const [xmin, xmax] = resolveAxisRange(d.x, ranges.xMin, ranges.xMax);
    const [ymin, ymax] = resolveAxisRange(d.y, ranges.yMin, ranges.yMax);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;

    drawBackground(ctx, w, h, labels.title, scale);
    drawFrameHeader(ctx, w, scale, `Sample ${Math.max(0, Math.min(idx, d.x.length - 1)) + 1}/${d.x.length}`, `${labels.timeLabel}: ${formatTick(d.t[Math.max(0, Math.min(idx, d.x.length - 1))])}`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax, scale);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, iw, ih);
    ctx.clip();

    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = Math.max(2.0, 2.2 * scale);
    ctx.beginPath();
    for (let i = 0; i < d.x.length; i++) {
      const xx = xMap(d.x[i]), yy = yMap(d.y[i]);
      if (isPathStart(d, i)) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2.8, 3.0 * scale);
    drawColoredPath(ctx,d,activeIdx,i=>({x:xMap(d.x[i]),y:yMap(d.y[i])}));

    const ps = clampInt(elPointSize.value, 4, 24, 11) * Math.max(1, 0.95 * scale);
    ctx.fillStyle = "rgba(220,38,38,0.16)";
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), Math.max(9, ps * 1.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = $("tool3PointColor").value;
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), ps * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawCenteredAxisLabel(ctx, labels.xLabel, pad.l + iw / 2, h - Math.round(34 * scale), scale);
    drawVerticalAxisLabel(ctx, labels.yLabel, Math.round(38 * scale), pad.t + ih / 2, scale);
    return canvas;
  }

  function render2DReturnFrame(d, idx, cfg, labels) {
    const canvas = createCanvas(cfg);
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const scale = getFrameScale(cfg);
    const ranges = getAxisScaleOverrides();
    const pad = { l: Math.round(108 * scale), r: Math.round(48 * scale), t: Math.round(96 * scale), b: Math.round(96 * scale) };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const [xmin, xmax] = resolveAxisRange(d.x, ranges.xMin, ranges.xMax);
    const [ymin, ymax] = resolveAxisRange(d.y, ranges.yMin, ranges.yMax);
    const xMap = (v) => pad.l + ((v - xmin) / ((xmax - xmin) || 1)) * iw;
    const yMap = (v) => pad.t + ih - ((v - ymin) / ((ymax - ymin) || 1)) * ih;
    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));

    drawBackground(ctx, w, h, labels.title, scale);
    drawFrameHeader(ctx, w, scale, `Sample ${activeIdx + 1}/${d.x.length}`, `${labels.timeLabel}: ${formatTick(d.t[activeIdx])}`);
    drawAxesAndGrid(ctx, pad, iw, ih, xmin, xmax, ymin, ymax, scale);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, iw, ih);
    ctx.clip();

    ctx.strokeStyle = "rgba(75,85,99,0.70)";
    ctx.lineWidth = Math.max(1.2, 1.4 * scale);
    ctx.setLineDash([Math.max(6, 7 * scale), Math.max(4, 4 * scale)]);
    ctx.beginPath();
    ctx.moveTo(xMap(xmin), yMap(xmin));
    ctx.lineTo(xMap(xmax), yMap(xmax));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.15;
    ctx.fillStyle = $("tool3BaseColor").value;
    for (let i = 0; i < d.x.length; i++) {
      ctx.beginPath();
      ctx.arc(xMap(d.x[i]), yMap(d.y[i]), Math.max(2, 2.2 * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2.4, 2.6 * scale);
    drawColoredPath(ctx,d,activeIdx,i=>({x:xMap(d.x[i]),y:yMap(d.y[i])}));

    const ps = clampInt(elPointSize.value, 4, 24, 11) * Math.max(1, 0.95 * scale);
    ctx.fillStyle = "rgba(220,38,38,0.16)";
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), Math.max(9, ps * 1.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = $("tool3PointColor").value;
    ctx.beginPath();
    ctx.arc(xMap(d.x[activeIdx]), yMap(d.y[activeIdx]), ps * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawCenteredAxisLabel(ctx, labels.xLabel, pad.l + iw / 2, h - Math.round(34 * scale), scale);
    drawVerticalAxisLabel(ctx, labels.yLabel, Math.round(38 * scale), pad.t + ih / 2, scale);
    return canvas;
  }

  function render3DFrame(d, idx, cfg, labels) {
    const canvas = createCanvas(cfg);
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const scale = getFrameScale(cfg);
    const ranges = getAxisScaleOverrides();
    const pad = { l: Math.round(126 * scale), r: Math.round(126 * scale), t: Math.round(104 * scale), b: Math.round(96 * scale) };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;

    drawBackground(ctx, w, h, labels.title, scale);
    const activeIdx = Math.max(0, Math.min(idx, d.x.length - 1));
    drawFrameHeader(ctx, w, scale, `Sample ${activeIdx + 1}/${d.x.length}`, `${labels.timeLabel}: ${formatTick(d.t[activeIdx])}`);
    const scene = build3DProjectionScene(d.x, d.y, d.z, iw, ih, ranges);

    ctx.save();
    ctx.translate(pad.l, pad.t);
    ctx.beginPath();
    ctx.rect(0, 0, iw, ih);
    ctx.clip();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = Math.max(2.0, 2.2 * scale);
    ctx.beginPath();
    for (let i = 0; i < d.x.length; i++) {
      const p = scene.projectIndex(i);
      if (isPathStart(d, i)) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2.7, 3.0 * scale);
    drawColoredPath(ctx,d,activeIdx,i=>scene.projectIndex(i));

    const point = scene.projectIndex(activeIdx);
    const ps = clampInt(elPointSize.value, 4, 24, 11) * Math.max(1, 0.95 * scale);
    ctx.fillStyle = "rgba(220,38,38,0.18)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(10, ps * 1.15), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = $("tool3PointColor").value;
    ctx.beginPath();
    ctx.arc(point.x, point.y, ps * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    // Axis titles and ticks belong outside the data clipping rectangle.
    ctx.save(); ctx.translate(pad.l,pad.t);
    draw3DAxesTripod(ctx, scene, scale, labels);
    ctx.restore();
    return canvas;
  }

  function isPathStart(d, i) {
    return i === 0 || (d.sourceIndices && d.sourceIndices[i] !== d.sourceIndices[i-1] + 1);
  }

  function buildFrameConfig() {
    return getFrameConfig();
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
    const error = axisValidation() || colorValidation();
    if (error) throw new Error(error);
    const nFramesInput = clampInt(elFrames.value, 8, 120, 40);
    const current = getCurrentSpec();
    const labels = getFrameAnnotationConfig(current);
    let frameIndices = [];
    let drawFrame = null;
    let outName = "plot_frames.zip";

    if (current.x.length < 2) throw new Error("Need at least two valid points for frame export.");

    frameIndices = buildFrameIndices(current.x.length, Math.min(nFramesInput, current.x.length));

    if (current.mapType === "time") {
      if (current.frameDim === "2d") {
        drawFrame = (idx) => render2DTimeFrame(current, idx, cfg, labels);
        outName = `${current.xCol.replace(/[^\w.-]+/g, "_")}_${current.yCol.replace(/[^\w.-]+/g, "_")}_time_map_frames.zip`;
      } else {
        const zLabel = current.useTimeAxis ? current.tCol : current.zCol;
        const title = current.useTimeAxis
          ? `${current.xCol}, ${current.yCol}, ${current.tCol}`
          : `${current.xCol}, ${current.yCol}, ${current.zCol}`;
        drawFrame = (idx) => render3DFrame(current, idx, cfg, labels);
        outName = current.useTimeAxis
          ? `${current.xCol.replace(/[^\w.-]+/g, "_")}_${current.yCol.replace(/[^\w.-]+/g, "_")}_time_axis_frames.zip`
          : `${current.xCol.replace(/[^\w.-]+/g, "_")}_${current.yCol.replace(/[^\w.-]+/g, "_")}_${current.zCol.replace(/[^\w.-]+/g, "_")}_time_ordered_frames.zip`;
      }
    } else {
      if (current.frameDim === "2d") {
        drawFrame = (idx) => render2DReturnFrame(current, idx, cfg, labels);
        outName = `${current.varCol.replace(/[^\w.-]+/g, "_")}_return_map_lag${current.lag}_frames.zip`;
      } else {
        drawFrame = (idx) => render3DFrame(current, idx, cfg, labels);
        outName = `${current.varCol.replace(/[^\w.-]+/g, "_")}_return_map_3d_lag${current.lag}_frames.zip`;
      }
    }

    return { cfg, frameIndices, drawFrame, outName, labels };
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode PNG frame.")), "image/png");
    });
  }

  async function downloadFramesZip() {
    if (state.job) return;
    if (!window.JSZip) { setFramesStatus("ZIP support could not load. Reload with an internet connection. Direct GIF creation is still available."); return; }
    const job = startJob("zip");
    revokeFrameZipUrl(); setFramesZipDownloadEnabled(false);
    try {
      const spec = collectAnimationSpec(), zip = new JSZip();
      for (let i=0;i<spec.frameIndices.length;i++) {
        assertRunning(job);
        const canvas = spec.drawFrame(spec.frameIndices[i]);
        zip.file(`frame_${String(i+1).padStart(3,"0")}.png`,await canvasToPngBlob(canvas));
        canvas.width = canvas.height = 0;
        progress(job,(i+1)/spec.frameIndices.length*85,`Rendering PNG frame ${i+1} of ${spec.frameIndices.length}…`);
        await yieldToUi();
      }
      const blob = await zip.generateAsync({type:"blob"},meta=>progress(job,85+meta.percent*.15,"Preparing frame ZIP…"));
      assertRunning(job);
      state.frameZipUrl = URL.createObjectURL(blob);
      setFramesZipDownloadEnabled(true,state.frameZipUrl,spec.outName);
      progress(job,100,`Frame ZIP ready · ${spec.frameIndices.length} frames · ${spec.cfg.width} × ${spec.cfg.height}.`);
    } catch(error) { reportJobError(job,error); }
    finally { finishJob(job); }
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

  function setDirectStatus(message) { if (elDirectStatus) elDirectStatus.textContent = message; }
  function showPane(kind) {
    const gif = kind === "gif" && !!state.directGifUrl;
    $("tool3PlotPane").classList.toggle("tool3-hidden",gif);
    $("tool3GifPane").classList.toggle("tool3-hidden",!gif);
    for (const [id,on] of [["tool3PlotTab",!gif],["tool3GifTab",gif]]) {
      $(id).classList.toggle("active",on); $(id).setAttribute("aria-selected",String(on));
    }
    $("tool3PreviewTag").textContent = gif ? "Generated GIF" : state.previewMode === "interactive" ? "Interactive" : "Export view";
    if (!gif && state.previewMode === "interactive" && window.Plotly) requestAnimationFrame(()=>Plotly.Plots.resize(elPlot));
  }

  function invalidateOutputs() {
    revokeObjectUrl("directGifUrl"); revokeFrameZipUrl(); revokeMergeGifUrl();
    setDownloadLink(elGifDownload,false); setFramesZipDownloadEnabled(false); setMergeGifDownloadEnabled(false);
    $("tool3GifTab").disabled = true;
    elGifPreview.textContent = "Create a GIF to preview it here.";
    showPane("plot");
    setDirectStatus(state.rows.length ? "Ready. Choose Create GIF to render and encode your animation." : "Load data to enable GIF creation.");
  }

  function updateAvailability() {
    const busy = !!state.job, loaded = state.rows.length > 0;
    $("tool3MapFields").disabled = !loaded || busy;
    $("tool3ExportFields").disabled = !loaded || busy;
    elFile.disabled = busy; elExample.disabled = busy;
    elSheet.disabled = !loaded || busy; elTimeCol.disabled = !loaded || busy;
    let points = 0;
    if (loaded && !axisValidation() && !colorValidation()) { try { points = getCurrentSpec().x.length; } catch(e) {} }
    elCreateGif.disabled = busy || points < 2;
    elFramesZipBtn.disabled = busy || points < 2;
    elMergeGifBtn.disabled = busy || !elMergeZipFile.files.length;
    elMergeZipFile.disabled = busy; elMergeFps.disabled = busy;
    elCancel.classList.toggle("tool3-hidden",!busy);
    elCreateGif.textContent = busy && state.job.kind === "gif" ? "Creating GIF…" : "Create GIF";
    if (loaded && points<2 && !busy && !axisValidation() && !colorValidation()) setDirectStatus("At least two numeric points are needed. Check your columns, lag, or axis limits.");
    const frames = Math.min(points || 40,clampInt(elFrames.value,8,120,40));
    const fps = clampInt(elFps.value,1,20,8);
    $("tool3Timing").textContent = `${frames} frames · about ${(frames/fps).toFixed(1)} seconds at ${fps} FPS.`;
  }

  function startJob(kind) {
    const job = {kind,cancelled:false,encoder:null};
    state.job = job;
    elProgress.classList.remove("tool3-hidden"); elProgress.value = 0;
    updateAvailability(); return job;
  }
  function assertRunning(job) { if (job.cancelled || state.job !== job) throw new DOMException("Export cancelled.","AbortError"); }
  function progress(job,percent,message) {
    if (job.cancelled) return;
    elProgress.value = Math.round(percent);
    if (job.kind === "zip") setFramesStatus(message);
    else if (job.kind === "merge") setMergeStatus(message);
    else setDirectStatus(message);
  }
  function reportJobError(job,error) {
    const message = job.cancelled || error.name === "AbortError" ? "Export cancelled. Your data and settings are kept." : error.message || "Could not create the export. Try a smaller resolution.";
    progress({...job,cancelled:false},0,message);
  }
  function finishJob(job) {
    if (job.encoder) job.encoder.close();
    if (state.job === job) state.job = null;
    elProgress.classList.add("tool3-hidden"); updateAvailability();
  }

  async function createEncodingClient(width,height) {
    let worker,sequence=0;
    const pending = new Map();
    const close = () => {
      if (worker) worker.terminate();
      for (const item of pending.values()) item.reject(new DOMException("Export cancelled.","AbortError"));
      pending.clear();
    };
    try {
      worker = new Worker(new URL("tool3-gif-worker.js",document.querySelector('script[src*="assets/js/tool3.js"]').src));
      worker.onmessage = ({data}) => {
        const item = pending.get(data.id); if (!item) return;
        pending.delete(data.id);
        if (data.error) item.reject(new Error(data.error)); else item.resolve(data);
      };
      worker.onerror = e => { e.preventDefault(); for (const item of pending.values()) item.reject(new Error("Background encoder unavailable.")); pending.clear(); };
      const request = (type,data={},transfer=[]) => new Promise((resolve,reject)=>{
        const id = ++sequence; pending.set(id,{resolve,reject});
        worker.postMessage({id,type,...data},transfer);
      });
      let timeout;
      await Promise.race([request("init",{width,height}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("Encoder unavailable.")),3000);})]).finally(()=>clearTimeout(timeout));
      return {
        addFrame: (rgba,delayCs)=>request("frame",{rgba:rgba.buffer,delayCs},[rgba.buffer]),
        finish: async()=>new Uint8Array((await request("finish")).bytes),
        close
      };
    } catch(error) {
      close();
      if (!window.Tool3GifEncoder) throw new Error("The GIF encoder could not load. Reload the page and try again.");
      const encoder = Tool3GifEncoder.createEncoder(width,height);
      return {addFrame:async(rgba,delayCs)=>{await yieldToUi();encoder.addFrame(rgba,delayCs);},finish:async()=>encoder.finish(),close:()=>{}};
    }
  }

  function frameDelay(index,fps) {
    // Distribute GIF centisecond rounding, so 8 FPS alternates 12/13 cs.
    return Math.round((index+1)*100/fps)-Math.round(index*100/fps);
  }

  async function createGif() {
    if (state.job) return;
    const job = startJob("gif");
    revokeObjectUrl("directGifUrl"); setDownloadLink(elGifDownload,false); $("tool3GifTab").disabled = true;
    try {
      const spec = collectAnimationSpec(), fps = clampInt(elFps.value,1,20,8);
      const encoder = job.encoder = await createEncodingClient(spec.cfg.width,spec.cfg.height);
      assertRunning(job);
      for (let i=0;i<spec.frameIndices.length;i++) {
        assertRunning(job);
        const canvas = spec.drawFrame(spec.frameIndices[i]);
        const rgba = canvas.getContext("2d").getImageData(0,0,spec.cfg.width,spec.cfg.height).data;
        canvas.width = canvas.height = 0;
        await encoder.addFrame(rgba,frameDelay(i,fps));
        progress(job,(i+1)/spec.frameIndices.length*98,`Creating GIF · frame ${i+1} of ${spec.frameIndices.length}…`);
        await yieldToUi();
      }
      assertRunning(job);
      const blob = new Blob([await encoder.finish()],{type:"image/gif"});
      assertRunning(job);
      state.directGifUrl = URL.createObjectURL(blob);
      const image = new Image(); image.alt = `${spec.labels.title} — animated time-series plot`; image.src = state.directGifUrl;
      elGifPreview.replaceChildren(image);
      const filename = spec.outName.replace(/_frames\.zip$/,".gif");
      setDownloadLink(elGifDownload,true,state.directGifUrl,filename);
      $("tool3GifTab").disabled = false;
      const info = `${spec.frameIndices.length} frames · ${fps} FPS · ${spec.cfg.width} × ${spec.cfg.height} · ${(blob.size/1048576).toFixed(2)} MB`;
      elGifMeta.textContent = info;
      progress(job,100,`GIF ready. ${info}`);
      showPane("gif");
    } catch(error) { reportJobError(job,error); }
    finally { finishJob(job); }
  }

  async function mergeFramesZipToGif() {
    if (state.job) return;
    const file = elMergeZipFile.files[0];
    if (!file || !window.JSZip) { setMergeStatus("Choose a frame ZIP. ZIP support also needs an internet connection on first load."); return; }
    const job = startJob("merge");
    revokeMergeGifUrl(); setMergeGifDownloadEnabled(false);
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(f=>!f.dir && !f.name.startsWith("__MACOSX/") && !f.name.split("/").pop().startsWith(".") && /\.(png|jpe?g|webp)$/i.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
      if (!entries.length) throw new Error("No image frames found in this ZIP.");
      if (entries.length>500) throw new Error("Use a ZIP with 500 image frames or fewer.");
      const fps = clampInt(elMergeFps.value,1,20,8);
      let width=0,height=0;
      for (let i=0;i<entries.length;i++) {
        assertRunning(job);
        const image = await blobToImage(await entries[i].async("blob"));
        if (!width) { width = image.naturalWidth; height = image.naturalHeight; job.encoder = await createEncodingClient(width,height); }
        if (width!==image.naturalWidth || height!==image.naturalHeight) throw new Error("All frame images must have the same dimensions.");
        const canvas = createCanvas({width,height}), ctx = canvas.getContext("2d");
        ctx.drawImage(image,0,0);
        await job.encoder.addFrame(ctx.getImageData(0,0,width,height).data,frameDelay(i,fps));
        canvas.width=canvas.height=0;
        progress(job,(i+1)/entries.length*98,`Converting ZIP · frame ${i+1} of ${entries.length}…`);
        await yieldToUi();
      }
      assertRunning(job);
      const blob = new Blob([await job.encoder.finish()],{type:"image/gif"}); assertRunning(job);
      state.mergeGifUrl = URL.createObjectURL(blob);
      setMergeGifDownloadEnabled(true,state.mergeGifUrl,"merged_frames.gif");
      const image = new Image(); image.alt = "GIF from image frames"; image.src = state.mergeGifUrl;
      elMergePreview.replaceChildren(image); elMergePreview.classList.remove("tool3-hidden");
      progress(job,100,`Merged GIF ready · ${entries.length} frames · ${fps} FPS · ${width} × ${height}.`);
    } catch(error) { reportJobError(job,error); }
    finally { finishJob(job); }
  }

  const validColor = value => /^#[0-9a-f]{6}$/i.test(value);
  function colorValidation() {
    for (const [i,r] of state.colorRules.entries()) {
      if (!validColor(r.color)) return `Color rule ${i+1}: use a six-digit hex color.`;
      if ((r.kind==="time" || r.kind==="samples") && (!Number.isFinite(r.start) || !Number.isFinite(r.end) || r.start>r.end)) return `Color rule ${i+1}: start must not exceed end.`;
      if (r.kind==="samples" && (r.start<1 || !Number.isInteger(r.start) || !Number.isInteger(r.end))) return `Color rule ${i+1}: use whole sample numbers starting at 1.`;
      if ((r.kind==="label" || r.kind==="branch") && !state.headers.includes(r.column)) return `Color rule ${i+1}: choose a column from the selected sheet.`;
      if (r.kind==="branch" && !state.numericHeaders.includes(r.column)) return `Color rule ${i+1}: the potential column must be numeric.`;
      if (r.kind==="cycle" && (!(r.period>0) || !Number.isFinite(r.origin) || !Number.isInteger(r.cycleStart) || !Number.isInteger(r.cycleEnd) || r.cycleStart<1 || r.cycleEnd<r.cycleStart)) return `Color rule ${i+1}: set a positive period and valid cycle numbers.`;
    }
    return "";
  }
  function ruleMatches(r,d,i) {
    if (r.kind==="time") return d.t[i]>=r.start && d.t[i]<=r.end;
    if (r.kind==="samples") {const n=(d.sourceIndices?.[i]??i)+1;return n>=r.start && n<=r.end;}
    if (r.kind==="label") return safeText(d.rows[i]?.[r.column])===safeText(r.value);
    if (r.kind==="cycle") {const cycle=Math.floor((d.t[i]-r.origin)/r.period+1e-10)+1;return cycle>=r.cycleStart && cycle<=r.cycleEnd;}
    if (r.kind==="branch") {
      const direction=d.branchDirections[r.column]?.[i]||0,value=num(d.rows[i]?.[r.column]);
      return direction===(r.direction.startsWith("rising")?1:-1) && (!r.direction.endsWith("pos") || value>=0) && (!r.direction.endsWith("neg") || value<=0);
    }
    return false;
  }
  function curveColor(d,i) {
    for (let k=state.colorRules.length-1;k>=0;k--) if (ruleMatches(state.colorRules[k],d,i)) return state.colorRules[k].color;
    return $("tool3BaseColor").value;
  }
  function drawColoredPath(ctx,d,last,project) {
    let previousColor=null;
    ctx.beginPath();
    for (let i=1;i<=last;i++) {
      if (isPathStart(d,i)) {ctx.stroke();ctx.beginPath();previousColor=null;continue;}
      const color=curveColor(d,i), a=project(i-1),b=project(i);
      if (color!==previousColor) {ctx.stroke();ctx.beginPath();ctx.strokeStyle=color;ctx.moveTo(a.x,a.y);}
      ctx.lineTo(b.x,b.y);previousColor=color;
    }
    ctx.stroke();
  }
  function applyInteractiveColors(traces,d) {
    const result=[];
    for (const trace of traces) {
      if (trace.name==="Current point") {trace.marker={...trace.marker,color:$("tool3PointColor").value};result.push(trace);continue;}
      if (!trace.mode?.includes("lines") || trace.name==="y=x") {result.push(trace);continue;}
      if (!state.colorRules.length) {trace.line={...trace.line,color:$("tool3BaseColor").value};if(trace.marker)trace.marker.color=$("tool3BaseColor").value;result.push(trace);continue;}
      const groups=new Map();
      for(let i=1;i<d.x.length;i++) {
        if(isPathStart(d,i))continue;
        const color=curveColor(d,i);
        if(!groups.has(color))groups.set(color,{...trace,x:[],y:[],...(d.frameDim==="3d"?{z:[]}:{}),mode:"lines",line:{...trace.line,color},name:state.colorRules.find(r=>r.color===color)?.label||"Curve",connectgaps:false});
        const group=groups.get(color);
        for(const axis of ["x","y",...(d.frameDim==="3d"?["z"]:[])]) group[axis].push(d[axis][i-1],d[axis][i],null);
      }
      result.push(...groups.values());
    }
    traces.splice(0,traces.length,...result);
  }
  function renderColorLegend() {
    const entries=[{label:"Default curve",color:$("tool3BaseColor").value},...state.colorRules];
    $("tool3ColorLegend").innerHTML=entries.map(r=>`<span><i style="background:${validColor(r.color)?r.color:"#30648a"}"></i>${escapeHtml(r.label)}</span>`).join("");
  }
  function renderColorRules() {
    const options=(values,current)=>values.map(v=>`<option value="${escapeHtml(v)}" ${v===current?"selected":""}>${escapeHtml(v)}</option>`).join("");
    const input=(key,label,value,step="any")=>`<label class="tool3-label"><span>${label}</span><input type="number" step="${step}" data-key="${key}" value="${value}" aria-label="${label}"></label>`;
    $("tool3ColorRules").innerHTML=state.colorRules.map((r,i)=>{
      let fields="";
      if(r.kind==="time" || r.kind==="samples")fields=`<div class="tool3-grid-2">${input("start",r.kind==="time"?"Start time":"First sample",r.start,r.kind==="samples"?"1":"any")}${input("end",r.kind==="time"?"End time":"Last sample",r.end,r.kind==="samples"?"1":"any")}</div>`;
      if(r.kind==="label")fields=`<div class="tool3-grid-2"><label class="tool3-label"><span>Cycle / label column</span><select data-key="column">${options(state.headers,r.column)}</select></label><label class="tool3-label"><span>Matching value</span><input type="text" data-key="value" value="${escapeHtml(r.value)}"></label></div>`;
      if(r.kind==="cycle")fields=`<div class="tool3-grid-2">${input("period","Cycle duration",r.period)}${input("origin","Cycle 1 start time",r.origin)}${input("cycleStart","First cycle",r.cycleStart,"1")}${input("cycleEnd","Last cycle",r.cycleEnd,"1")}</div><p class="tool3-note">Duration and start use the selected time column’s units.</p>`;
      if(r.kind==="branch")fields=`<label class="tool3-label"><span>Potential column</span><select data-key="column">${options(state.numericHeaders,r.column)}</select></label><label class="tool3-label"><span>Branch</span><select data-key="direction">${[["rising","Rising potential"],["falling","Falling potential"],["rising-pos","Rising, E ≥ 0"],["rising-neg","Rising, E ≤ 0"],["falling-pos","Falling, E ≥ 0"],["falling-neg","Falling, E ≤ 0"]].map(([v,t])=>`<option value="${v}" ${r.direction===v?"selected":""}>${t}</option>`).join("")}</select></label>`;
      return `<div class="tool3-color-rule" data-rule="${r.id}"><div class="tool3-rule-head"><strong>Color rule ${i+1}</strong><button class="btn tiny rule-remove" type="button" aria-label="Remove color rule ${i+1}">Remove</button></div><label class="tool3-label"><span>Apply to</span><select data-key="kind">${[["time","Time interval"],["samples","Sample range"],["label","Cycle / label column"],["cycle","Cycle number · fixed period"],["branch","CV branch"]].map(([v,t])=>`<option value="${v}" ${v===r.kind?"selected":""}>${t}</option>`).join("")}</select></label>${fields}<div class="tool3-grid-2"><label class="tool3-label"><span>Label</span><input data-key="label" type="text" value="${escapeHtml(r.label)}"></label><label class="tool3-label"><span>Color</span><span class="tool3-color-pair"><input class="rule-color-picker" type="color" value="${r.color}" aria-label="Pick rule ${i+1} color"><input data-key="color" type="text" value="${r.color}" maxlength="7" spellcheck="false" aria-label="Rule ${i+1} color hex"></span></label></div></div>`;
    }).join("");
    $("tool3ColorRules").querySelectorAll("[data-rule]").forEach(row=>{
      const rule=state.colorRules.find(r=>r.id===row.dataset.rule);
      row.querySelector(".rule-remove").addEventListener("click",()=>{state.colorRules=state.colorRules.filter(r=>r!==rule);renderColorRules();settingsChanged();});
      row.querySelectorAll("[data-key]").forEach(field=>{
        const event=field.tagName==="SELECT"?"change":"input";
        field.addEventListener(event,()=>{
          const key=field.dataset.key;
          if(key==="color" && !validColor(field.value))return;
          rule[key]=field.type==="number"?(field.value===""?NaN:Number(field.value)):field.value;
          if(key==="kind") {
            if(rule.kind==="branch")rule.column=state.numericHeaders.find(h=>/potential|voltage|^Vf$|^E(?:$|\s|\()/i.test(h))||elY.value;
            if(rule.kind==="label")rule.column=state.headers.find(h=>/cycle|branch/i.test(h))||state.headers[0];
            renderColorRules();
          }
          if(key==="color")row.querySelector(".rule-color-picker").value=rule.color;
          clearTimeout(previewTimer);previewTimer=setTimeout(()=>settingsChanged(),140);
        });
      });
      row.querySelector(".rule-color-picker").addEventListener("input",e=>{rule.color=e.target.value;row.querySelector('[data-key="color"]').value=rule.color;settingsChanged();});
    });
  }
  $("tool3AddColor").addEventListener("click",()=>{
    if(state.colorRules.length>=12){setDirectStatus("Use up to 12 color rules.");return;}
    const times=getCurrentSpec().t,n=state.colorRules.length+1;
    const start=times[0]||0,end=times.length?times[times.length-1]:1;
    state.colorRules.push({id:Date.now()+"_"+n,kind:"time",start,end,label:`Period ${n}`,color:["#922b3e","#458275","#b38641","#716091"][state.colorRules.length%4],column:state.headers.find(h=>/cycle/i.test(h))||state.headers[0],value:"1",period:1,origin:start,cycleStart:1,cycleEnd:1,direction:"rising"});
    renderColorRules();settingsChanged();
  });
  for(const [pickerId,hexId] of [["tool3BaseColor","tool3BaseHex"],["tool3PointColor","tool3PointHex"]]) {
    const picker=$(pickerId),hex=$(hexId);
    picker.addEventListener("input",()=>{hex.value=picker.value;settingsChanged();});
    hex.addEventListener("input",()=>{if(validColor(hex.value)){picker.value=hex.value;settingsChanged();}});
  }

  function settingsChanged(render = true) {
    if (state.job) return;
    invalidateOutputs(); updatePanels(); updateAvailability();
    if (render) renderCurrentPlot();
  }
  elFile.addEventListener("change",async e=>{
    const file = e.target.files[0]; if (!file) return;
    state.dataRevision++; invalidateOutputs();
    setLoadStatus(`Reading ${file.name}…`);
    try { await loadWorkbookFromFile(file); }
    catch(error) { setLoadStatus(error.message || "Could not read this file."); }
    updateAvailability();
  });
  elExample.addEventListener("click",async()=>{
    elExample.disabled = true; setLoadStatus("Loading example…");
    try {
      const response = await fetch("assets/data/toolkit3_example.json");
      if (!response.ok) throw new Error("Could not load the example. Try downloading the example Excel.");
      const data = await response.json();
      state.dataRevision++; invalidateOutputs();
      useWorkbook({SheetNames:["Example_Data"],Sheets:{Example_Data:{matrix:data.Example_Data}}},"Synthetic example data");
    } catch(error) { setLoadStatus(error.message); }
    finally { updateAvailability(); }
  });
  elSheet.addEventListener("change",()=>{state.dataRevision++;parseSheet(elSheet.value);refreshControls();settingsChanged();});
  [elTimeCol,elFrameDim,elMapType,elUseTimeAxis,elX,elY,elZ,elReturnVar].forEach(el=>el.addEventListener("change",()=>{
    refreshControls();
    if ((el===elFrameDim || el===elUseTimeAxis) && elFrameDim.value==="3d" && elUseTimeAxis.value==="yes" && elX.value===elTimeCol.value) {
      const signals = getVariableOptions().filter(v=>v!==elTimeCol.value);
      if (signals.length>=2) {elX.value=signals[0];elY.value=signals[1];}
    }
    settingsChanged();
  }));
  let previewTimer;
  [elLag,elPointSize,elAxisXMin,elAxisXMax,elAxisYMin,elAxisYMax,elAxisZMin,elAxisZMax,elFrameTitle,elFrameXLabel,elFrameYLabel,elFrameZLabel,elFrameTimeLabel].forEach(el=>{
    el.addEventListener("input",()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>settingsChanged(),140);});
    el.addEventListener("change",()=>{clearTimeout(previewTimer);settingsChanged();});
  });
  [elFrames,elFps,elExportResolution].forEach(el=>el.addEventListener("input",()=>settingsChanged(false)));
  $("tool3ResetAxes").addEventListener("click",()=>{[elAxisXMin,elAxisXMax,elAxisYMin,elAxisYMax,elAxisZMin,elAxisZMax].forEach(el=>{el.value="";el.removeAttribute("aria-invalid");});settingsChanged();});
  elCreateGif.addEventListener("click",()=>{clearTimeout(previewTimer);createGif();});
  elCancel.addEventListener("click",()=>{
    const job = state.job; if (!job) return;
    job.cancelled=true;
    if (job.encoder) job.encoder.close();
    elCancel.disabled=true; elCancel.textContent="Cancelling…";
    setTimeout(()=>{elCancel.disabled=false;elCancel.textContent="Cancel";},0);
  });
  elFramesZipBtn.addEventListener("click",downloadFramesZip);
  elMergeGifBtn.addEventListener("click",mergeFramesZipToGif);
  elMergeZipFile.addEventListener("change",updateAvailability);
  $("tool3PlotTab").addEventListener("click",()=>showPane("plot"));
  $("tool3GifTab").addEventListener("click",()=>showPane("gif"));
  [$("tool3PlotTab"),$("tool3GifTab")].forEach(tab=>tab.addEventListener("keydown",e=>{
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
    e.preventDefault();
    const gif = (e.key==="End" || e.key==="ArrowRight") && !$("tool3GifTab").disabled;
    showPane(gif?"gif":"plot"); $(gif?"tool3GifTab":"tool3PlotTab").focus();
  }));
  elInteractiveToggle.addEventListener("click",()=>{
    if (!window.Plotly) {setMeta("Interactive plotting could not load. The export preview and GIF creation work without it.");return;}
    if (state.previewMode === "export" && elFrameDim.value === "3d" && !supportsWebGL()) {
      setMeta("Interactive 3D is unavailable in this browser. The export preview and GIF creation work normally."); return;
    }
    state.previewMode = state.previewMode==="export" ? "interactive" : "export";
    elInteractiveToggle.textContent = state.previewMode==="export" ? "Interactive view" : "Export view";
    showPane("plot"); renderCurrentPlot();
  });
  window.addEventListener("beforeunload",()=>{["directGifUrl","frameZipUrl","mergeGifUrl"].forEach(revokeObjectUrl);if(state.job?.encoder)state.job.encoder.close();});
  state.previewRevision=0;
  setFramesZipDownloadEnabled(false);setMergeGifDownloadEnabled(false);setDownloadLink(elGifDownload,false);
  showPane("plot");renderPreviewTable();updatePanels();renderCurrentPlot();
})();
