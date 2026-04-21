(function () {
  const $ = (id) => document.getElementById(id);

  const elFile = $("tool3File");
  const elSheet = $("tool3Sheet");
  const elSkip = $("tool3Skip");
  const elTime = $("tool3Time");
  const elShiftVar = $("tool3ShiftVar");
  const elMode = $("tool3Mode");
  const elX = $("tool3X");
  const elY = $("tool3Y");
  const elZ = $("tool3Z");
  const elZWrap = $("tool3ZWrap");
  const elFrames = $("tool3Frames");
  const elFps = $("tool3Fps");
  const elPointSize = $("tool3PointSize");
  const elRenderShift = $("tool3RenderShift");
  const elRenderTrajectory = $("tool3RenderTrajectory");
  const elMakeGif = $("tool3MakeGif");
  const elGifDownload = $("tool3GifDownload");
  const elGifPreview = $("tool3GifPreview");
  const elLoadStatus = $("tool3LoadStatus");
  const elGifStatus = $("tool3GifStatus");
  const elSummary = $("tool3Summary");
  const elShiftPlot = $("tool3ShiftPlot");
  const elTrajectoryPlot = $("tool3TrajectoryPlot");
  const elShiftMeta = $("tool3ShiftMeta");
  const elTrajMeta = $("tool3TrajMeta");

  if (!elFile || !elSheet || !elTime || !elShiftPlot || !elTrajectoryPlot) return;

  const state = {
    workbook: null,
    fileName: "",
    sheetName: "",
    headers: [],
    rows: [],
    numericHeaders: [],
    gifUrl: "",
    currentTrajectory: null,
  };

  function safeText(v) {
    return String(v == null ? "" : v).trim();
  }

  function setLoadStatus(msg) {
    if (elLoadStatus) elLoadStatus.textContent = msg;
  }

  function setGifStatus(msg) {
    if (elGifStatus) elGifStatus.textContent = msg;
  }

  function clampInt(v, lo, hi, fallback) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function num(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = safeText(v).replace(/,/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function uniqueHeaders(row0) {
    const used = new Map();
    return row0.map((v, idx) => {
      let base = safeText(v) || `Column ${idx + 1}`;
      if (!used.has(base)) {
        used.set(base, 1);
        return base;
      }
      const next = used.get(base) + 1;
      used.set(base, next);
      return `${base} (${next})`;
    });
  }

  function optionHTML(items, selected) {
    return items.map((v) => `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(v)}</option>`).join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function inferTimeHeader(headers) {
    const hit = headers.find((h) => /time|t/i.test(h));
    return hit || headers[0] || "";
  }

  function inferVariableHeaders(headers, timeHeader) {
    const vars = headers.filter((h) => h !== timeHeader);
    return vars;
  }

  function summarize() {
    if (!elSummary) return;
    const rows = Math.max(0, state.rows.length);
    const chips = [
      { label: "File", value: state.fileName || "—" },
      { label: "Rows", value: rows },
      { label: "Columns", value: state.headers.length },
      { label: "Numeric columns", value: state.numericHeaders.length },
    ];
    elSummary.innerHTML = chips.map((c) => `<div class="tool3-chip"><strong>${escapeHtml(c.label)}:</strong> ${escapeHtml(c.value)}</div>`).join("");
  }

  function setModeUI() {
    if (!elMode || !elZWrap) return;
    elZWrap.classList.toggle("tool3-hidden", elMode.value !== "3d");
  }

  function buildRows(raw) {
    if (!raw || !raw.length) return { headers: [], rows: [], numericHeaders: [] };
    const headers = uniqueHeaders(raw[0]);
    const rows = raw.slice(1)
      .map((r) => {
        const out = {};
        headers.forEach((h, i) => { out[h] = r[i]; });
        return out;
      })
      .filter((obj) => headers.some((h) => safeText(obj[h]) !== ""));

    const numericHeaders = headers.filter((h) => {
      let cnt = 0;
      for (const row of rows) {
        if (Number.isFinite(num(row[h]))) cnt += 1;
        if (cnt >= 3) return true;
      }
      return false;
    });

    return { headers, rows, numericHeaders };
  }

  function populateSelectors() {
    const timeHeader = inferTimeHeader(state.numericHeaders.length ? state.numericHeaders : state.headers);
    const vars = inferVariableHeaders(state.numericHeaders.length ? state.numericHeaders : state.headers, timeHeader);
    const xDefault = vars[0] || timeHeader || "";
    const yDefault = vars[1] || vars[0] || timeHeader || "";
    const zDefault = vars[2] || vars[1] || vars[0] || timeHeader || "";

    elTime.innerHTML = optionHTML(state.numericHeaders.length ? state.numericHeaders : state.headers, timeHeader);
    elShiftVar.innerHTML = optionHTML(vars, vars[0] || "");
    elX.innerHTML = optionHTML(vars, xDefault);
    elY.innerHTML = optionHTML(vars, yDefault);
    elZ.innerHTML = optionHTML(vars, zDefault);
    setModeUI();
  }

  function parseWorkbook(buffer, name) {
    const isCsv = /\.csv$/i.test(name || "");
    const wb = isCsv
      ? XLSX.read(buffer, { type: "array", raw: true, codepage: 65001 })
      : XLSX.read(buffer, { type: "array", raw: true });
    return wb;
  }

  function loadSheet(sheetName) {
    if (!state.workbook || !sheetName) return;
    const ws = state.workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
    const built = buildRows(raw);
    state.sheetName = sheetName;
    state.headers = built.headers;
    state.rows = built.rows;
    state.numericHeaders = built.numericHeaders;
    populateSelectors();
    summarize();
    setLoadStatus(`Loaded ${state.fileName || "file"} • Sheet: ${sheetName} • ${state.rows.length} data rows.`);
    elShiftMeta.textContent = "Ready";
    elTrajMeta.textContent = "Ready";
  }

  function getShiftSeries() {
    const timeCol = elTime.value;
    const varCol = elShiftVar.value;
    const skip = clampInt(elSkip.value, 1, 100000, 1);
    if (!timeCol || !varCol) throw new Error("Choose a time column and variable first.");

    const x = [];
    const y = [];
    for (let i = 0; i < state.rows.length - skip; i++) {
      const t = num(state.rows[i][timeCol]);
      const v = num(state.rows[i + skip][varCol]);
      if (Number.isFinite(t) && Number.isFinite(v)) {
        x.push(t);
        y.push(v);
      }
    }
    if (!x.length) throw new Error("No numeric rows available for the selected time / variable combination.");
    return { x, y, timeCol, varCol, skip };
  }

  function axisBounds(arr) {
    const vals = arr.filter((v) => Number.isFinite(v));
    if (!vals.length) return [0, 1];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) {
      const pad = Math.abs(lo || 1) * 0.15;
      return [lo - pad, hi + pad];
    }
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }

  function getTrajectorySeries() {
    const mode = elMode.value;
    const xCol = elX.value;
    const yCol = elY.value;
    const zCol = elZ.value;
    if (!xCol || !yCol || (mode === "3d" && !zCol)) {
      throw new Error("Choose the required variable columns first.");
    }

    const x = [];
    const y = [];
    const z = [];
    const t = [];
    const timeCol = elTime.value;

    for (let i = 0; i < state.rows.length; i++) {
      const xv = num(state.rows[i][xCol]);
      const yv = num(state.rows[i][yCol]);
      const zv = mode === "3d" ? num(state.rows[i][zCol]) : NaN;
      const tv = num(state.rows[i][timeCol]);
      const ok = mode === "3d"
        ? Number.isFinite(xv) && Number.isFinite(yv) && Number.isFinite(zv)
        : Number.isFinite(xv) && Number.isFinite(yv);
      if (ok) {
        x.push(xv);
        y.push(yv);
        if (mode === "3d") z.push(zv);
        t.push(Number.isFinite(tv) ? tv : i);
      }
    }

    if (!x.length) throw new Error("No numeric rows available for the selected trajectory columns.");
    return { mode, xCol, yCol, zCol, x, y, z, t };
  }

  function renderShiftPlot() {
    const data = getShiftSeries();
    const trace = {
      type: "scatter",
      mode: "lines",
      x: data.x,
      y: data.y,
      line: { width: 3 },
      name: `${data.varCol}(n+${data.skip})`
    };
    const layout = {
      title: `${data.varCol}(n+${data.skip}) over ${data.timeCol}`,
      margin: { l: 70, r: 30, t: 60, b: 70 },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      xaxis: { title: data.timeCol, zeroline: false },
      yaxis: { title: `${data.varCol}(n+${data.skip})`, zeroline: false },
      legend: { orientation: "h", y: -0.18 }
    };
    Plotly.react(elShiftPlot, [trace], layout, { responsive: true, displaylogo: false });
    elShiftMeta.textContent = `${data.varCol} • skip ${data.skip}`;
  }

  function renderTrajectoryPlot() {
    const data = getTrajectorySeries();
    const pointSize = clampInt(elPointSize.value, 4, 28, 12);
    let traces, layout;

    if (data.mode === "3d") {
      traces = [
        {
          type: "scatter3d",
          mode: "lines",
          x: data.x,
          y: data.y,
          z: data.z,
          line: { width: 5 },
          name: "Trajectory"
        },
        {
          type: "scatter3d",
          mode: "markers",
          x: [data.x[data.x.length - 1]],
          y: [data.y[data.y.length - 1]],
          z: [data.z[data.z.length - 1]],
          marker: { size: pointSize },
          name: "Latest point"
        }
      ];
      layout = {
        title: `${data.xCol} vs ${data.yCol} vs ${data.zCol}`,
        margin: { l: 0, r: 0, t: 60, b: 0 },
        paper_bgcolor: "#ffffff",
        scene: {
          xaxis: { title: data.xCol, range: axisBounds(data.x) },
          yaxis: { title: data.yCol, range: axisBounds(data.y) },
          zaxis: { title: data.zCol, range: axisBounds(data.z) },
          aspectmode: "cube"
        },
        legend: { orientation: "h", y: 1.02 }
      };
    } else {
      traces = [
        {
          type: "scatter",
          mode: "lines",
          x: data.x,
          y: data.y,
          line: { width: 3 },
          name: "Trajectory"
        },
        {
          type: "scatter",
          mode: "markers",
          x: [data.x[data.x.length - 1]],
          y: [data.y[data.y.length - 1]],
          marker: { size: pointSize },
          name: "Latest point"
        }
      ];
      layout = {
        title: `${data.xCol} vs ${data.yCol}`,
        margin: { l: 70, r: 30, t: 60, b: 70 },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        xaxis: { title: data.xCol, range: axisBounds(data.x), zeroline: false },
        yaxis: { title: data.yCol, range: axisBounds(data.y), zeroline: false },
        legend: { orientation: "h", y: -0.18 }
      };
    }

    Plotly.react(elTrajectoryPlot, traces, layout, { responsive: true, displaylogo: false });
    state.currentTrajectory = data;
    elTrajMeta.textContent = data.mode === "3d"
      ? `${data.xCol}, ${data.yCol}, ${data.zCol}`
      : `${data.xCol}, ${data.yCol}`;
    setGifStatus("Trajectory ready. Generate the GIF when you want.");
  }

  function evenlySpacedIndices(n, frames) {
    if (n <= 0) return [];
    if (frames >= n) return Array.from({ length: n }, (_, i) => i);
    const out = [];
    for (let i = 0; i < frames; i++) {
      const idx = Math.round((i * (n - 1)) / (frames - 1));
      out.push(idx);
    }
    return Array.from(new Set(out));
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function buildFrame(tempDiv, spec, idx, pointSize) {
    if (spec.mode === "3d") {
      const traces = [
        {
          type: "scatter3d",
          mode: "lines",
          x: spec.x.slice(0, idx + 1),
          y: spec.y.slice(0, idx + 1),
          z: spec.z.slice(0, idx + 1),
          line: { width: 5 },
          name: "Trajectory"
        },
        {
          type: "scatter3d",
          mode: "markers",
          x: [spec.x[idx]],
          y: [spec.y[idx]],
          z: [spec.z[idx]],
          marker: { size: pointSize },
          name: "Moving point"
        }
      ];
      const layout = {
        title: `${spec.xCol} vs ${spec.yCol} vs ${spec.zCol}`,
        width: 720,
        height: 520,
        margin: { l: 0, r: 0, t: 60, b: 0 },
        paper_bgcolor: "#ffffff",
        scene: {
          xaxis: { title: spec.xCol, range: axisBounds(spec.x) },
          yaxis: { title: spec.yCol, range: axisBounds(spec.y) },
          zaxis: { title: spec.zCol, range: axisBounds(spec.z) },
          aspectmode: "cube"
        },
        showlegend: false
      };
      await Plotly.react(tempDiv, traces, layout, { staticPlot: true, displayModeBar: false, responsive: false });
    } else {
      const traces = [
        {
          type: "scatter",
          mode: "lines",
          x: spec.x.slice(0, idx + 1),
          y: spec.y.slice(0, idx + 1),
          line: { width: 3 },
          name: "Trajectory"
        },
        {
          type: "scatter",
          mode: "markers",
          x: [spec.x[idx]],
          y: [spec.y[idx]],
          marker: { size: pointSize },
          name: "Moving point"
        }
      ];
      const layout = {
        title: `${spec.xCol} vs ${spec.yCol}`,
        width: 720,
        height: 520,
        margin: { l: 70, r: 30, t: 60, b: 70 },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        xaxis: { title: spec.xCol, range: axisBounds(spec.x), zeroline: false },
        yaxis: { title: spec.yCol, range: axisBounds(spec.y), zeroline: false },
        showlegend: false
      };
      await Plotly.react(tempDiv, traces, layout, { staticPlot: true, displayModeBar: false, responsive: false });
    }
    return Plotly.toImage(tempDiv, { format: "png", width: 720, height: 520, scale: 1 });
  }

  async function generateGif() {
    if (!state.currentTrajectory) {
      renderTrajectoryPlot();
    }
    if (!state.currentTrajectory) throw new Error("Render plot 2 first.");
    if (typeof GIF === "undefined") throw new Error("GIF library did not load.");

    const spec = state.currentTrajectory;
    const frames = clampInt(elFrames.value, 8, 180, 48);
    const fps = clampInt(elFps.value, 2, 30, 12);
    const pointSize = clampInt(elPointSize.value, 4, 28, 12);
    const indices = evenlySpacedIndices(spec.x.length, frames);
    if (!indices.length) throw new Error("No valid frames available for GIF generation.");

    setGifStatus(`Building ${indices.length} frame(s)...`);
    elGifDownload.classList.add("tool3-hidden");
    elGifPreview.style.display = "none";

    const tempDiv = document.createElement("div");
    tempDiv.style.position = "fixed";
    tempDiv.style.left = "-99999px";
    tempDiv.style.top = "0";
    tempDiv.style.width = "720px";
    tempDiv.style.height = "520px";
    document.body.appendChild(tempDiv);

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: 720,
      height: 520,
      workerScript: "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js"
    });

    gif.on("progress", (p) => {
      setGifStatus(`Encoding GIF… ${Math.round(p * 100)}%`);
    });

    const finished = new Promise((resolve) => {
      gif.on("finished", resolve);
    });

    try {
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        setGifStatus(`Rendering frame ${i + 1} / ${indices.length}...`);
        const url = await buildFrame(tempDiv, spec, idx, pointSize);
        const img = await loadImage(url);
        gif.addFrame(img, { delay: Math.round(1000 / fps), copy: true });
      }
      gif.render();
      const blob = await finished;
      if (state.gifUrl) URL.revokeObjectURL(state.gifUrl);
      state.gifUrl = URL.createObjectURL(blob);
      elGifDownload.href = state.gifUrl;
      elGifDownload.classList.remove("tool3-hidden");
      elGifPreview.src = state.gifUrl;
      elGifPreview.style.display = "block";
      setGifStatus("GIF ready. You can preview it below and download it.");
    } finally {
      try { Plotly.purge(tempDiv); } catch (e) {}
      tempDiv.remove();
    }
  }

  function ensureWorkbookReady() {
    if (!state.workbook) throw new Error("Upload a workbook first.");
  }

  async function handleFile(file) {
    const buffer = await file.arrayBuffer();
    state.workbook = parseWorkbook(buffer, file.name);
    state.fileName = file.name;
    const names = state.workbook.SheetNames || [];
    elSheet.innerHTML = optionHTML(names, names[0] || "");
    if (!names.length) throw new Error("No sheets were found in this workbook.");
    loadSheet(names[0]);
  }

  elFile.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setLoadStatus(`Reading ${file.name}...`);
      await handleFile(file);
    } catch (err) {
      console.error(err);
      setLoadStatus(err && err.message ? err.message : "Could not read that file.");
    }
  });

  elSheet.addEventListener("change", () => {
    try {
      ensureWorkbookReady();
      loadSheet(elSheet.value);
    } catch (err) {
      console.error(err);
      setLoadStatus(err && err.message ? err.message : "Could not load that sheet.");
    }
  });

  elMode.addEventListener("change", setModeUI);

  elRenderShift.addEventListener("click", () => {
    try {
      ensureWorkbookReady();
      renderShiftPlot();
    } catch (err) {
      console.error(err);
      elShiftMeta.textContent = "Plot not ready";
      setLoadStatus(err && err.message ? err.message : "Could not render plot 1.");
    }
  });

  elRenderTrajectory.addEventListener("click", () => {
    try {
      ensureWorkbookReady();
      renderTrajectoryPlot();
    } catch (err) {
      console.error(err);
      elTrajMeta.textContent = "Plot not ready";
      setGifStatus(err && err.message ? err.message : "Could not render plot 2.");
    }
  });

  elMakeGif.addEventListener("click", async () => {
    try {
      ensureWorkbookReady();
      await generateGif();
    } catch (err) {
      console.error(err);
      setGifStatus(err && err.message ? err.message : "Could not generate the GIF.");
    }
  });

  window.addEventListener("resize", () => {
    try {
      Plotly.Plots.resize(elShiftPlot);
      Plotly.Plots.resize(elTrajectoryPlot);
    } catch (e) {
      // no-op
    }
  });

  setModeUI();
})();
