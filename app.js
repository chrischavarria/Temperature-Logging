const DEFAULT_SCRIPT_URL = "";

const TEMPERATURE_HUMIDITY_LOCATIONS = [
  "Front Hallway",
  "Tablet Room",
  "Capsule Room",
  "Back Hallway",
  "Base Storage",
  "Fulfillment Area",
  "Non-HD Lab",
  "Packing Area",
  "HD Lab",
  "Receiving Area"
];

const REFRIGERATOR_LOCATIONS = [
  "Non-HD Lab Fridge",
  "HD Lab Fridge",
  "Receiving Fridge"
];

const FREEZER_LOCATIONS = [
  "Non-HD Lab Freezer"
];

const EYEWASH_LOCATIONS = [
  "Non-HD Lab",
  "HD Lab"
];

const AREA_OPTIONS = [
  ...TEMPERATURE_HUMIDITY_LOCATIONS,
  "Differential Pressure",
  ...REFRIGERATOR_LOCATIONS,
  ...FREEZER_LOCATIONS,
  ...EYEWASH_LOCATIONS
];

const makeId = (prefix, location) => `${prefix}_${location.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

const LOG_DEFINITIONS = [
  ...TEMPERATURE_HUMIDITY_LOCATIONS.map((location) => ({
    id: makeId("temperatureHumidity", location),
    name: `${location} Temperature/Humidity Log`,
    group: "Temperature/Humidity",
    location,
    spec: "Temperature 68°F-77°F and humidity <60%",
    measurements: [
      { id: "temperature", label: `${location} temperature`, unit: "°F", min: 68, max: 77 },
      { id: "humidity", label: `${location} humidity`, unit: "%", min: null, max: 59.999 }
    ]
  })),
  {
    id: "differentialPressure_am",
    name: "AM Differential Pressure Log",
    group: "Differential Pressure",
    location: "Differential Pressure",
    spec: "Morning recording, normal range -0.01 to -0.03 in H2O",
    measurements: [
      { id: "amPressure", label: "AM pressure", unit: "in H2O", min: -0.03, max: -0.01 }
    ]
  },
  {
    id: "differentialPressure_pm",
    name: "PM Differential Pressure Log",
    group: "Differential Pressure",
    location: "Differential Pressure",
    spec: "Evening recording, normal range -0.01 to -0.03 in H2O",
    measurements: [
      { id: "pmPressure", label: "PM pressure", unit: "in H2O", min: -0.03, max: -0.01 }
    ]
  },
  ...REFRIGERATOR_LOCATIONS.map((location) => ({
    id: makeId("refrigerator", location),
    name: `${location} Temperature Log`,
    group: "Refrigerator",
    location,
    spec: "Normal range 36°F-46°F",
    measurements: [
      { id: "refrigeratorTemp", label: `${location} temperature`, unit: "°F", min: 36, max: 46 }
    ]
  })),
  ...FREEZER_LOCATIONS.map((location) => ({
    id: makeId("freezer", location),
    name: `${location} Temperature Log`,
    group: "Freezer",
    location,
    spec: "Normal range -13°F to 14°F",
    measurements: [
      { id: "freezerTemp", label: `${location} temperature`, unit: "°F", min: -13, max: 14 }
    ]
  })),
  ...EYEWASH_LOCATIONS.map((location) => ({
    id: makeId("eyewash", location),
    name: `${location} Eyewash Station Log`,
    group: "Eyewash",
    location,
    spec: "Pathway clear, eyewash unobstructed, clear water flow, no leaks",
    measurements: [
      { id: "pathClear", label: "Pathway clear", type: "boolean" },
      { id: "stationClear", label: "Eyewash unobstructed", type: "boolean" },
      { id: "clearWater", label: "Clear water flows", type: "boolean" },
      { id: "noLeaks", label: "No leaks present", type: "boolean" },
      { id: "expiration", label: "Expiration", type: "date" }
    ]
  }))
];

const STORAGE_KEY = "temperatureLoggingEntries";
const DRAFT_KEY = "temperatureLoggingDraft";
const SETTINGS_KEY = "temperatureLoggingSettings";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  entries: readJson(STORAGE_KEY, []),
  settings: {
    scriptUrl: DEFAULT_SCRIPT_URL,
    ...readJson(SETTINGS_KEY, {})
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates();
  renderLogs();
  renderFilterOptions();
  bindEvents();
  loadDraft();
  renderDashboard();
  $("#scriptUrl").value = state.settings.scriptUrl || "";
});

function bindEvents() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $("#entryForm").addEventListener("input", () => {
    handleConditionalRequirements();
    updateOutOfSpecState();
  });
  $("#entryForm").addEventListener("change", () => {
    handleConditionalRequirements();
    updateOutOfSpecState();
  });
  $("#entryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submitEntry("Complete");
  });
  $("#submitInProcess").addEventListener("click", () => submitEntry("In Process"));
  $("#saveDraft").addEventListener("click", saveDraft);
  $("#markNA").addEventListener("change", toggleNAState);
  $("#includeAllLogs").addEventListener("click", () => setIncludedLogs("all"));
  $("#clearIncludedLogs").addEventListener("click", () => setIncludedLogs("none"));
  $("#pmPressureOnly").addEventListener("click", () => setIncludedLogs("pmPressureOnly"));
  $("#saveSettings").addEventListener("click", saveSettings);
  $("#testSettings").addEventListener("click", sendTestPing);
  $("#refreshDashboard").addEventListener("click", refreshFromSheet);

  ["filterStart", "filterEnd", "filterArea", "filterStatus", "filterLog", "filterEmployee", "filterMetric"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderDashboard);
  });
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  $("#documentedDate").value = today;
  $("#submittedDate").value = today;
}

function renderLogs() {
  const template = $("#logTemplate");
  const list = $("#logList");
  list.innerHTML = "";

  LOG_DEFINITIONS.forEach((log) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.logId = log.id;
    $("h3", node).textContent = log.name;
    $(".spec", node).textContent = log.spec;
    $(".log-notes", node).name = `${log.id}_notes`;
    $(".log-enabled", node).name = `${log.id}_enabled`;

    const measurements = $(".measurement-list", node);
    log.measurements.forEach((measurement) => {
      measurements.appendChild(createMeasurementRow(log, measurement));
    });
    $(".log-notes", node).placeholder = "Required. Enter N/A if there are no notes.";
    $(".log-notes", node).required = true;

    list.appendChild(node);
  });
}

function createMeasurementRow(log, measurement) {
  const row = document.createElement("div");
  row.className = "measurement-row";
  row.dataset.measurementId = measurement.id;

  const valueLabel = document.createElement("label");
  valueLabel.textContent = measurement.label;

  let input;
  if (measurement.type === "boolean") {
    input = document.createElement("select");
    input.innerHTML = `<option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option>`;
  } else if (measurement.type === "date") {
    input = document.createElement("input");
    input.type = "date";
  } else {
    input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.inputMode = "decimal";
  }
  input.name = `${log.id}_${measurement.id}`;
  input.required = true;
  input.dataset.logId = log.id;
  input.dataset.measurementId = measurement.id;
  valueLabel.appendChild(input);

  const range = document.createElement("div");
  range.className = "range-pill";
  range.textContent = describeRange(measurement);

  const responseLabel = document.createElement("label");
  responseLabel.textContent = "Acceptable response";
  const response = document.createElement("input");
  response.name = `${log.id}_${measurement.id}_response`;
  response.value = acceptableResponse(measurement);
  response.required = true;
  responseLabel.appendChild(response);

  const result = document.createElement("div");
  result.className = "result-pill neutral";
  result.textContent = "Pending";
  result.dataset.resultFor = `${log.id}_${measurement.id}`;

  row.append(valueLabel, range, responseLabel, result);
  return row;
}

function describeRange(measurement) {
  if (measurement.type === "boolean") return "Required: Yes";
  if (measurement.type === "date") return "Current/unexpired";
  if (measurement.min !== null && measurement.max !== null) return `${measurement.min} to ${measurement.max} ${measurement.unit}`;
  if (measurement.max !== null) return `< ${Math.ceil(measurement.max)} ${measurement.unit}`;
  return "Required";
}

function acceptableResponse(measurement) {
  if (measurement.type === "boolean") return "Yes";
  if (measurement.type === "date") return "Not expired";
  return describeRange(measurement);
}

function handleConditionalRequirements() {
  const documented = $("#documentedDate").value;
  const submitted = $("#submittedDate").value;
  const dateChanged = documented && submitted && documented !== submitted;
  $("#dateChangeNoteWrap").classList.toggle("is-hidden", !dateChanged);
  $("#dateChangeNote").required = dateChanged;

  const isNA = $("#markNA").checked;
  $("#naCommentWrap").classList.toggle("is-hidden", !isNA);
  $("#naComment").required = isNA;
}

function toggleNAState() {
  const isNA = $("#markNA").checked;
  $$("#logList input, #logList select, #logList textarea").forEach((field) => {
    field.disabled = isNA;
    if (field.classList.contains("log-enabled") && isNA) field.checked = false;
    if (field.matches("input, select, textarea") && !field.classList.contains("log-enabled")) {
      field.required = !isNA && !field.closest(".log-card").querySelector(".log-enabled").checked ? false : !isNA;
    }
  });
  handleConditionalRequirements();
  updateOutOfSpecState();
}

function setIncludedLogs(mode) {
  $("#markNA").checked = false;
  $$(".log-enabled").forEach((checkbox) => {
    const card = checkbox.closest(".log-card");
    if (mode === "all") checkbox.checked = true;
    if (mode === "none") checkbox.checked = false;
    if (mode === "pmPressureOnly") checkbox.checked = card.dataset.logId === "differentialPressure_pm";
  });
  toggleNAState();
  updateOutOfSpecState();
}

function updateOutOfSpecState() {
  const isNA = $("#markNA").checked;
  let hasOutOfSpec = false;

  LOG_DEFINITIONS.forEach((log) => {
    const card = $(`[data-log-id="${log.id}"]`);
    const enabled = $(".log-enabled", card).checked && !isNA;
    updateLogCardState(card, enabled);

    log.measurements.forEach((measurement) => {
      const input = $(`[name="${log.id}_${measurement.id}"]`);
      const pill = $(`[data-result-for="${log.id}_${measurement.id}"]`);
      input.required = enabled;
      $(`[name="${log.id}_${measurement.id}_response"]`).required = enabled;

      if (!enabled || !input.value) {
        setPill(pill, "Pending", "neutral");
        return;
      }

      const inSpec = isMeasurementInSpec(measurement, input.value);
      setPill(pill, inSpec ? "WNL" : "Out of spec", inSpec ? "good" : "bad");
      if (!inSpec) hasOutOfSpec = true;
    });
  });

  $("#outOfSpecPanel").classList.toggle("is-hidden", !hasOutOfSpec || isNA);
  $("#submitInProcess").classList.toggle("is-hidden", !hasOutOfSpec || isNA);
  $("#submitComplete").disabled = hasOutOfSpec && !isNA;
  $("#supervisorAcknowledged").required = hasOutOfSpec && !isNA;
}

function updateLogCardState(card, enabled) {
  $$("input, select, textarea", card).forEach((field) => {
    if (field.classList.contains("log-enabled")) return;
    field.disabled = !enabled;
    field.required = enabled;
  });
}

function isMeasurementInSpec(measurement, rawValue) {
  if (measurement.type === "boolean") return rawValue === "Yes";
  if (measurement.type === "date") return new Date(rawValue) >= startOfToday();
  const value = Number(rawValue);
  if (Number.isNaN(value)) return false;
  if (measurement.min !== null && value < measurement.min) return false;
  if (measurement.max !== null && value > measurement.max) return false;
  return true;
}

function setPill(pill, text, className) {
  pill.textContent = text;
  pill.className = `result-pill ${className}`;
}

function collectEntry(status) {
  const isNA = $("#markNA").checked;
  const logs = LOG_DEFINITIONS.map((log) => {
    const card = $(`[data-log-id="${log.id}"]`);
    const enabled = $(".log-enabled", card).checked && !isNA;
    const measurements = log.measurements.map((measurement) => {
      const value = $(`[name="${log.id}_${measurement.id}"]`).value;
      return {
        id: measurement.id,
        label: measurement.label,
        value,
        unit: measurement.unit || "",
        acceptable: $(`[name="${log.id}_${measurement.id}_response"]`).value,
        result: enabled && value ? (isMeasurementInSpec(measurement, value) ? "WNL" : "Out of Spec") : "Not Recorded"
      };
    });

    return {
      id: log.id,
      name: log.name,
      group: log.group,
      location: log.location,
      spec: log.spec,
      included: enabled,
      notes: $(".log-notes", card).value,
      measurements
    };
  });

  const outOfSpec = logs.some((log) => log.measurements.some((measurement) => measurement.result === "Out of Spec"));
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    employee: $("#employee").value.trim(),
    initials: $("#initials").value.trim(),
    documentedDate: $("#documentedDate").value,
    completionTime: $("#completionTime").value,
    submittedDate: $("#submittedDate").value,
    area: "Daily Facility Check",
    status: isNA ? "N/A" : status,
    dateChangeNote: $("#dateChangeNote").value.trim(),
    naComment: $("#naComment").value.trim(),
    supervisorAcknowledged: $("#supervisorAcknowledged").checked,
    outOfSpec,
    logs
  };
}

function submitEntry(status) {
  handleConditionalRequirements();
  updateOutOfSpecState();

  const entry = collectEntry(status);
  if (!$("#markNA").checked && !entry.logs.some((log) => log.included)) {
    $("#syncStatus").textContent = "Select at least one checklist item or mark the day N/A";
    $("#logList").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (status === "Complete" && entry.outOfSpec && !$("#markNA").checked) {
    $("#outOfSpecPanel").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (status === "In Process" && !$("#supervisorAcknowledged").checked) {
    $("#supervisorAcknowledged").focus();
    return;
  }

  if (!$("#entryForm").reportValidity()) return;

  state.entries.unshift(entry);
  writeJson(STORAGE_KEY, state.entries);
  localStorage.removeItem(DRAFT_KEY);
  postToSheet({ action: "saveEntry", entry });
  $("#syncStatus").textContent = "Saved locally";
  $("#entryForm").reset();
  setDefaultDates();
  toggleNAState();
  renderDashboard();
}

function saveDraft() {
  const entry = collectEntry("Draft");
  localStorage.setItem(DRAFT_KEY, JSON.stringify(entry));
  $("#syncStatus").textContent = "Draft saved";
}

function loadDraft() {
  const draft = readJson(DRAFT_KEY, null);
  if (!draft) return;

  $("#employee").value = draft.employee || "";
  $("#initials").value = draft.initials || "";
  $("#documentedDate").value = draft.documentedDate || $("#documentedDate").value;
  $("#completionTime").value = draft.completionTime || "";
  $("#submittedDate").value = draft.submittedDate || $("#submittedDate").value;
  $("#markNA").checked = draft.status === "N/A";
  $("#dateChangeNote").value = draft.dateChangeNote || "";
  $("#naComment").value = draft.naComment || "";

  draft.logs?.forEach((log) => {
    const card = $(`[data-log-id="${log.id}"]`);
    if (!card) return;
    $(".log-enabled", card).checked = log.included;
    $(".log-notes", card).value = log.notes || "";
    log.measurements.forEach((measurement) => {
      const field = $(`[name="${log.id}_${measurement.id}"]`);
      const response = $(`[name="${log.id}_${measurement.id}_response"]`);
      if (field) field.value = measurement.value || "";
      if (response) response.value = measurement.acceptable || response.value;
    });
  });

  toggleNAState();
  updateOutOfSpecState();
}

function renderFilterOptions() {
  const areaSelect = $("#filterArea");
  [...new Set(AREA_OPTIONS)].forEach((area) => areaSelect.append(new Option(area, area)));
  const logSelect = $("#filterLog");
  LOG_DEFINITIONS.forEach((log) => logSelect.append(new Option(log.name, log.name)));
  const metricSelect = $("#filterMetric");
  const metrics = [...new Set(LOG_DEFINITIONS.flatMap((log) => log.measurements)
    .filter((measurement) => !measurement.type)
    .map((measurement) => metricKey(measurement.label)))];
  metrics.forEach((metric) => metricSelect.append(new Option(toTitleCase(metric), metric)));
}

function renderDashboard() {
  const rows = $("#dashboardRows");
  const entries = filteredEntries();
  rows.innerHTML = "";

  entries.forEach((entry) => {
    const tr = document.createElement("tr");
    const includedLogs = entry.logs.filter((log) => log.included).map((log) => log.name).join(", ") || "None";
    const locations = entry.logs.filter((log) => log.included).map((log) => log.location || locationFromLog(log)).filter(Boolean);
    const notes = [entry.dateChangeNote, entry.naComment, ...entry.logs.map((log) => log.notes)].filter(Boolean).join(" | ");
    tr.innerHTML = `
      <td>${escapeHtml(entry.documentedDate)}</td>
      <td>${escapeHtml(entry.submittedDate)}</td>
      <td>${escapeHtml([...new Set(locations)].join(", ") || entry.area)}</td>
      <td>${escapeHtml(entry.employee)}</td>
      <td>${escapeHtml(entry.status)}</td>
      <td>${escapeHtml(includedLogs)}</td>
      <td>${escapeHtml(notes)}</td>
    `;
    rows.appendChild(tr);
  });

  $("#metricTotal").textContent = entries.length;
  $("#metricComplete").textContent = entries.filter((entry) => entry.status === "Complete").length;
  $("#metricInProcess").textContent = entries.filter((entry) => entry.status === "In Process").length;
  $("#metricOutOfSpec").textContent = entries.filter((entry) => entry.outOfSpec).length;
  renderTrendChart(entries);
}

function filteredEntries() {
  const start = $("#filterStart").value;
  const end = $("#filterEnd").value;
  const area = $("#filterArea").value;
  const status = $("#filterStatus").value;
  const logName = $("#filterLog").value;
  const employee = $("#filterEmployee").value.trim().toLowerCase();

  return state.entries.filter((entry) => {
    if (start && entry.documentedDate < start) return false;
    if (end && entry.documentedDate > end) return false;
    if (area && !entryHasLocation(entry, area)) return false;
    if (status && entry.status !== status) return false;
    if (employee && !entry.employee.toLowerCase().includes(employee)) return false;
    if (logName && !entry.logs.some((log) => log.included && log.name === logName)) return false;
    return true;
  });
}

function entryHasLocation(entry, location) {
  return entry.logs.some((log) => log.included && (log.location === location || locationFromLog(log) === location));
}

function flattenMeasurements(entries) {
  const metric = $("#filterMetric").value;
  return entries.flatMap((entry) => entry.logs
    .filter((log) => log.included)
    .flatMap((log) => log.measurements.map((measurement) => ({
      date: entry.documentedDate,
      employee: entry.employee,
      logName: log.name,
      location: log.location || locationFromLog(log),
      label: measurement.label,
      metric: metricKey(measurement.label),
      value: Number(measurement.value),
      result: measurement.result
    }))))
    .filter((point) => Number.isFinite(point.value))
    .filter((point) => !metric || point.metric === metric);
}

function renderTrendChart(entries) {
  const canvas = $("#trendChart");
  const ctx = canvas.getContext("2d");
  const points = flattenMeasurements(entries).sort((a, b) => a.date.localeCompare(b.date));
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 24, right: 24, bottom: 52, left: 62 };
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#687b86";
    ctx.font = "16px sans-serif";
    ctx.fillText("No numeric measurements match the current filters.", padding.left, height / 2);
    $("#chartSummary").textContent = "No numeric measurements match the current filters.";
    return;
  }

  const values = points.map((point) => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const dates = [...new Set(points.map((point) => point.date))];
  const xFor = (date) => {
    if (dates.length === 1) return (padding.left + width - padding.right) / 2;
    return padding.left + (dates.indexOf(date) / (dates.length - 1)) * (width - padding.left - padding.right);
  };
  const yFor = (value) => height - padding.bottom - ((value - min) / (max - min)) * (height - padding.top - padding.bottom);

  drawChartAxes(ctx, width, height, padding, min, max, dates);

  const series = groupBy(points, (point) => `${point.location} - ${toTitleCase(point.metric)}`);
  const colors = ["#182d3a", "#4f8e6b", "#a96a24", "#6d7f89", "#a43333", "#7e9f34"];
  [...series.entries()].slice(0, 8).forEach(([name, seriesPoints], index) => {
    ctx.strokeStyle = colors[index % colors.length];
    ctx.fillStyle = colors[index % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    seriesPoints.forEach((point, pointIndex) => {
      const x = xFor(point.date);
      const y = yFor(point.value);
      if (pointIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    seriesPoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(xFor(point.date), yFor(point.value), 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = "12px sans-serif";
    ctx.fillText(name, padding.left + 8, padding.top + 16 + index * 18);
  });

  $("#chartSummary").textContent = `${points.length} numeric measurement${points.length === 1 ? "" : "s"} shown. Showing up to 8 series at once.`;
}

function drawChartAxes(ctx, width, height, padding, min, max, dates) {
  ctx.strokeStyle = "#d7e2e4";
  ctx.fillStyle = "#687b86";
  ctx.lineWidth = 1;
  ctx.font = "12px sans-serif";

  for (let i = 0; i <= 4; i += 1) {
    const value = min + ((max - min) * i) / 4;
    const y = height - padding.bottom - (i / 4) * (height - padding.top - padding.bottom);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(1), 10, y + 4);
  }

  const shownDates = dates.length > 6 ? dates.filter((_, index) => index % Math.ceil(dates.length / 6) === 0) : dates;
  shownDates.forEach((date) => {
    const x = dates.length === 1 ? (padding.left + width - padding.right) / 2 : padding.left + (dates.indexOf(date) / (dates.length - 1)) * (width - padding.left - padding.right);
    ctx.fillText(date.slice(5), x - 16, height - 20);
  });
}

function groupBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function metricKey(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes("humidity")) return "humidity";
  if (normalized.includes("pressure")) return "pressure";
  if (normalized.includes("temperature")) return "temperature";
  return normalized;
}

function locationFromLog(log) {
  return LOG_DEFINITIONS.find((definition) => definition.id === log.id)?.location || log.name.replace(/ (Temperature\/Humidity|Temperature|Eyewash Station|Differential Pressure) Log$/, "");
}

function toTitleCase(value) {
  return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function switchView(viewId) {
  $$(".tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewId));
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  if (viewId === "dashboardView") renderDashboard();
}

function saveSettings() {
  state.settings.scriptUrl = $("#scriptUrl").value.trim() || DEFAULT_SCRIPT_URL;
  writeJson(SETTINGS_KEY, state.settings);
  $("#syncStatus").textContent = "Settings saved";
}

function sendTestPing() {
  saveSettings();
  if (!state.settings.scriptUrl) return;
  const callbackName = `temperatureLoggingPing_${Date.now()}`;
  window[callbackName] = (payload) => {
    $("#syncStatus").textContent = payload.ok ? "Endpoint connected" : "Endpoint test failed";
    delete window[callbackName];
    script.remove();
  };
  const script = document.createElement("script");
  script.onerror = () => {
    $("#syncStatus").textContent = "Endpoint test failed";
    delete window[callbackName];
    script.remove();
  };
  script.src = `${state.settings.scriptUrl}?action=testPing&callback=${callbackName}`;
  document.body.appendChild(script);
}

function refreshFromSheet() {
  if (!state.settings.scriptUrl) {
    renderDashboard();
    return;
  }
  const callbackName = `temperatureLoggingCallback_${Date.now()}`;
  window[callbackName] = (payload) => {
    if (Array.isArray(payload.entries)) {
      const merged = new Map();
      payload.entries.concat(state.entries).forEach((entry) => merged.set(entry.id, entry));
      state.entries = [...merged.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      writeJson(STORAGE_KEY, state.entries);
      renderDashboard();
    }
    delete window[callbackName];
    script.remove();
  };
  const script = document.createElement("script");
  script.src = `${state.settings.scriptUrl}?action=listEntries&callback=${callbackName}`;
  document.body.appendChild(script);
}

function postToSheet(payload) {
  if (!state.settings.scriptUrl) return;
  fetch(state.settings.scriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then(() => {
    $("#syncStatus").textContent = "Sent to Sheet";
  }).catch(() => {
    $("#syncStatus").textContent = "Saved locally; Sheet sync failed";
  });
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
