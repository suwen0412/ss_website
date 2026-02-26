
/*
  Tool 2 — Equation + Data Visualizer (client-side)
  - Upload one or more Excel/CSV files with two columns (x, y)
  - Define one or more equation curves using math.js expressions
  - Assign datasets/curves to up to 10 figures and overlay them
  - Plotly renders plots in-browser (no uploads)
*/
(function () {
  const MAX_FIGS = 10;

  const $ = (id) => document.getElementById(id);

  const elFiles       = $("tool2Files");
  const elDatasetList = $("tool2DatasetList");

  const elAddEq    = $("tool2AddEq");
  const elEqList   = $("tool2EqList");

  const elXMin = $("tool2XMin");
  const elXMax = $("tool2XMax");
  const elN    = $("tool2N");

  const elFigCount   = $("tool2FigCount");
  const elShowLegend = $("tool2ShowLegend");
  const elFigSettings = $("tool2FigSettings");

  const elRender = $("tool2Render");
  const elClear  = $("tool2Clear");
  const elStatus = $("tool2Status");
  const elPlotGrid = $("tool2PlotGrid");

  if (!elFiles || !elDatasetList || !elAddEq || !elEqList || !elRender || !elPlotGrid) return;

  // ---- State ----
  const state = {
    datasets: [], // {id, name, x, y, fig, enabled}
    eqs: [],      // {id, name, expr, params:{}, compiled, fig, enabled, xMode:'range'|'dataset', datasetId:null}
    figMeta: []   // [{title,xlabel,ylabel}]
  };

  const uid = () => "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

  const clampInt = (v, lo, hi) => {
    const n = Math.max(lo, Math.min(hi, parseInt(v, 10)));
    return Number.isFinite(n) ? n : lo;
  };

  const num = (v, fallback) => {
    const n = (typeof v === "number") ? v : parseFloat(String(v).trim());
    return Number.isFinite(n) ? n : fallback;
  };

  const setStatus = (msg) => { if (elStatus) elStatus.textContent = msg; };

  function safeSheetToRows(ws) {
    try {
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    } catch (e) {
      return [];
    }
  }

  function extractXY(rows) {
    const x = [];
    const y = [];
    for (const row of rows) {
      if (!row || row.length < 2) continue;
      const xv = num(row[0], NaN);
      const yv = num(row[1], NaN);
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        x.push(xv);
        y.push(yv);
      }
    }
    return { x, y };
  }

  async function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(file);
    });
  }

  async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsText(file);
    });
  }

  async function handleFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;

    let added = 0;
    for (const file of list) {
      const name = file.name || "data";
      const isCSV = /\.csv$/i.test(name);

      let wb;
      try {
        if (isCSV) {
          const txt = await readFileAsText(file);
          wb = XLSX.read(txt, { type: "string" });
        } else {
          const buf = await readFileAsArrayBuffer(file);
          wb = XLSX.read(buf, { type: "array" });
        }
      } catch (e) {
        console.warn("Failed to read", name, e);
        continue;
      }

      const sheetNames = wb.SheetNames || [];
      for (const sname of sheetNames) {
        const ws = wb.Sheets[sname];
        const rows = safeSheetToRows(ws);
        const { x, y } = extractXY(rows);

        if (x.length >= 2) {
          state.datasets.push({
            id: uid(),
            name: `${name} — ${sname}`,
            x,
            y,
            fig: 1,
            enabled: true
          });
          added += 1;
        }
      }
    }

    updateDatasetUI();
    updateEqUI(); // refresh dataset dropdowns inside equations
    setStatus(added ? `Loaded ${added} dataset(s). Assign them to figures and click “Render / Update plots”.` : "No numeric two-column datasets found in the uploaded files.");
  }

  // ---- Equation parsing ----
  function detectParams(expr) {
    if (!expr || !expr.trim()) return [];

    let node;
    try {
      node = math.parse(expr);
    } catch (e) {
      return null; // invalid
    }

    const symbols = new Set();
    const fnNames = new Set();

    node.traverse(function (n) {
      if (!n) return;
      if (n.isFunctionNode) {
        if (n.fn && n.fn.isSymbolNode) fnNames.add(n.fn.name);
      }
      if (n.isSymbolNode) symbols.add(n.name);
    });

    // Remove x and common constants / reserved
    ["x", "pi", "e", "i", "Infinity", "NaN"].forEach((k) => symbols.delete(k));
    fnNames.forEach((f) => symbols.delete(f));

    return Array.from(symbols).sort();
  }

  function compileEq(eq) {
    try {
      eq.compiled = math.compile(eq.expr);
      return null;
    } catch (e) {
      eq.compiled = null;
      return e;
    }
  }

  function evalEq(eq, xVals) {
    if (!eq.compiled) {
      const err = compileEq(eq);
      if (err) return { x: [], y: [], error: err };
    }

    const yVals = [];
    for (const xv of xVals) {
      const scope = { x: xv };
      for (const [k, v] of Object.entries(eq.params || {})) scope[k] = v;

      let y;
      try {
        y = eq.compiled.evaluate(scope);
      } catch (e) {
        return { x: [], y: [], error: e };
      }

      // math.js may return BigNumber/Complex; we only plot finite numbers
      const yn = (typeof y === "number") ? y : parseFloat(String(y));
      yVals.push(Number.isFinite(yn) ? yn : NaN);
    }

    return { x: xVals, y: yVals, error: null };
  }

  // ---- UI builders ----
  function figSelectHTML(selected) {
    const n = clampInt(elFigCount.value, 1, MAX_FIGS);
    let out = `<select class="tool2-select figsel">`;
    for (let i = 1; i <= n; i++) {
      out += `<option value="${i}" ${i === selected ? "selected" : ""}>Figure ${i}</option>`;
    }
    out += `</select>`;
    return out;
  }

  function datasetSelectHTML(selectedId) {
    const ds = state.datasets;
    let out = `<select class="tool2-select dssel" ${ds.length ? "" : "disabled"}>`;
    out += `<option value="">Select dataset…</option>`;
    for (const d of ds) {
      out += `<option value="${d.id}" ${d.id === selectedId ? "selected" : ""}>${escapeHtml(d.name)}</option>`;
    }
    out += `</select>`;
    return out;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updateDatasetUI() {
    if (!elDatasetList) return;

    if (!state.datasets.length) {
      elDatasetList.innerHTML = `<p class="muted small">No datasets loaded yet.</p>`;
      return;
    }

    const nfig = clampInt(elFigCount.value, 1, MAX_FIGS);

    elDatasetList.innerHTML = state.datasets.map((d) => {
      const fig = Math.min(d.fig || 1, nfig);
      d.fig = fig;

      return `
        <div class="tool2-item" data-id="${d.id}">
          <label class="tool2-check">
            <input class="ds-enabled" type="checkbox" ${d.enabled ? "checked" : ""} />
            Use
          </label>

          <input class="tool2-name ds-name" type="text" value="${escapeHtml(d.name)}" />

          <span class="muted small">(${d.x.length} pts)</span>

          <label class="tool2-mini">
            <span>Figure</span>
            ${figSelectHTML(fig)}
          </label>

          <button class="btn small ds-remove" type="button" title="Remove dataset">Remove</button>
        </div>
      `;
    }).join("");

    // bind dataset events
    elDatasetList.querySelectorAll(".tool2-item").forEach((row) => {
      const id = row.getAttribute("data-id");
      const d = state.datasets.find(x => x.id === id);
      if (!d) return;

      row.querySelector(".ds-enabled").addEventListener("change", (e) => {
        d.enabled = !!e.target.checked;
      });

      row.querySelector(".ds-name").addEventListener("input", (e) => {
        d.name = e.target.value;
        updateEqUI(); // keep dataset names in eq dropdown
      });

      row.querySelector(".figsel").addEventListener("change", (e) => {
        d.fig = clampInt(e.target.value, 1, MAX_FIGS);
      });

      row.querySelector(".ds-remove").addEventListener("click", () => {
        state.datasets = state.datasets.filter(x => x.id !== id);
        // Remove eq references
        state.eqs.forEach(eq => { if (eq.datasetId === id) eq.datasetId = ""; });
        updateDatasetUI();
        updateEqUI();
      });
    });
  }

  function paramInputsHTML(eq) {
    const keys = Object.keys(eq.params || {});
    if (!keys.length) return `<div class="muted small">No parameters detected (only <code>x</code>).</div>`;

    return keys.map((k) => {
      const v = eq.params[k];
      return `
        <label class="tool2-mini param" data-p="${escapeHtml(k)}">
          <span>${escapeHtml(k)}</span>
          <input class="param-val" type="number" step="any" value="${Number.isFinite(v) ? v : 1}" />
        </label>
      `;
    }).join("");
  }

  function updateEqUI() {
    if (!elEqList) return;

    if (!state.eqs.length) {
      elEqList.innerHTML = `<p class="muted small">No equations yet. Click “Add equation”.</p>`;
      return;
    }

    const nfig = clampInt(elFigCount.value, 1, MAX_FIGS);

    elEqList.innerHTML = state.eqs.map((eq) => {
      const fig = Math.min(eq.fig || 1, nfig);
      eq.fig = fig;

      const xMode = eq.xMode || "range";
      const dsDisabled = (!state.datasets.length);

      return `
        <div class="tool2-item eq" data-id="${eq.id}">
          <label class="tool2-check">
            <input class="eq-enabled" type="checkbox" ${eq.enabled ? "checked" : ""} />
            Use
          </label>

          <input class="tool2-expr eq-expr" type="text" value="${escapeHtml(eq.expr)}" placeholder="e.g., exp(x/a) + exp(b*x/tan(c))" />

          <label class="tool2-mini">
            <span>x source</span>
            <select class="tool2-select eq-xmode">
              <option value="range" ${xMode === "range" ? "selected" : ""}>range</option>
              <option value="dataset" ${xMode === "dataset" ? "selected" : ""} ${dsDisabled ? "disabled" : ""}>from dataset</option>
            </select>
          </label>

          <label class="tool2-mini eq-dswrap" style="${xMode === "dataset" ? "" : "display:none;"}">
            <span>dataset</span>
            ${datasetSelectHTML(eq.datasetId || "")}
          </label>

          <label class="tool2-mini">
            <span>Figure</span>
            ${figSelectHTML(fig)}
          </label>

          <button class="btn small eq-detect" type="button">Detect params</button>
          <button class="btn small eq-remove" type="button" title="Remove equation">Remove</button>

          <div class="tool2-params">
            ${paramInputsHTML(eq)}
          </div>

          <div class="tool2-error muted small" style="display:none;"></div>
        </div>
      `;
    }).join("");

    // bind events
    elEqList.querySelectorAll(".tool2-item.eq").forEach((row) => {
      const id = row.getAttribute("data-id");
      const eq = state.eqs.find(x => x.id === id);
      if (!eq) return;

      const elEnabled = row.querySelector(".eq-enabled");
      const elExpr = row.querySelector(".eq-expr");
      const elDetect = row.querySelector(".eq-detect");
      const elRemove = row.querySelector(".eq-remove");
      const elFigSel = row.querySelector(".figsel");
      const elParams = row.querySelector(".tool2-params");
      const elErr = row.querySelector(".tool2-error");
      const elXMode = row.querySelector(".eq-xmode");
      const elDsWrap = row.querySelector(".eq-dswrap");
      const elDsSel = row.querySelector(".dssel");

      elEnabled.addEventListener("change", (e) => { eq.enabled = !!e.target.checked; });

      elFigSel.addEventListener("change", (e) => { eq.fig = clampInt(e.target.value, 1, MAX_FIGS); });

      elXMode.addEventListener("change", (e) => {
        eq.xMode = e.target.value;
        elDsWrap.style.display = (eq.xMode === "dataset") ? "" : "none";
      });

      if (elDsSel) {
        elDsSel.addEventListener("change", (e) => { eq.datasetId = e.target.value; });
      }

      function refreshParamsFromExpr() {
        const expr = elExpr.value || "";
        eq.expr = expr;

        const params = detectParams(expr);
        if (params === null) {
          elErr.style.display = "";
          elErr.textContent = "Invalid expression. Please check parentheses and function names.";
          return;
        }

        elErr.style.display = "none";

        // preserve existing values when possible
        const next = {};
        for (const p of params) {
          next[p] = (eq.params && Object.prototype.hasOwnProperty.call(eq.params, p)) ? eq.params[p] : 1;
        }
        eq.params = next;
        eq.compiled = null; // recompile later
        elParams.innerHTML = paramInputsHTML(eq);

        // bind param inputs
        elParams.querySelectorAll(".param").forEach((pwrap) => {
          const key = pwrap.getAttribute("data-p");
          const inp = pwrap.querySelector(".param-val");
          inp.addEventListener("input", (e) => {
            eq.params[key] = num(e.target.value, 1);
          });
        });
      }

      elExpr.addEventListener("change", refreshParamsFromExpr);
      elDetect.addEventListener("click", refreshParamsFromExpr);

      // bind existing param inputs
      elParams.querySelectorAll(".param").forEach((pwrap) => {
        const key = pwrap.getAttribute("data-p");
        const inp = pwrap.querySelector(".param-val");
        inp.addEventListener("input", (e) => { eq.params[key] = num(e.target.value, 1); });
      });

      elRemove.addEventListener("click", () => {
        state.eqs = state.eqs.filter(x => x.id !== id);
        updateEqUI();
      });
    });
  }

  // ---- Figure settings ----
  function ensureFigMeta(n) {
    while (state.figMeta.length < n) {
      const idx = state.figMeta.length + 1;
      state.figMeta.push({ title: `Figure ${idx}`, xlabel: "x", ylabel: "y" });
    }
    if (state.figMeta.length > n) state.figMeta = state.figMeta.slice(0, n);
  }

  function updateFigSettingsUI() {
    const n = clampInt(elFigCount.value, 1, MAX_FIGS);
    ensureFigMeta(n);

    elFigSettings.innerHTML = state.figMeta.map((m, i) => {
      const k = i + 1;
      return `
        <div class="tool2-item fig" data-fig="${k}">
          <strong>Figure ${k}</strong>
          <label class="tool2-mini">
            <span>Title</span>
            <input class="fig-title" type="text" value="${escapeHtml(m.title)}" />
          </label>
          <label class="tool2-mini">
            <span>X label</span>
            <input class="fig-xlab" type="text" value="${escapeHtml(m.xlabel)}" />
          </label>
          <label class="tool2-mini">
            <span>Y label</span>
            <input class="fig-ylab" type="text" value="${escapeHtml(m.ylabel)}" />
          </label>
        </div>
      `;
    }).join("");

    elFigSettings.querySelectorAll(".tool2-item.fig").forEach((row) => {
      const k = clampInt(row.getAttribute("data-fig"), 1, MAX_FIGS);
      const m = state.figMeta[k - 1];
      row.querySelector(".fig-title").addEventListener("input", (e) => { m.title = e.target.value; });
      row.querySelector(".fig-xlab").addEventListener("input", (e) => { m.xlabel = e.target.value; });
      row.querySelector(".fig-ylab").addEventListener("input", (e) => { m.ylabel = e.target.value; });
    });
  }

  function ensurePlotDivs(n) {
    // auto-fit grid
    elPlotGrid.innerHTML = "";
    for (let i = 1; i <= n; i++) {
      const box = document.createElement("div");
      box.className = "plot-box";
      const div = document.createElement("div");
      div.id = `tool2Fig${i}`;
      div.className = "plot";
      box.appendChild(div);
      elPlotGrid.appendChild(box);
    }
  }

  // ---- Rendering ----
  function linspace(a, b, n) {
    const out = [];
    const N = Math.max(2, n);
    const step = (b - a) / (N - 1);
    for (let i = 0; i < N; i++) out.push(a + step * i);
    return out;
  }

  function renderPlots() {
    const n = clampInt(elFigCount.value, 1, MAX_FIGS);
    ensureFigMeta(n);
    ensurePlotDivs(n);

    // build traces per figure
    const tracesByFig = Array.from({ length: n }, () => []);
    const showLegend = !!elShowLegend.checked;

    // datasets
    for (const d of state.datasets) {
      if (!d.enabled) continue;
      const fig = clampInt(d.fig || 1, 1, n);
      tracesByFig[fig - 1].push({
        x: d.x,
        y: d.y,
        mode: "lines",
        name: d.name
      });
    }

    // equations
    const xMin = num(elXMin.value, -1);
    const xMax = num(elXMax.value, 1);
    const Npts = clampInt(elN.value, 50, 5000);
    const xRange = linspace(xMin, xMax, Npts);

    for (const eq of state.eqs) {
      if (!eq.enabled) continue;
      const fig = clampInt(eq.fig || 1, 1, n);

      let xVals = xRange;
      if ((eq.xMode || "range") === "dataset") {
        const ds = state.datasets.find(d => d.id === eq.datasetId);
        if (ds && ds.x && ds.x.length) xVals = ds.x;
      }

      const { x, y, error } = evalEq(eq, xVals);
      if (error) {
        console.warn("Equation eval error:", eq.expr, error);
        continue;
      }

      tracesByFig[fig - 1].push({
        x,
        y,
        mode: "lines",
        name: eq.name || `f(x) = ${eq.expr}`
      });
    }

    let renderedAny = false;
    for (let i = 1; i <= n; i++) {
      const div = $(`tool2Fig${i}`);
      const meta = state.figMeta[i - 1] || { title: `Figure ${i}`, xlabel: "x", ylabel: "y" };

      const layout = {
        title: { text: meta.title },
        margin: { l: 60, r: 20, t: 45, b: 55 },
        xaxis: { title: { text: meta.xlabel } },
        yaxis: { title: { text: meta.ylabel } },
        legend: { orientation: "h" }
      };

      const config = { responsive: true, displaylogo: false };

      const traces = tracesByFig[i - 1];
      if (traces.length) renderedAny = true;

      Plotly.react(div, traces, layout, config);
    }

    setStatus(renderedAny ? "Plots updated." : "Nothing to plot yet. Enable at least one dataset or equation.");
  }

  function clearPlots() {
    const n = clampInt(elFigCount.value, 1, MAX_FIGS);
    for (let i = 1; i <= n; i++) {
      const div = $(`tool2Fig${i}`);
      if (div) Plotly.purge(div);
    }
    elPlotGrid.innerHTML = "";
    setStatus("Cleared.");
  }

  // ---- Event wiring ----
  elFiles.addEventListener("change", (e) => handleFiles(e.target.files));

  elAddEq.addEventListener("click", () => {
    const id = uid();
    const eq = {
      id,
      name: `Equation ${state.eqs.length + 1}`,
      expr: "exp(x/a)",
      params: { a: 1 },
      compiled: null,
      fig: 1,
      enabled: true,
      xMode: "range",
      datasetId: ""
    };
    state.eqs.push(eq);
    updateEqUI();
  });

  elFigCount.addEventListener("change", () => {
    elFigCount.value = clampInt(elFigCount.value, 1, MAX_FIGS);
    updateFigSettingsUI();
    updateDatasetUI();
    updateEqUI();
  });

  elRender.addEventListener("click", () => {
    try {
      renderPlots();
    } catch (e) {
      console.error(e);
      setStatus("Render failed. Check your equation syntax and uploaded data.");
    }
  });

  elClear.addEventListener("click", clearPlots);

  // ---- init ----
  updateFigSettingsUI();
  updateDatasetUI();
  updateEqUI();
  setStatus("Tip: upload data, add an equation, then click “Render / Update plots”.");
})();
