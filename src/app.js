import { INTERVENTIONS, designId, normalizeConfig, runStudy } from "./engine.js";

const $ = selector => document.querySelector(selector);
const controls = ["training", "intervention", "fidelity", "seed", "replicates"].map(id => document.getElementById(id));
const state = { locked: false, currentRun: null, runs: [], toastTimer: null };

const labelForTraining = { paired: "Paired", unpaired: "Unpaired", reversed: "Reversed" };

function percent(value, places = 0) {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(places)}%`;
}

function signed(value, places = 1, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "—";
  const amount = value.toFixed(places);
  return `${value > 0 ? "+" : ""}${amount}${suffix}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function configFromControls() {
  return normalizeConfig({
    seed: $("#seed").value,
    replicates: $("#replicates").value,
    fidelity: $("#fidelity").value,
    training: $("#training").value,
    intervention: $("#intervention").value,
  });
}

function setControlsDisabled(disabled) {
  controls.forEach(control => { control.disabled = disabled; });
  $("#runStudy").disabled = disabled;
  $("#editProtocol").disabled = !disabled;
  $("#lockState").textContent = disabled ? "LOCKED" : "EDITABLE";
  $("#lockState").classList.toggle("locked", disabled);
}

function updateDesignLabels() {
  $("#fidelityOutput").value = `${$("#fidelity").value}%`;
  const hints = {
    head: "New head cells begin without the learned trace.",
    turnover: "Three matched cell positions are replaced with blank cells.",
    graft: "40% of each arm's memory carriers receive reversed trace from a yoked twin.",
    sham: "The organism is handled, but its tissue state stays intact.",
  };
  $("#interventionHint").textContent = hints[$("#intervention").value];
}

function resultMessage(run) {
  const { summary, config } = run;
  if (config.training === "unpaired") {
    return {
      title: "No cue association was trained",
      text: "The balanced unpaired schedule is the acquisition control. Choice differences here can arise from noise; memory-retention percentage is not defined for this condition.",
    };
  }
  const [low, high] = summary.choiceCI;
  if (low !== null && low > 0) {
    return {
      title: "Distributed arm favoured in this run",
      text: `Its paired choice advantage was ${signed(summary.choiceDelta * 100, 1, " pp")} (95% paired bootstrap interval ${signed(low * 100, 1)} to ${signed(high * 100, 1)} pp). This is a toy-model result for this protocol.`,
    };
  }
  if (high !== null && high < 0) {
    return {
      title: "Head-locked arm favoured in this run",
      text: `Its paired choice advantage was ${signed(-summary.choiceDelta * 100, 1, " pp")} (95% paired bootstrap interval ${signed(-high * 100, 1)} to ${signed(-low * 100, 1)} pp). This is a toy-model result for this protocol.`,
    };
  }
  return {
    title: "Paired interval overlaps zero",
    text: `Estimated choice difference: ${signed(summary.choiceDelta * 100, 1, " pp")} (distributed minus head-locked; 95% paired bootstrap interval ${signed(low * 100, 1)} to ${signed(high * 100, 1)} pp).`,
  };
}

function renderResults(run) {
  const summary = run.summary;
  const pairedSeeds = run.config.replicates;
  const message = resultMessage(run);
  $("#protocolId").textContent = `MOLT-${run.protocolId}`;
  $("#runStatus").className = `status-pill ${run.mode === "LOCKED" ? "locked" : ""}`;
  $("#runStatus").innerHTML = `<i></i> ${run.mode === "LOCKED" ? "LOCKED RUN" : "DEMO RUN"}`;
  $("#resultTitle").textContent = message.title;
  $("#resultText").textContent = message.text;
  $("#centralAccuracy").textContent = percent(summary.central.accuracy, 1);
  $("#distributedAccuracy").textContent = percent(summary.distributed.accuracy, 1);
  $("#retentionValue").innerHTML = run.config.training === "unpaired" || summary.distributed.retention === null
    ? `n/a<small></small>` : `${summary.distributed.retention.toFixed(0)}<small>%</small>`;
  $("#retentionDelta").textContent = run.config.training === "unpaired"
    ? "No learned association to retain" : `Distributed − head-locked: ${signed(summary.retentionDelta, 0, " pp")}`;
  $("#choiceValue").innerHTML = `${signed(summary.choiceDelta * 100, 1)}<small>pp</small>`;
  $("#choiceDelta").textContent = `95% CI ${signed(summary.choiceCI[0] * 100, 1)} to ${signed(summary.choiceCI[1] * 100, 1)} pp`;
  $("#survivalValue").innerHTML = `${(summary.distributed.survival * 100).toFixed(0)}<small>%</small>`;
  $("#survivalDelta").textContent = `Difference ${signed(summary.survivalDelta * 100, 1, " pp")}`;
  $("#seedValue").innerHTML = `${pairedSeeds}<small>n</small>`;
  $("#intervalText").textContent = `95% paired CI ${signed(summary.choiceCI[0] * 100, 1)}…${signed(summary.choiceCI[1] * 100, 1)} pp`;
  $("#calibrationValue").textContent = `H ${summary.central.brier.toFixed(3)} · D ${summary.distributed.brier.toFixed(3)}`;
  $("#auditText").textContent = `Brier score compares predicted choice success with observed choices (lower is closer). This internal forecast check is descriptive; it is not a consciousness or biological measure.`;
  const foodFound = arm => run.rows.filter(row => row.arm === arm).reduce((total, row) => total + row.foodFinds, 0);
  $("#worldCaption").textContent = `${run.config.fidelity}% cue stability · shared food found H ${foodFound("central")} / D ${foodFound("distributed")}`;
  $("#centralTag").textContent = INTERVENTIONS[run.config.intervention].label.toUpperCase();
  $("#distributedTag").textContent = INTERVENTIONS[run.config.intervention].label.toUpperCase();
  drawChart(run.exposureProfile);
  drawTissue(run.tissue);
  drawWorlds(run);
}

function drawChart(profile) {
  const width = 460;
  const height = 122;
  const left = 31;
  const right = 7;
  const top = 8;
  const bottom = 20;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yMin = 0.25;
  const yMax = 1;
  const x = index => left + (index / 23) * plotWidth;
  const y = value => top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const series = [
    { key: "central", color: "#9be3aa", title: "Head-locked" },
    { key: "distributed", color: "#84b9ed", title: "Distributed" },
  ];
  const grid = [0.25, 0.5, 0.75, 1].map(value => `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#29372f" stroke-width="1"/><text x="${left - 6}" y="${y(value) + 3}" text-anchor="end" fill="#738177" font-size="8" font-family="DM Mono, monospace">${Math.round(value * 100)}</text>`).join("");
  const paths = series.map(({ key, color, title }) => {
    const values = profile[key].filter(point => point.accuracy !== null);
    if (!values.length) return "";
    const points = values.map(point => `${x(point.exposure - 1)},${y(point.accuracy)}`).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(values.at(-1).exposure - 1)}" cy="${y(values.at(-1).accuracy)}" r="3" fill="${color}"><title>${title}: ${percent(values.at(-1).accuracy, 1)} on exposure ${values.at(-1).exposure}</title></circle>`;
  }).join("");
  $("#accuracyChart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chartTitle chartDesc"><title id="chartTitle">Choice accuracy over test exposures</title><desc id="chartDesc">Head-locked and distributed memory arms share matched seeds. Accuracy is shown from 25 to 100 percent.</desc>${grid}<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#415047"/><text x="${left}" y="${height - 3}" fill="#738177" font-size="8" font-family="DM Mono, monospace">1</text><text x="${width - right}" y="${height - 3}" text-anchor="end" fill="#738177" font-size="8" font-family="DM Mono, monospace">24 exposures</text>${paths}</svg>`;
}

function drawTissue(tissue) {
  for (const arm of ["central", "distributed"]) {
    const target = document.getElementById(`${arm}Cells`);
    const summary = tissue[arm];
    target.replaceChildren(...summary.cells.map((cell, index) => {
      const element = document.createElement("i");
      element.className = "cell";
      if (!cell.alive) element.classList.add("lost");
      else if (cell.regrown) element.classList.add("regrown");
      else if (cell.signal > 0.08) element.classList.add("trace-positive");
      else if (cell.signal < -0.08) element.classList.add("trace-negative");
      element.setAttribute("aria-label", `Cell ${index + 1}: ${cell.regrown ? "newly regrown" : cell.replaced ? "grafted" : "retained"}, trace ${cell.signal.toFixed(2)}`);
      return element;
    }));
    const trace = summary.traces.reduce((sum, value) => sum + value, 0) / summary.traces.length;
    document.getElementById(`${arm}Trace`).textContent = signed(trace, 2);
  }
}

function hashSeed(seed, index) {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 4_294_967_296;
}

function paintWorld(canvas, run, arm) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(240, Math.round(rect.width * ratio));
  const height = Math.max(90, Math.round(rect.height * ratio));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const w = rect.width;
  const h = rect.height;
  const colors = arm === "central"
    ? { trace: "#9be3aa", glow: "#72ce88" }
    : { trace: "#84b9ed", glow: "#6da9dd" };
  ctx.clearRect(0, 0, w, h);
  const background = ctx.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, "#17241b");
  background.addColorStop(1, "#101713");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#26362b";
  ctx.lineWidth = 1;
  for (let layer = 0; layer < 3; layer += 1) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = h * (0.28 + layer * 0.25) + Math.sin(x * 0.025 + layer + run.config.seed * 0.0002) * (5 + layer * 2) + Math.cos(x * 0.012 + layer) * 3;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 13; i += 1) {
    const px = 12 + hashSeed(run.config.seed, i) * (w - 24);
    const py = 12 + hashSeed(run.config.seed ^ 0x6a09e667, i) * (h - 24);
    const resource = i % 3 !== 0;
    ctx.beginPath();
    ctx.arc(px, py, resource ? 2.4 : 2.7, 0, Math.PI * 2);
    ctx.fillStyle = resource ? "#9bdca2" : "#ea8b76";
    ctx.globalAlpha = 0.54 + hashSeed(run.config.seed + 41, i) * 0.35;
    ctx.fill();
    if (resource) {
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.strokeStyle = "#81bd8946"; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const accuracy = run.summary[arm].accuracy ?? 0.5;
  const tissue = run.tissue[arm];
  const startX = 16;
  const endX = Math.max(startX + 10, w - 18);
  const mainY = h * 0.52;
  const pathLength = Math.max(2, Math.round(3 + accuracy * 10));
  ctx.beginPath();
  for (let i = 0; i < pathLength; i += 1) {
    const x = startX + (endX - startX) * (i / 12);
    const y = mainY + Math.sin(i * 0.92 + run.config.seed * 0.003) * 8 + Math.cos(i * 0.39) * 3;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `${colors.trace}50`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  const position = Math.max(0.08, Math.min(0.92, 0.14 + accuracy * 0.72));
  const organismX = startX + (endX - startX) * position;
  const organismY = mainY + Math.sin(pathLength * 0.75 + run.config.seed * 0.004) * 8;
  const live = tissue.cells.filter(cell => cell.alive);
  const cellCount = Math.min(7, Math.max(3, live.length));
  for (let i = cellCount - 1; i >= 0; i -= 1) {
    const t = cellCount === 1 ? 0 : i / (cellCount - 1);
    ctx.beginPath();
    ctx.arc(organismX - t * 4.4, organismY + Math.sin(i * 1.5) * 2.4, i === 0 ? 4 : 3.1, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "#d5e9cf" : colors.trace;
    ctx.shadowBlur = i === 0 ? 10 : 4;
    ctx.shadowColor = colors.glow;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#aab8ab";
  ctx.font = "9px DM Mono, monospace";
  ctx.fillText(`${Math.round(accuracy * 100)}% choices correct`, 8, h - 8);
}

function drawWorlds(run) {
  paintWorld($("#centralCanvas"), run, "central");
  paintWorld($("#distributedCanvas"), run, "distributed");
}

function rowFromResult(run, row) {
  const mode = run.mode ?? "LOCKED";
  return {
    ...row,
    mode,
    note: `${labelForTraining[run.config.training]} training ${INTERVENTIONS[run.config.intervention].label} ${run.config.fidelity}% fidelity ${mode}`,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function rowMatches(row, query) {
  const tokens = query.trim().match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const fields = {
    arm: row.arm === "central" ? "head-locked central" : "distributed body-wide",
    seed: String(row.seed),
    intervention: `${row.intervention} ${row.interventionEvent}`,
    training: row.training,
    fate: row.fate,
  };
  const searchable = `${row.protocolId} ${row.seed} ${row.arm} ${row.layout} ${row.intervention} ${row.interventionEvent} ${row.training} ${row.fate} ${row.note}`.toLowerCase();
  return tokens.every(rawToken => {
    const token = rawToken.replace(/^"|"$/g, "");
    const separator = token.indexOf(":");
    if (separator < 0) return searchable.includes(token.toLowerCase());
    const field = token.slice(0, separator).toLowerCase();
    const value = token.slice(separator + 1).toLowerCase();
    if (!Object.hasOwn(fields, field)) return searchable.includes(token.toLowerCase());
    return fields[field].toLowerCase().includes(value);
  });
}

function renderLedger() {
  const allRows = state.runs.flatMap(run => run.rows.map(row => rowFromResult(run, row))).reverse();
  const query = $("#ledgerSearch").value;
  const visible = allRows.filter(row => rowMatches(row, query)).slice(0, 80);
  const tbody = $("#ledgerBody");
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No records match this filter.</td></tr>`;
  } else {
    tbody.innerHTML = visible.map(row => {
      const fateClass = row.fate === "alive" ? "fate-alive" : row.fate === "mixed" ? "fate-mixed" : "fate-extinct";
      const retention = row.retention === null ? "n/a" : `${row.retention.toFixed(0)}%`;
      const retentionClass = row.retention === null ? "" : row.retention < 0 ? "retention-negative" : "retention-positive";
      return `<tr><td class="seed-cell">${escapeHtml(row.protocolId.slice(0, 4))} · ${row.seed.toLocaleString()}</td><td><span class="arm-cell"><i class="legend-dot ${row.arm === "central" ? "central-dot" : "distributed-dot"}"></i>${row.arm === "central" ? "Head-locked" : "Distributed"}</span></td><td><span class="memory-chip">${row.layout}</span></td><td>${INTERVENTIONS[row.intervention].label} · ${labelForTraining[row.training]}</td><td class="retention-cell ${retentionClass}">${retention}</td><td class="choice-cell">${percent(row.accuracy, 1)}</td><td><span class="fate-pill ${fateClass}">${row.fate}</span></td></tr>`;
    }).join("");
  }
  $("#ledgerCount").textContent = `${visible.length} of ${allRows.length} records`;
}

function setRunProgress(completed, total) {
  const status = $("#runStatus");
  status.className = "status-pill running";
  status.innerHTML = `<i></i> ${Math.round((completed / total) * 100)}% · ${completed}/${total} PAIRS`;
}

async function startRun(config, mode) {
  $("#runStudy").disabled = true;
  $("#editProtocol").disabled = true;
  $("#runStudy").innerHTML = `<span>Running paired worlds…</span><span class="button-arrow">◌</span>`;
  $("#runStatus").className = "status-pill running";
  $("#runStatus").innerHTML = `<i></i> PREPARING`;
  try {
    const result = await runStudy(config, progress => setRunProgress(progress.completed, progress.total));
    result.mode = mode;
    state.currentRun = result;
    state.runs.push(result);
    renderResults(result);
    renderLedger();
    $("#runStudy").innerHTML = `<span>Protocol locked</span><span class="button-arrow">✓</span>`;
    showToast(`${result.config.replicates} paired seeds recorded · ${result.organismCount} synthetic organisms`);
  } catch (error) {
    console.error(error);
    state.locked = false;
    $("#runStatus").className = "status-pill";
    $("#runStatus").innerHTML = `<i></i> RUN FAILED`;
    showToast("The run could not be completed. The protocol remains available to edit.");
    setControlsDisabled(false);
  } finally {
    $("#runStudy").disabled = state.locked;
    $("#editProtocol").disabled = !state.locked;
    if (!state.locked) $("#runStudy").innerHTML = `<span>Lock protocol &amp; run</span><span class="button-arrow">→</span>`;
  }
}

function download(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!state.currentRun) return showToast("There is no study result to export yet.");
  const exportRecord = {
    project: "MOLT — Memory Ecology Lab",
    recordVersion: 1,
    simVersion: state.currentRun.simVersion,
    mode: state.currentRun.mode,
    protocolId: state.currentRun.protocolId,
    config: state.currentRun.config,
    generatedAt: state.currentRun.generatedAt,
    organismCount: state.currentRun.organismCount,
    summary: state.currentRun.summary,
    seedResults: state.currentRun.rows,
    exposureProfile: state.currentRun.exposureProfile,
    interpretationBoundary: "Synthetic toy model. Results are not biological evidence, clinical evidence, or a consciousness measure.",
    idBoundary: "protocolId is an 8-digit, non-cryptographic design fingerprint.",
  };
  download(`molt-${state.currentRun.protocolId.toLowerCase()}.json`, `${JSON.stringify(exportRecord, null, 2)}\n`, "application/json");
}

function exportCsv() {
  const rows = state.runs.flatMap(run => run.rows.map(row => rowFromResult(run, row)));
  if (!rows.length) return showToast("There are no ledger records to export yet.");
  const columns = ["protocolId", "mode", "seed", "replicate", "arm", "layout", "training", "intervention", "interventionEvent", "fidelity", "retention", "retentionValid", "accuracy", "survival", "brier", "energy", "organisms", "correctChoices", "totalChoices", "fate"];
  const quote = value => {
    const string = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
  };
  const csv = [columns.join(","), ...rows.map(row => columns.map(column => quote(row[column])).join(","))].join("\r\n");
  download("molt-experiment-ledger.csv", `${csv}\r\n`, "text/csv;charset=utf-8");
}

function bindEvents() {
  $("#fidelity").addEventListener("input", updateDesignLabels);
  $("#intervention").addEventListener("change", updateDesignLabels);
  $("#ledgerSearch").addEventListener("input", renderLedger);
  $("#exportJson").addEventListener("click", exportJson);
  $("#exportCsv").addEventListener("click", exportCsv);
  $("#runStudy").addEventListener("click", () => {
    const config = configFromControls();
    $("#seed").value = String(config.seed);
    $("#protocolId").textContent = `MOLT-${designId(config)}`;
    state.locked = true;
    setControlsDisabled(true);
    startRun(config, "LOCKED");
  });
  $("#editProtocol").addEventListener("click", () => {
    state.locked = false;
    setControlsDisabled(false);
    $("#runStudy").innerHTML = `<span>Lock protocol &amp; run</span><span class="button-arrow">→</span>`;
    $("#runStatus").className = "status-pill";
    $("#runStatus").innerHTML = `<i></i> EDITING`;
    updateDesignLabels();
    showToast("A new protocol is ready. Prior runs remain in the ledger.");
  });
  window.addEventListener("resize", () => { if (state.currentRun) drawWorlds(state.currentRun); });
}

async function initialize() {
  bindEvents();
  $("#runStudy").disabled = true;
  updateDesignLabels();
  const demoConfig = normalizeConfig({ seed: 82_417, replicates: 8, fidelity: 90, training: "paired", intervention: "head", noise: 0.05 });
  $("#seed").value = String(demoConfig.seed);
  $("#replicates").value = String(demoConfig.replicates);
  $("#fidelity").value = String(demoConfig.fidelity);
  $("#fidelityOutput").value = `${demoConfig.fidelity}%`;
  $("#protocolId").textContent = `MOLT-${designId(demoConfig)}`;
  const demo = await runStudy(demoConfig);
  demo.mode = "DEMO";
  state.currentRun = demo;
  state.runs.push(demo);
  renderResults(demo);
  renderLedger();
  $("#runStatus").className = "status-pill";
  $("#runStatus").innerHTML = `<i></i> DEMO RUN`;
  $("#runStudy").disabled = false;
}

initialize();
