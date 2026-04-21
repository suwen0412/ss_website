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
  const elFrames = $("tool3Frames");
  const elFps = $("tool3Fps");
  const elGifQuality = $("tool3GifQuality");
  const elPointSize = $("tool3PointSize");
  const elMakeGif = $("tool3MakeGif");
  const elGifDownload = $("tool3GifDownload");
  const elGifStatus = $("tool3GifStatus");
  const elGifPreview = $("tool3GifPreview");
  const elGifCard = $("tool3GifCard");

  const elLoadStatus = $("tool3LoadStatus");
  const elSummary = $("tool3Summary");
  const elPlot = $("tool3Plot");
  const elMeta = $("tool3Meta");

  if (!elFile || !elSheet || !elPlotType || !elPlot) return;

  const state = {
    workbook: null,
    fileName: "",
    sheetName: "",
    headers: [],
    rows: [],
    numericHeaders: [],
    gifUrl: "",
    currentTrajectory: null
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

  function setLoadStatus(msg) {
    if (elLoadStatus) elLoadStatus.textContent = msg;
  }

  function setGifStatus(msg) {
    if (elGifStatus) elGifStatus.textContent = msg;
  }

  function setMeta(msg) {
    if (elMeta) elMeta.textContent = msg;
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
      selectEl.innerHTML = `<option value="">No columns available</option>`;
      return;
    }
    selectEl.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if (preferred && values.includes(preferred)) {
      selectEl.value = preferred;
    } else if (!values.includes(selectEl.value)) {
      selectEl.value = values[0];
    }
  }

  function parseSheet(name) {
    if (!state.workbook || !name) return;

    const ws = state.workbook.Sheets[name];
    if (!ws) return;

    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!matrix.length) {
      state.sheetName = name;
      state.headers = [];
      state.rows = [];
      state.numericHeaders = [];
      return;
    }

    const headers = uniqueHeaders(matrix[0]);
    const rows = matrix
      .slice(1)
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i]; });
        return obj;
      })
      .filter((obj) => Object.values(obj).some((v) => safeText(v) !== ""));

    const numericHeaders = headers.filter((h) => {
      let valid = 0;
      let numeric = 0;
      for (const row of rows) {
        const raw = row[h];
        if (safeText(raw) === "") continue;
        valid += 1;
        if (Number.isFinite(num(raw))) numeric += 1;
      }
      return valid > 0 && numeric / valid >= 0.7;
    });

    state.sheetName = name;
    state.headers = headers;
    state.rows = rows;
    state.numericHeaders = numericHeaders;
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
        : "No usable rows were found in this sheet."
    );
  }

  function getSeries(header) {
    return state.rows.map((row, idx) => ({
      raw: row[header],
      num: num(row[header]),
      index: idx
    }));
  }

  function getShiftData() {
    const tCol = elTimeShift.value;
    const yCol = elShiftVar.value;
    const skip = clampInt(elSkip.value, 1, 100000, 1);

    const tSeries = getSeries(tCol);
    const ySeries = getSeries(yCol);
    const n = Math.max(0, ySeries.length - skip);

    const t = [];
    const yn = [];
    const ynp = [];

    for (let i = 0; i < n; i++) {
      const y0 = ySeries[i].num;
      const y1 = ySeries[i + skip].num;
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
      t.push(tSeries[i].raw === "" ? i : tSeries[i].raw);
      yn.push(y0);
      ynp.push(y1);
    }

    return { tCol, yCol, skip, t, yn, ynp };
  }

  function getTrajectoryData() {
    const mode = elMode.value;
    const xCol = elX.value;
    const yCol = elY.value;
    const zCol = elZ.value;
    const tCol = elTimeTraj.value;

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

  function getGifModeConfig() {
    const mode = (elGifQuality && elGifQuality.value === "high") ? "high" : "fast";
    if (mode === "high") {
      return {
        mode,
        width: 760,
        height: 500,
        maxFrames: 80,
        defaultFrames: 30,
        defaultFps: 8,
        quality: 7,
        workers: 2
      };
    }
    return {
      mode,
      width: 560,
      height: 360,
      maxFrames: 60,
      defaultFrames: 18,
      defaultFps: 6,
      quality: 10,
      workers: 2
    };
  }

  function syncGifInputsToMode() {
    if (!elFrames || !elFps) return;
    const cfg = getGifModeConfig();
    elFrames.max = String(cfg.maxFrames);
    if (!elFrames.dataset.userEdited) elFrames.value = String(cfg.defaultFrames);
    if (!elFps.dataset.userEdited) elFps.value = String(cfg.defaultFps);
  }

  function build3DScene(xTitle, yTitle, zTitle) {
    return {
      xaxis: { title: xTitle, automargin: true },
      yaxis: { title: yTitle, automargin: true },
      zaxis: { title: zTitle, automargin: true },
      aspectmode: "data",
      dragmode: "turntable",
      camera: {
        eye: { x: 1.55, y: 1.55, z: 1.2 },
        center: { x: 0, y: 0, z: 0 }
      }
    };
  }

  function renderShiftPlot() {
    const d = getShiftData();
    const traces = [
      {
        x: d.t,
        y: d.yn,
        type: "scatter",
        mode: "lines",
        name: `${d.yCol} (n)`,
        line: { width: 3 }
      },
      {
        x: d.t,
        y: d.ynp,
        type: "scatter",
        mode: "lines",
        name: `${d.yCol} (n+${d.skip})`,
        line: { width: 3, dash: "dash" }
      }
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
    if (elSummary) {
      elSummary.textContent = "Plot type A: shifted-frame time plot. This overlays y(n) and y(n+skip) against the same time axis.";
    }
    state.currentTrajectory = null;
    hideGifOutput();
  }

  function renderTrajectoryPlot() {
    const d = getTrajectoryData();
    const pointSize = clampInt(elPointSize.value, 4, 24, 11);

    let traces, layout;
    if (d.mode === "3d") {
      traces = [
        {
          x: d.x,
          y: d.y,
          z: d.z,
          type: "scatter3d",
          mode: "lines",
          name: "Trajectory",
          line: { width: 5 }
        },
        {
          x: d.x.length ? [d.x[d.x.length - 1]] : [],
          y: d.y.length ? [d.y[d.y.length - 1]] : [],
          z: d.z.length ? [d.z[d.z.length - 1]] : [],
          type: "scatter3d",
          mode: "markers",
          name: "Current point",
          marker: { size: pointSize }
        }
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
        {
          x: d.x,
          y: d.y,
          type: "scatter",
          mode: "lines",
          name: "Trajectory",
          line: { width: 3 }
        },
        {
          x: d.x.length ? [d.x[d.x.length - 1]] : [],
          y: d.y.length ? [d.y[d.y.length - 1]] : [],
          type: "scatter",
          mode: "markers",
          name: "Current point",
          marker: { size: pointSize }
        }
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
    if (elSummary) {
      elSummary.textContent = "Plot type B: variable trajectory. Choose 2D or 3D, then optionally export a moving-point GIF.";
    }
    state.currentTrajectory = d;
    showGifCard();
  }

  function renderCurrentPlot() {
    if (!state.rows.length) {
      Plotly.react(
        elPlot,
        [],
        {
          annotations: [{
            text: "Upload a file to begin.",
            showarrow: false,
            xref: "paper",
            yref: "paper",
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: "#6b7280" }
          }],
          xaxis: { visible: false },
          yaxis: { visible: false },
          margin: { l: 0, r: 0, t: 10, b: 0 },
          paper_bgcolor: "#fff",
          plot_bgcolor: "#fff"
        },
        { responsive: true, displaylogo: false }
      );
      setMeta("Load a file to preview your plot here.");
      return;
    }

    if (elPlotType.value === "shift") {
      renderShiftPlot();
    } else {
      renderTrajectoryPlot();
    }
  }

  function updatePanels() {
    const isShift = elPlotType.value === "shift";
    elShiftPanel.classList.toggle("tool3-hidden", !isShift);
    elTrajPanel.classList.toggle("tool3-hidden", isShift);
    elZWrap.classList.toggle("tool3-hidden", elMode.value !== "3d");
    if (isShift) {
      hideGifOutput();
    } else {
      showGifCard();
    }
  }

  function showGifCard() {
    if (elGifCard) elGifCard.classList.remove("tool3-hidden");
  }

  function setGifDownloadEnabled(enabled, href) {
    if (!elGifDownload) return;
    if (enabled) {
      elGifDownload.href = href || "#";
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

  function hideGifOutput() {
    if (elGifCard) elGifCard.classList.add("tool3-hidden");
    setGifDownloadEnabled(false);
    setGifStatus("GIF export is available for the trajectory plot. Use “Fast” for quick export or “High quality” for smoother output.");
  }

  function revokeGifUrl() {
    if (state.gifUrl && state.gifUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.gifUrl);
    }
    state.gifUrl = "";
  }

  function dataUrlToImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function loadWorkbookFromFile(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    state.workbook = wb;
    state.fileName = file.name || "uploaded file";

    const sheets = wb.SheetNames || [];
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

    elSheet.innerHTML = sheets
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");
    elSheet.value = sheets[0];

    parseSheet(sheets[0]);
    refreshControls();
    renderCurrentPlot();
  }

  function buildFrameIndices(nPoints, nFrames) {
    if (nPoints <= 1) return [0];
    const steps = Math.max(2, nFrames);
    const out = [];
    for (let i = 0; i < steps; i++) {
      const idx = Math.round((i / (steps - 1)) * (nPoints - 1));
      out.push(idx);
    }
    return Array.from(new Set(out));
  }

  async function makeTrajectoryFrame(div, d, idx, exportSize) {
    const pointSize = clampInt(elPointSize.value, 4, 24, 11);
    let traces, layout;

    if (d.mode === "3d") {
      traces = [
        {
          x: d.x.slice(0, idx + 1),
          y: d.y.slice(0, idx + 1),
          z: d.z.slice(0, idx + 1),
          type: "scatter3d",
          mode: "lines",
          line: { width: 5 },
          name: "Trajectory"
        },
        {
          x: [d.x[idx]],
          y: [d.y[idx]],
          z: [d.z[idx]],
          type: "scatter3d",
          mode: "markers",
          marker: { size: pointSize },
          name: "Current point"
        }
      ];
      layout = {
        title: `${d.xCol}–${d.yCol}–${d.zCol} trajectory`,
        margin: { l: 10, r: 10, t: 50, b: 10 },
        scene: build3DScene(d.xCol, d.yCol, d.zCol),
        paper_bgcolor: "#fff"
      };
    } else {
      traces = [
        {
          x: d.x.slice(0, idx + 1),
          y: d.y.slice(0, idx + 1),
          type: "scatter",
          mode: "lines",
          line: { width: 3 },
          name: "Trajectory"
        },
        {
          x: [d.x[idx]],
          y: [d.y[idx]],
          type: "scatter",
          mode: "markers",
          marker: { size: pointSize },
          name: "Current point"
        }
      ];
      layout = {
        title: `${d.xCol}–${d.yCol} trajectory`,
        margin: { l: 62, r: 24, t: 50, b: 56 },
        xaxis: { title: d.xCol, automargin: true },
        yaxis: { title: d.yCol, automargin: true },
        paper_bgcolor: "#fff",
        plot_bgcolor: "#fff"
      };
    }

    await Plotly.react(div, traces, layout, {
      responsive: false,
      staticPlot: true,
      displayModeBar: false,
      displaylogo: false
    });

    const ex = exportSize || { width: 560, height: 360 };
    return Plotly.toImage(div, {
      format: "png",
      width: ex.width,
      height: ex.height
    });
  }

  async function generateGif() {
    const d = state.currentTrajectory || getTrajectoryData();
    if (!d || !d.x || d.x.length < 2) {
      setGifDownloadEnabled(false);
      setGifStatus("Need at least two valid trajectory points before exporting a GIF.");
      return;
    }
    if (!window.GIF) {
      setGifDownloadEnabled(false);
      setGifStatus("GIF encoder did not load. Refresh the page and try again.");
      return;
    }

    showGifCard();
    setGifDownloadEnabled(false);
    setGifStatus("Rendering GIF frames…");
    revokeGifUrl();

    const cfg = getGifModeConfig();
    const nFrames = clampInt(elFrames.value, 8, cfg.maxFrames, cfg.defaultFrames);
    const fps = clampInt(elFps.value, 1, 20, cfg.defaultFps);
    const idxs = buildFrameIndices(d.x.length, nFrames);

    const offscreen = document.createElement("div");
    offscreen.style.position = "fixed";
    offscreen.style.left = "-99999px";
    offscreen.style.top = "0";
    offscreen.style.width = `${cfg.width}px`;
    offscreen.style.height = `${cfg.height}px`;
    document.body.appendChild(offscreen);

    const delay = Math.max(40, Math.round(1000 / fps));
    const gif = new window.GIF({
      workers: cfg.workers,
      quality: cfg.quality,
      width: cfg.width,
      height: cfg.height,
      workerScript: "https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js"
    });

    try {
      for (let i = 0; i < idxs.length; i++) {
        setGifStatus(`Rendering frame ${i + 1} of ${idxs.length}…`);
        const dataUrl = await makeTrajectoryFrame(offscreen, d, idxs[i], { width: cfg.width, height: cfg.height });
        const img = await dataUrlToImage(dataUrl);
        gif.addFrame(img, { delay, copy: true });
      }
    } catch (err) {
      console.error(err);
      setGifDownloadEnabled(false);
      setGifStatus("GIF frame rendering failed. Try fewer frames or switch to 2D mode.");
      document.body.removeChild(offscreen);
      return;
    }

    document.body.removeChild(offscreen);
    setGifStatus("Encoding GIF…");

    gif.on("progress", (p) => {
      const pct = Math.max(1, Math.min(100, Math.round(p * 100)));
      setGifStatus(`Encoding GIF… ${pct}%`);
    });

    gif.on("finished", (blob) => {
      revokeGifUrl();
      state.gifUrl = URL.createObjectURL(blob);
      if (elGifPreview) {
        elGifPreview.innerHTML = `<img src="${state.gifUrl}" alt="Trajectory GIF preview" />`;
      }
      setGifDownloadEnabled(true, state.gifUrl);
      setGifStatus(`GIF ready (${cfg.mode === "high" ? "High quality" : "Fast"}). ${idxs.length} frames at ${fps} fps.`);
    });

    gif.on("abort", () => {
      setGifDownloadEnabled(false);
      setGifStatus("GIF encoding was aborted.");
    });

    gif.render();
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
      setLoadStatus("Could not read that file. Please try an Excel or CSV file.");
    }
  });

  elSheet.addEventListener("change", handleSheetChange);

  [elPlotType, elTimeShift, elShiftVar, elSkip, elTimeTraj, elMode, elX, elY, elZ, elPointSize].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => {
      updatePanels();
      renderCurrentPlot();
    });
    el.addEventListener("input", () => {
      if (el === elSkip || el === elPointSize) renderCurrentPlot();
    });
  });

  if (elFrames) {
    elFrames.addEventListener("input", () => { elFrames.dataset.userEdited = "1"; });
  }
  if (elFps) {
    elFps.addEventListener("input", () => { elFps.dataset.userEdited = "1"; });
  }
  if (elGifQuality) {
    elGifQuality.addEventListener("change", () => {
      if (elFrames) delete elFrames.dataset.userEdited;
      if (elFps) delete elFps.dataset.userEdited;
      syncGifInputsToMode();
    });
  }

  if (elMakeGif) {
    elMakeGif.addEventListener("click", generateGif);
  }

  updatePanels();
  syncGifInputsToMode();
  setGifDownloadEnabled(false);
  renderCurrentPlot();
})();