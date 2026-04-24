const LOG_DEFINITIONS = [
  {
    id: "temperatureHumidity",
    name: "Temperature/Humidity Log",
    areaDefault: "Pharmacy",
    spec: "Temperature 68°F-77°F and humidity <60%",
    measurements: [
      { id: "temperature", label: "Room temperature", unit: "°F", min: 68, max: 77 },
      { id: "humidity", label: "Humidity", unit: "%", min: null, max: 59.999 }
    ]
  },
  {
    id: "differentialPressure",
    name: "Differential Pressure Log",
    areaDefault: "Cleanroom",
    spec: "Normal range -0.01 to -0.03 in H2O",
    measurements: [
      { id: "amPressure", label: "AM pressure", unit: "in H2O", min: -0.03, max: -0.01 },
      { id: "pmPressure", label: "PM pressure", unit: "in H2O", min: -0.03, max: -0.01 }
    ]
  },
  {
    id: "refrigerator",
    name: "Refrigerator Temperature Log",
    areaDefault: "Storage",
    spec: "Normal range 36°F-46°F",
    measurements: [
      { id: "refrigeratorTemp", label: "Refrigerator temperature", unit: "°F", min: 36, max: 46 }
    ]
  },
  {
    id: "freezer",
    name: "Freezer Temperature Log",
    areaDefault: "Storage",
    spec: "Normal range -13°F to 14°F",
    measurements: [
      { id: "freezerTemp", label: "Freezer temperature", unit: "°F", min: -13, max: 14 }
    ]
  },
  {
    id: "eyewash",
    name: "Eyewash Station Log",
    areaDefault: "Lab",
    spec: "Pathway clear, eyewash unobstructed, clear water flow, no leaks",
    measurements: [
      { id: "pathClear", label: "Pathway clear", type: "boolean" },
      { id: "stationClear", label: "Eyewash unobstructed", type: "boolean" },
      { id: "clearWater", label: "Clear water flows", type: "boolean" },
      { id: "noLeaks", label: "No leaks present", type: "boolean" },
      { id: "expiration", label: "Expiration", type: "date" }
    ]
  }
];

const STORAGE_KEY = "temperatureLoggingEntries";
const DRAFT_KEY = "temperatureLoggingDraft";
const SETTINGS_KEY = "temperatureLoggingSettings";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  entries: readJson(STORAGE_KEY, []),
  settings: readJson(SETTINGS_KEY, { scriptUrl: "" })
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
  $("#saveSettings").addEventListener("click", saveSettings);
  $("#testSettings").addEventListener("click", sendTestPing);
  $("#refreshDashboard").addEventListener("click", refreshFromSheet);

  ["filterStart", "filterEnd", "filterArea", "filterStatus", "filterLog", "filterEmployee"].forEach((id) => {
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
    if (field.classList.contains("log-enabled")) field.checked = !isNA;
    if (field.matches("input, select, textarea") && !field.classList.contains("log-enabled")) {
      field.required = !isNA && !field.closest(".log-card").querySelector(".log-enabled").checked ? false : !isNA;
    }
  });
  handleConditionalRequirements();
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
    area: $("#area").value,
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
  $("#area").value = draft.area || "";
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
  ["Pharmacy", "Storage", "Cleanroom", "Lab", "Other"].forEach((area) => areaSelect.append(new Option(area, area)));
  const logSelect = $("#filterLog");
  LOG_DEFINITIONS.forEach((log) => logSelect.append(new Option(log.name, log.name)));
}

function renderDashboard() {
  const rows = $("#dashboardRows");
  const entries = filteredEntries();
  rows.innerHTML = "";

  entries.forEach((entry) => {
    const tr = document.createElement("tr");
    const includedLogs = entry.logs.filter((log) => log.included).map((log) => log.name).join(", ") || "None";
    const notes = [entry.dateChangeNote, entry.naComment, ...entry.logs.map((log) => log.notes)].filter(Boolean).join(" | ");
    tr.innerHTML = `
      <td>${escapeHtml(entry.documentedDate)}</td>
      <td>${escapeHtml(entry.submittedDate)}</td>
      <td>${escapeHtml(entry.area)}</td>
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
    if (area && entry.area !== area) return false;
    if (status && entry.status !== status) return false;
    if (employee && !entry.employee.toLowerCase().includes(employee)) return false;
    if (logName && !entry.logs.some((log) => log.included && log.name === logName)) return false;
    return true;
  });
}

function switchView(viewId) {
  $$(".tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewId));
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  if (viewId === "dashboardView") renderDashboard();
}

function saveSettings() {
  state.settings.scriptUrl = $("#scriptUrl").value.trim();
  writeJson(SETTINGS_KEY, state.settings);
  $("#syncStatus").textContent = "Settings saved";
}

function sendTestPing() {
  saveSettings();
  postToSheet({ action: "testPing", message: "Temperature Logging Checklist test ping" });
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
