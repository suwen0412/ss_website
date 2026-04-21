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

  function setLoadStatus(msg) {
    if (elLoadStatus) elLoadStatus.textContent = msg;
  }

  function setGifStatus(msg) {
    if (elGifStatus) elGifStatus.textContent = msg;
  }

  function setMeta(msg) {
    if (elMeta) elMeta.textContent = msg;
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

  function uniqueHeaders(row0) {
    const used = new Map();
    return row0.map((raw, i) => {
      let key = safeText(raw) || `Column ${i + 1}`;
      const seen = used.get(key) || 0;
      used.set(key, seen + 1);
      return seen ? `${key} (${seen + 1})` : key;
    });
  }

  function optionList(selectEl, values, preferred) {
    if (!selectEl) return;
    selectEl.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if (!values.length) {
      selectEl.innerHTML = `<option value="">No columns available</option>`;
      return;
    }
    if (preferred && values.includes(preferred)) {
      selectEl.value = preferred;
    } else if (!values.includes(selectEl.value)) {
      selectEl.value = values[0];
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseSheet(name) {
    if (!state.workbook || !name) return;
    const ws = state.workbook.Sheets[name];
    if (!ws) return;

    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!matrix.length) {
      state.headers = [];
      state.rows = [];
      state.numericHeaders = [];
      return;
    }

    const headers = uniqueHeaders(matrix[0]);
    const rows = matrix.slice(1)
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i]; });
        return obj;
      })
      .filter(obj => Object.values(obj).some(v => safeText(v) !== ""));

    const numericHeaders = headers.filter((h) => {
      let valid = 0;
      let numeric = 0;
      for (const row of rows) {
        const v = row[h];
        if (safeText(v) === "") continue;
        valid += 1;
        if (Number.isFinite(num(v))) numeric += 1;
      }
      return valid > 0 && numeric / valid >= 0.7;
    });

    state.sheetName = name;
    state.headers = headers;
    state.rows = rows;
    state.numericHeaders = numericHeaders;
  }

  function guessTimeColumn() {
    const lower = state.headers.map(h => h.toLowerCase());
    const exact = ["time", "t", "time (s)", "time(s)", "timestamp"];
    for (const target of exact) {
      const idx = lower.indexOf(target);
      if (idx >= 0) return state.headers[idx];
    }
    const partial = state.headers.find(h => h.toLowerCase().includes("time"));
    return partial || state.headers[0] || "";
  }

  function refreshControls() {
    const timeGuess = guessTimeColumn();
    optionList(elTimeShift, state.headers, timeGuess);
    optionList(elTimeTraj, state.headers, timeGuess);

    const numeric = state.numericHeaders.length ? state.numericHeaders : state.headers;
    const nonTimeNumeric = numeric.filter(h => h !== timeGuess);
    const choices = nonTimeNumeric.length ? nonTimeNumeric : numeric;

    optionList(elShiftVar, choices, choices[0] || "");
    optionList(elX, choices, choices[0] || "");
    optionList(elY, choices, choices[1] || choices[0] || "");
    optionList(elZ, choices, choices[2] || choices[0] || "");

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
      const tRaw = tSeries[i].raw;
      const y0 = ySeries[i].num;
      const y1 = ySeries[i + skip].num;
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
      t.push(tRaw === "" ? i : tRaw);
      yn.push(y0);
      ynp.push(y1);
    }

    return { tCol, yCol, skip, t, yn, ynp };
  }

  function renderShiftPlot() {
    const d = getShiftData();

    const traces = [
      {
        x: d.t,
        y: d.yn,
        mode: "lines",
        name: `${d.yCol} (n)`,
        line: { width: 3 }
      },
      {
        x: d.t,
        y: d.ynp,
        mode: "lines",
        name: `${d.yCol} (n+${d.skip})`,
        line: { width: 3, dash: "dash" }
      }
    ];

    const layout = {
      title: `${d.yCol}: y(n) and y(n+${d.skip}) vs ${d.tCol}`,
      margin: { l: 62, r: 24, t: 56, b: 58 },
      xaxis: { title: d.tCol },
      yaxis: { title: d.yCol },
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
        margin: { l: 0, r: 0, t: 56, b: 0 },
        scene: {
          xaxis: { title: d.xCol },
          yaxis: { title: d.yCol },
          zaxis: { title: d.zCol }
        },
        legend: { orientation: "h", y: 1.05 },
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
        xaxis: { title: d.xCol },
        yaxis: { title: d.yCol },
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

  function hideGifOutput() {
    if (elGifCard) elGifCard.classList.add("tool3-hidden");
    setGifDownloadEnabled(false);
    setGifStatus("GIF export is available for the trajectory plot.");
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

  function revokeGifUrl() {
    if (state.gifUrl && state.gifUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.gifUrl);
    }
    state.gifUrl = "";
  }

  async function loadWorkbookFromFile(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    state.workbook = wb;
    state.fileName = file.name || "uploaded file";

    const sheets = wb.SheetNames || [];
    elSheet.innerHTML = sheets.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    if (sheets.length) {
      parseSheet(sheets[0]);
      refreshControls();
      renderCurrentPlot();
    } else {
      setLoadStatus("This file did not contain any readable sheets.");
    }
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

  async function makeTrajectoryFrame(div, d, idx) {
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
        margin: { l: 0, r: 0, t: 50, b: 0 },
        scene: {
          xaxis: { title: d.xCol },
          yaxis: { title: d.yCol },
          zaxis: { title: d.zCol }
        },
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
        xaxis: { title: d.xCol },
        yaxis: { title: d.yCol },
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

    return Plotly.toImage(div, {
      format: "png",
      width: 800,
      height: 520
    });
  }

  async function generateGif() {
    const d = state.currentTrajectory || getTrajectoryData();
    if (!d || !d.x || d.x.length < 2) {
      setGifStatus("Need at least two valid trajectory points before exporting a GIF.");
      return;
    }

    showGifCard();
    setGifStatus("Rendering GIF frames…");
    revokeGifUrl();

    const nFrames = clampInt(elFrames.value, 8, 120, 28);
    const fps = clampInt(elFps.value, 1, 20, 8);
    const idxs = buildFrameIndices(d.x.length, nFrames);

    const offscreen = document.createElement("div");
    offscreen.style.position = "fixed";
    offscreen.style.left = "-99999px";
    offscreen.style.top = "0";
    offscreen.style.width = "800px";
    offscreen.style.height = "520px";
    document.body.appendChild(offscreen);

    const images = [];
    try {
      for (let i = 0; i < idxs.length; i++) {
        setGifStatus(`Rendering frame ${i + 1} of ${idxs.length}…`);
        const url = await makeTrajectoryFrame(offscreen, d, idxs[i]);
        images.push(url);
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

    window.gifshot.createGIF(
      {
        images,
        gifWidth: 800,
        gifHeight: 520,
        interval: 1 / fps,
        numFrames: images.length
      },
      function (obj) {
        if (!obj || obj.error || !obj.image) {
          setGifDownloadEnabled(false);
          setGifStatus("GIF encoding failed in the browser.");
          return;
        }

        revokeGifUrl();
        state.gifUrl = obj.image;

        if (elGifPreview) {
          elGifPreview.innerHTML = `<img src="${obj.image}" alt="Trajectory GIF preview" />`;
        }
        setGifDownloadEnabled(true, obj.image);
        setGifStatus(`GIF ready. ${images.length} frames at ${fps} fps.`);
      }
    );
  }

  function handleSheetChange() {
    parseSheet(elSheet.value);
    refreshControls();
    renderCurrentPlot();
  }

  // ---- Bind events ----
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

  if (elMakeGif) {
    elMakeGif.addEventListener("click", generateGif);
  }

  // ---- Initial placeholder ----
  updatePanels();
  setGifDownloadEnabled(false);
  renderCurrentPlot();
})();