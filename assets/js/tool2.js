
/*
  Tool 2 — Equation + Data Visualizer (client-side)
  - Upload one or more Excel/CSV files with two columns (x, y)
  - Define one or more equation curves using math.js expressions
  - Assign datasets/curves to up to 10 figures and overlay them
  - Plotly renders plots in-browser (no uploads)
*/
(function () {

  function resizeAllPlots() {
    try {
      if (!window.Plotly) return;
      const divs = document.querySelectorAll("#tool2PlotGrid .plot");
      divs.forEach((div) => {
        // Plotly attaches data/layout onto the div once rendered
        if (div && (div.data || div._fullLayout)) {
          window.Plotly.Plots.resize(div);
        }
      });
    } catch (e) {
      // no-op
    }
  }
  
  let _rzT = null;
  function initSplitter() {
  const layout = document.querySelector(".tool2-layout");
  const split = document.querySelector(".tool2-splitter");
  if (!layout || !split) return;

  // Restore width
  try {
    const saved = localStorage.getItem("tool2_left_w");
    if (saved) {
      const px = Math.max(240, Math.min(520, parseInt(saved, 10)));
      layout.style.setProperty("--tool2-left-w", px + "px");
    }
  } catch (e) {}

  let dragging = false;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const onMove = (e) => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const newW = clamp(x - rect.left, 240, 520);
    layout.style.setProperty("--tool2-left-w", newW + "px");
    try { localStorage.setItem("tool2_left_w", String(Math.round(newW))); } catch (err) {}
    resizeAllPlots();
    e.preventDefault();
  };

  const onUp = () => {
    dragging = false;
    document.body.classList.remove("tool2-dragging");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchmove", onMove, { passive: false });
    window.removeEventListener("touchend", onUp);
  };

  const onDown = (e) => {
    dragging = true;
    document.body.classList.add("tool2-dragging");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    e.preventDefault();
  };

  split.addEventListener("mousedown", onDown);
  split.addEventListener("touchstart", onDown, { passive: false });

  // Keyboard resize
  split.addEventListener("keydown", (e) => {
    const step = (e.shiftKey ? 20 : 10);
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const current = parseInt(getComputedStyle(layout).getPropertyValue("--tool2-left-w")) || 320;
    const next = clamp(current + (e.key === "ArrowRight" ? step : -step), 240, 520);
    layout.style.setProperty("--tool2-left-w", next + "px");
    try { localStorage.setItem("tool2_left_w", String(Math.round(next))); } catch (err) {}
    resizeAllPlots();
    e.preventDefault();
  });
}

window.addEventListener("resize", () => {
    clearTimeout(_rzT);
    _rzT = setTimeout(resizeAllPlots, 80);
  });
  
  
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

  const elFloatToggle = $("tool2FloatToggle");
  const elFloatFig = $("tool2FloatFig");
  const elFloatWin = $("tool2FloatWin");
  const elFloatBar = $("tool2FloatBar");
  const elFloatClose = $("tool2FloatClose");
  const elFloatPlot = $("tool2FloatPlot");
  const elFloatEq = $("tool2FloatEq");
  const elFloatTitle = $("tool2FloatTitle");
  const elParamSliders = $("tool2ParamSliders");

  if (!elFiles || !elDatasetList || !elAddEq || !elEqList || !elRender || !elPlotGrid) return;

  // ---- State ----
  const state = {
    float: { enabled: false, fig: 1, left: null, top: null, w: null, h: null },
    datasets: [], // {id, name, x, y, fig, enabled}
    eqs: [],      // {id, name, expr, params:{}, compiled, fig, enabled, xMode:'range'|'dataset', datasetId:null}
    figMeta: [],  // [{title,xlabel,ylabel}]
    plotSpecs: [], // per-figure {traces, layout} used for floating preview
    hasRendered: false,
    _renderQueued: false
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

  const round3 = (v) => {
    const n = num(v, 0);
    return Math.round(n * 1000) / 1000;
  };

  const fmt3 = (v) => {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(3);
  };

  const setStatus = (msg) => { if (elStatus) elStatus.textContent = msg; };

  function scheduleRender() {
    // Live update only after the first explicit render.
    if (!state.hasRendered) return;
    if (state._renderQueued) return;
    state._renderQueued = true;
    requestAnimationFrame(() => {
      state._renderQueued = false;
      try {
        renderPlots();
      } catch (e) {
        console.error(e);
        setStatus("Live update failed. Check your equation syntax and parameter values.");
      }
    });
  }

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
    updateEqUI();
  initFloatUI();
  initSplitter(); // refresh dataset dropdowns inside equations
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

  function autoRangeFor(v) {
    // Create a slider range centered on v.
    const val = num(v, 1);
    const base = Math.max(1, Math.abs(val));
    const span = base * 2.5;
    const min = val - span;
    const max = val + span;
    const step = Math.max(1e-6, (max - min) / 300);
    return { min, max, step };
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
        scheduleRender();
      });

      row.querySelector(".ds-name").addEventListener("input", (e) => {
        d.name = e.target.value;
        updateEqUI(); // keep dataset names in eq dropdown
        scheduleRender();
      });

      row.querySelector(".figsel").addEventListener("change", (e) => {
        d.fig = clampInt(e.target.value, 1, MAX_FIGS);
        scheduleRender();
      });

      row.querySelector(".ds-remove").addEventListener("click", () => {
        state.datasets = state.datasets.filter(x => x.id !== id);
        // Remove eq references
        state.eqs.forEach(eq => { if (eq.datasetId === id) eq.datasetId = ""; });
        updateDatasetUI();
        updateEqUI();
        scheduleRender();
      });
    });
  }

  
function paramInputsHTML(eq) {
  const keys = Object.keys(eq.params || {});
  if (!keys.length) return `<div class="muted small">No parameters detected (only <code>x</code>).</div>`;

  return keys.map((k) => {
    const v = num(eq.params[k], 1);
    return `
      <div class="tool2-param tool2-param-value" data-eqid="${escapeHtml(eq.id)}" data-p="${escapeHtml(k)}">
        <div class="param-head">
          <span class="param-name">${escapeHtml(k)}</span>
        </div>
        <div class="param-inline">
          <input class="param-val" type="number" step="0.001" value="${fmt3(v)}" />
        </div>
      </div>
    `;
  }).join("");
}

  
function paramSlidersPanelHTML() {
  const eqs = state.eqs || [];
  let any = false;

  const out = eqs.map((eq) => {
    const keys = Object.keys(eq.params || {});
    if (!keys.length) return "";

    any = true;
    if (!eq.paramRanges) eq.paramRanges = {};

    const rows = keys.map((k) => {
      const v = num(eq.params[k], 1);
      if (!eq.paramRanges[k]) eq.paramRanges[k] = autoRangeFor(v);
      const r = eq.paramRanges[k];
      const step = Math.max(r.step || 0.001, 0.001);

      return `
        <div class="tool2-param tool2-slider-row" data-eqid="${escapeHtml(eq.id)}" data-p="${escapeHtml(k)}">
          <div class="tool2-slider-top">
            <span class="name">${escapeHtml(k)}</span>
            <span class="val param-valtext">${fmt3(v)}</span>
          </div>
          <input class="param-slider" type="range" min="${r.min}" max="${r.max}" step="${step}" value="${round3(v)}" />
          <div class="tool2-slider-meta">
            <span class="range param-range muted small">${fmt3(r.min)} ↔ ${fmt3(r.max)}</span>
            <button class="btn tiny param-rescale" type="button" title="Rescale slider around current value">Rescale</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="tool2-slider-group">
        <div class="tool2-slider-grouphead">
          <div>
            <div class="tool2-slider-gtitle">${escapeHtml(eq.name || "Equation")}</div>
            <div class="muted small">f(x) = ${escapeHtml(eq.expr || "")}</div>
          </div>
        </div>
        ${rows}
      </div>
    `;
  }).join("");

  if (!any) {
    return `<div class="muted small">No parameters to show. Use variables like <code>a</code>, <code>b</code>, <code>c</code> in your equations, then click Render once.</div>`;
  }
  return out;
}

function updateParamSlidersUI() {
  if (!elParamSliders) return;
  elParamSliders.innerHTML = paramSlidersPanelHTML();
  bindParamControls(elParamSliders); // binds by data-eqid
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

      elEnabled.addEventListener("change", () => scheduleRender());

      elFigSel.addEventListener("change", (e) => { eq.fig = clampInt(e.target.value, 1, MAX_FIGS); scheduleRender(); });

      elXMode.addEventListener("change", (e) => {
        eq.xMode = e.target.value;
        elDsWrap.style.display = (eq.xMode === "dataset") ? "" : "none";
        scheduleRender();
      });

      if (elDsSel) {
        elDsSel.addEventListener("change", (e) => { eq.datasetId = e.target.value; scheduleRender(); });
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
        const nextRanges = {};
        for (const p of params) {
          next[p] = (eq.params && Object.prototype.hasOwnProperty.call(eq.params, p)) ? eq.params[p] : 1;
          // preserve ranges if the param existed
          if (eq.paramRanges && eq.paramRanges[p]) nextRanges[p] = eq.paramRanges[p];
        }
        eq.params = next;
        eq.paramRanges = nextRanges;
        eq.compiled = null; // recompile later
        elParams.innerHTML = paramInputsHTML(eq);

        bindParamControls(elParams, eq);
        updateParamSlidersUI();
        scheduleRender();
      }

      elExpr.addEventListener("change", refreshParamsFromExpr);
      elDetect.addEventListener("click", refreshParamsFromExpr);

      // bind existing param inputs/sliders
      bindParamControls(elParams, eq);

      elRemove.addEventListener("click", () => {
        state.eqs = state.eqs.filter(x => x.id !== id);
        updateEqUI();
        scheduleRender();
      });

      // Live update for eq expression changes
      elExpr.addEventListener("input", () => {
        // Don't re-detect params on every keystroke; just recompile on render.
        eq.expr = elExpr.value || "";
        eq.compiled = null;
        scheduleRender();
      });
    });
  
    updateParamSlidersUI();
}

  
function bindParamControls(container, eqOpt) {
  if (!container) return;

  function syncAll(eqid, key, nv) {
    const sel = `.tool2-param[data-eqid="${CSS.escape(eqid)}"][data-p="${CSS.escape(key)}"]`;
    document.querySelectorAll(sel).forEach((card) => {
      const slider = card.querySelector(".param-slider");
      const inp = card.querySelector(".param-val");
      const valText = card.querySelector(".param-valtext");
      if (inp) inp.value = fmt3(nv);
      if (valText) valText.textContent = fmt3(nv);
      if (slider) slider.value = nv;
    });
  }

  function syncRanges(eq, key, r) {
    const sel = `.tool2-param[data-eqid="${CSS.escape(eq.id)}"][data-p="${CSS.escape(key)}"]`;
    document.querySelectorAll(sel).forEach((card) => {
      const slider = card.querySelector(".param-slider");
      const rangeText = card.querySelector(".param-range");
      if (slider) {
        slider.min = r.min;
        slider.max = r.max;
        slider.step = Math.max(r.step || 0.001, 0.001);
      }
      if (rangeText) rangeText.textContent = `${fmt3(r.min)} ↔ ${fmt3(r.max)}`;
    });
  }

  container.querySelectorAll(".tool2-param").forEach((card) => {
    const key = card.getAttribute("data-p");
    const eqid = card.getAttribute("data-eqid");
    const eq = eqOpt || (eqid ? state.eqs.find((x) => x.id === eqid) : null);
    if (!eq || !key) return;

    const slider = card.querySelector(".param-slider");
    const inp = card.querySelector(".param-val");
    const btnRescale = card.querySelector(".param-rescale");

    function setVal(v) {
      const nv = round3(num(v, 1));
      eq.params[key] = nv;
      syncAll(eq.id, key, nv);
      scheduleRender();
    }

    if (slider) {
      slider.addEventListener("input", (e) => setVal(e.target.value));
    }
    if (inp) {
      inp.addEventListener("input", (e) => setVal(e.target.value));
    }
    if (btnRescale) {
      btnRescale.addEventListener("click", () => {
        const r = autoRangeFor(eq.params[key]);
        eq.paramRanges = eq.paramRanges || {};
        eq.paramRanges[key] = r;
        syncRanges(eq, key, r);
      });
    }
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
      row.querySelector(".fig-title").addEventListener("input", (e) => { m.title = e.target.value; scheduleRender(); });
      row.querySelector(".fig-xlab").addEventListener("input", (e) => { m.xlabel = e.target.value; scheduleRender(); });
      row.querySelector(".fig-ylab").addEventListener("input", (e) => { m.ylabel = e.target.value; scheduleRender(); });
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

      const eqd = document.createElement("div");
      eqd.id = `tool2EqDisp${i}`;
      eqd.className = "plot-eq";
      eqd.innerHTML = "<span class=\"muted small\">Equations will appear here after rendering.</span>";
      box.appendChild(eqd);

      elPlotGrid.appendChild(box);
    }
  }

  function updateEquationDisplays(n) {
    for (let i = 1; i <= n; i++) {
      const host = $(`tool2EqDisp${i}`);
      if (!host) continue;

      const eqs = state.eqs.filter(e => e.enabled && clampInt(e.fig || 1, 1, n) === i);
      if (!eqs.length) {
        host.innerHTML = "<span class=\"muted small\">No equation curves on this figure.</span>";
        continue;
      }

      const lines = eqs.map((e, idx) => {
        const params = e.params || {};
        const pkeys = Object.keys(params);
        const ptxt = pkeys.length
          ? pkeys.map(k => `${escapeHtml(k)}=${escapeHtml(fmt3(params[k]))}`).join(", ")
          : "";

        const label = e.name ? escapeHtml(e.name) : `Equation ${idx + 1}`;
        return `
          <div class="eq-row">
            <div class="eq-main"><span class="eq-name">${label}</span>: <code>f(x) = ${escapeHtml(e.expr)}</code></div>
            ${ptxt ? `<div class="eq-params muted small">${ptxt}</div>` : ""}
          </div>
        `;
      }).join("");

      host.innerHTML = lines;
    }
  }

  
// ---- Floating preview ----
function fillFloatFigOptions() {
  if (!elFloatFig) return;
  const n = clampInt(elFigCount.value, 1, MAX_FIGS);
  let out = "";
  for (let i = 1; i <= n; i++) {
    out += `<option value="${i}">Figure ${i}</option>`;
  }
  elFloatFig.innerHTML = out;
  // keep selected if possible
  const v = clampInt(state.float.fig || 1, 1, n);
  state.float.fig = v;
  elFloatFig.value = String(v);
}

function floatSetVisible(on) {
  if (!elFloatWin) return;
  elFloatWin.style.display = on ? "block" : "none";
}

function updateFloatEq(fig, n) {
  if (!elFloatEq) return;
  const N = n || clampInt(elFigCount.value, 1, MAX_FIGS);
  const eqs = (state.eqs || []).filter(e => e.enabled && clampInt(e.fig || 1, 1, N) === fig);
  if (!eqs.length) {
    elFloatEq.innerHTML = "<span class=\"muted small\">No equation curves on this figure.</span>";
    return;
  }
  const lines = eqs.map((e, idx) => {
    const params = e.params || {};
    const pkeys = Object.keys(params);
    const ptxt = pkeys.length ? pkeys.map(k => `${escapeHtml(k)}=${escapeHtml(fmt3(params[k]))}`).join(", ") : "";
    const label = e.name ? escapeHtml(e.name) : `Equation ${idx + 1}`;
    return `
      <div class="eq-row">
        <div class="eq-main"><span class="eq-name">${label}</span>: <code>f(x) = ${escapeHtml(e.expr)}</code></div>
        ${ptxt ? `<div class="eq-params muted small">${ptxt}</div>` : ""}
      </div>
    `;
  }).join("");
  elFloatEq.innerHTML = lines;
}

function renderFloatFromFigure(fig) {
  if (!elFloatPlot || !window.Plotly) return;
  const n = clampInt(elFigCount.value, 1, MAX_FIGS);
  fig = clampInt(fig, 1, n);

  const meta = state.figMeta[fig - 1] || { title: `Figure ${fig}`, xlabel: "x", ylabel: "y" };

  // Prefer our saved specs (most reliable)
  const spec = (state.plotSpecs && state.plotSpecs[fig - 1]) ? state.plotSpecs[fig - 1] : null;

  let data = [];
  let layout = {};

  if (spec && spec.traces && spec.layout) {
    data = (spec.traces || []).map(t => Object.assign({}, t));
    layout = JSON.parse(JSON.stringify(spec.layout || {}));
  } else {
    // Fallback: try to read from Plotly div (some builds don't expose div.data)
    const srcDiv = $(`tool2Fig${fig}`);
    const srcData = (srcDiv && (srcDiv.data || srcDiv._fullData)) ? (srcDiv.data || srcDiv._fullData) : [];
    const srcLayout = (srcDiv && (srcDiv.layout || srcDiv._fullLayout)) ? (srcDiv.layout || srcDiv._fullLayout) : {};
    data = (srcData || []).map(t => Object.assign({}, t));
    // Keep only the essential layout pieces to avoid cloning Plotly internals
    layout = {
      margin: srcLayout.margin,
      xaxis: srcLayout.xaxis,
      yaxis: srcLayout.yaxis,
      showlegend: srcLayout.showlegend,
      legend: srcLayout.legend
    };
  }

  // Enforce titles/labels from current UI
  layout = layout || {};
  layout.title = { text: meta.title || `Figure ${fig}` };
  layout.margin = layout.margin || { l: 60, r: 20, t: 45, b: 55 };
  layout.xaxis = layout.xaxis || {};
  layout.xaxis.title = { text: meta.xlabel || "x" };
  layout.yaxis = layout.yaxis || {};
  layout.yaxis.title = { text: meta.ylabel || "y" };
  layout.showlegend = !!(elShowLegend && elShowLegend.checked);
  layout.legend = layout.legend || { orientation: "h" };

  const config = { responsive: true, displaylogo: false };

  if (!data || !data.length) {
    // Placeholder (helps when user enables floating before first Render)
    const ph = {
      title: { text: meta.title || `Figure ${fig}` },
      margin: { l: 60, r: 20, t: 45, b: 55 },
      xaxis: { title: { text: meta.xlabel || "x" } },
      yaxis: { title: { text: meta.ylabel || "y" } },
      annotations: [{
        text: "Nothing to preview yet. Click Render to generate plots.",
        showarrow: false,
        x: 0.5, y: 0.5,
        xref: "paper", yref: "paper"
      }]
    };
    Plotly.react(elFloatPlot, [], ph, config);
  } else {
    Plotly.react(elFloatPlot, data, layout, config);
  }

  if (elFloatTitle) elFloatTitle.textContent = `Floating preview — Figure ${fig}`;
  updateFloatEq(fig, n);

  // resize after render
  setTimeout(() => { try { Plotly.Plots.resize(elFloatPlot); } catch(e){} }, 0);
}


function persistFloatGeometry() {
  if (!elFloatWin) return;
  const r = elFloatWin.getBoundingClientRect();
  state.float.left = Math.round(r.left);
  state.float.top  = Math.round(r.top);
  state.float.w    = Math.round(r.width);
  state.float.h    = Math.round(r.height);
  try { localStorage.setItem("tool2_float_geom", JSON.stringify(state.float)); } catch(e) {}
}

function restoreFloatGeometry() {
  if (!elFloatWin) return;
  try {
    const raw = localStorage.getItem("tool2_float_geom");
    if (!raw) return;
    const g = JSON.parse(raw);
    if (!g) return;
    if (typeof g.left === "number") { elFloatWin.style.left = g.left + "px"; elFloatWin.style.right = "auto"; }
    if (typeof g.top === "number")  { elFloatWin.style.top  = g.top + "px"; }
    if (typeof g.w === "number")    { elFloatWin.style.width  = g.w + "px"; }
    if (typeof g.h === "number")    { elFloatWin.style.height = g.h + "px"; }
    if (typeof g.fig === "number")  { state.float.fig = g.fig; }
    if (typeof g.enabled === "boolean") { state.float.enabled = g.enabled; }
  } catch(e) {}
}

function initFloatUI() {
  if (!elFloatToggle || !elFloatFig || !elFloatWin) return;

  restoreFloatGeometry();
  fillFloatFigOptions();

  elFloatToggle.checked = !!state.float.enabled;
  floatSetVisible(!!state.float.enabled);

  // figure select
  elFloatFig.addEventListener("change", () => {
    state.float.fig = clampInt(elFloatFig.value, 1, clampInt(elFigCount.value, 1, MAX_FIGS));
    persistFloatGeometry();
    if (state.float.enabled) renderFloatFromFigure(state.float.fig);
  });

  elFloatToggle.addEventListener("change", () => {
    state.float.enabled = !!elFloatToggle.checked;
    floatSetVisible(state.float.enabled);
    persistFloatGeometry();
    if (state.float.enabled) renderFloatFromFigure(state.float.fig);
  });

  if (elFloatClose) {
    elFloatClose.addEventListener("click", () => {
      state.float.enabled = false;
      elFloatToggle.checked = false;
      floatSetVisible(false);
      persistFloatGeometry();
    });
  }

  // Drag to move
  if (elFloatBar) {
    let dragging = false;
    let sx = 0, sy = 0, startLeft = 0, startTop = 0;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const onMove = (e) => {
      if (!dragging) return;
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      const cy = (e.touches ? e.touches[0].clientY : e.clientY);
      const dx = cx - sx;
      const dy = cy - sy;

      const vw = window.innerWidth, vh = window.innerHeight;
      const rect = elFloatWin.getBoundingClientRect();

      let nl = startLeft + dx;
      let nt = startTop + dy;

      // keep within viewport
      nl = clamp(nl, 6, vw - rect.width - 6);
      nt = clamp(nt, 6, vh - rect.height - 6);

      elFloatWin.style.left = nl + "px";
      elFloatWin.style.top = nt + "px";
      elFloatWin.style.right = "auto";

      e.preventDefault();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("tool2-float-dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove, { passive: false });
      window.removeEventListener("touchend", onUp);
      persistFloatGeometry();
    };

    const onDown = (e) => {
      // ignore if clicking close button
      if (e.target && e.target.id === "tool2FloatClose") return;

      const rect = elFloatWin.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      sx = (e.touches ? e.touches[0].clientX : e.clientX);
      sy = (e.touches ? e.touches[0].clientY : e.clientY);
      dragging = true;
      document.body.classList.add("tool2-float-dragging");
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
      e.preventDefault();
    };

    elFloatBar.addEventListener("mousedown", onDown);
    elFloatBar.addEventListener("touchstart", onDown, { passive: false });
  }

  // Resize observer to keep Plotly filling the window
  try {
    const ro = new ResizeObserver(() => {
      if (state.float.enabled && elFloatPlot && window.Plotly) {
        try { Plotly.Plots.resize(elFloatPlot); } catch(e) {}
        persistFloatGeometry();
      }
    });
    ro.observe(elFloatWin);
  } catch(e) {}
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
        showlegend: showLegend,
        legend: { orientation: "h" }
      };

      const config = { responsive: true, displaylogo: false };

      const traces = tracesByFig[i - 1];
      if (traces.length) renderedAny = true;

      // store spec for floating preview (do not rely on Plotly internal div fields)
      state.plotSpecs[i - 1] = {
        traces: (traces || []).map(t => Object.assign({}, t)),
        layout: JSON.parse(JSON.stringify(layout))
      };

      Plotly.react(div, traces, layout, config);
    }

    updateEquationDisplays(n);
    state.hasRendered = true;

    resizeAllPlots();

    if (state.float && state.float.enabled) {
      renderFloatFromFigure(state.float.fig || 1);
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
    state.hasRendered = false;
    state.plotSpecs = [];
    state._renderQueued = false;
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
    updateParamSlidersUI();
    fillFloatFigOptions();
    scheduleRender();
  });

  // Live update controls
  [elXMin, elXMax, elN].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", scheduleRender);
    el.addEventListener("change", scheduleRender);
  });
  if (elShowLegend) elShowLegend.addEventListener("change", scheduleRender);

  elRender.addEventListener("click", () => {
    try {
      renderPlots();
      state.hasRendered = true;

    resizeAllPlots();
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
  initFloatUI();
  setStatus("Tip: upload data, add an equation, then click “Render / Update plots”.");
})();