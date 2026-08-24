const form = document.getElementById("medication-form");
const nameInput = document.getElementById("med-name");
const doseInput = document.getElementById("med-dose");
const frequencySelect = document.getElementById("med-frequency");
const startTimeInput = document.getElementById("med-start-time");
const gapSelect = document.getElementById("med-gap");
const formError = document.getElementById("form-error");
const formTitle = document.getElementById("form-title");
const saveBtn = document.getElementById("save-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const medicationListEl = document.getElementById("medication-list");
const noMedicationsMsg = document.getElementById("no-medications-msg");

const conflictListEl = document.getElementById("conflict-list");
const noConflictsMsg = document.getElementById("no-conflicts-msg");

const scheduleEl = document.getElementById("schedule");

const generateBtn = document.getElementById("generate-btn");
const generatedScheduleEl = document.getElementById("generated-schedule");

const currentUserLabel = document.getElementById("current-user-label");
const logoutBtn = document.getElementById("logout-btn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

let medications = [];
let editingMedicationId = null;

const STORAGE_KEY = "medications_" + getCurrentUser();

function loadMedicationsFromStorage() {
  let saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    medications = JSON.parse(saved);
  } else {
    medications = [];
  }
}

function saveMedicationsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
}

function twoDigits(number) {
  if (number < 10) {
    return "0" + number;
  }
  return String(number);
}

function timeStringToMinutes(timeStr) {
  let parts = timeStr.split(":");
  let hours = Number(parts[0]);
  let minutes = Number(parts[1]);
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
  let normalized = totalMinutes % 1440;
  if (normalized < 0) {
    normalized = normalized + 1440;
  }
  let hours = Math.floor(normalized / 60);
  let minutes = normalized % 60;
  return twoDigits(hours) + ":" + twoDigits(minutes);
}

function computeDoseTimes(frequency, startTime) {
  let gapMinutes = 1440 / frequency;
  let startMinutes = timeStringToMinutes(startTime);
  let doseTimes = [];

  for (let i = 0; i < frequency; i++) {
    doseTimes.push(minutesToTimeString(startMinutes + i * gapMinutes));
  }

  return doseTimes;
}

function circularGapHours(timeA, timeB) {
  let minutesA = timeStringToMinutes(timeA);
  let minutesB = timeStringToMinutes(timeB);
  let diff = Math.abs(minutesA - minutesB);
  let shortestDiff = diff;
  if (1440 - diff < shortestDiff) {
    shortestDiff = 1440 - diff;
  }
  return shortestDiff / 60;
}

const TAKEN_KEY = "takenDoses_" + getCurrentUser();
let takenDoses = [];

function getTodayDateString() {
  let today = new Date();
  let year = today.getFullYear();
  let month = twoDigits(today.getMonth() + 1);
  let day = twoDigits(today.getDate());
  return year + "-" + month + "-" + day;
}

function loadTakenFromStorage() {
  let saved = localStorage.getItem(TAKEN_KEY);

  if (saved) {
    let data = JSON.parse(saved);
    if (data.date === getTodayDateString()) {
      takenDoses = data.doses;
      return;
    }
  }

  takenDoses = [];
  saveTakenToStorage();
}

function saveTakenToStorage() {
  let data = { date: getTodayDateString(), doses: takenDoses };
  localStorage.setItem(TAKEN_KEY, JSON.stringify(data));
}

function isDoseTaken(key) {
  return takenDoses.indexOf(key) !== -1;
}

function toggleDoseTaken(key) {
  if (isDoseTaken(key)) {
    let updated = [];
    for (let i = 0; i < takenDoses.length; i++) {
      if (takenDoses[i] !== key) {
        updated.push(takenDoses[i]);
      }
    }
    takenDoses = updated;
  } else {
    takenDoses.push(key);
  }

  saveTakenToStorage();
}

const FALLBACK_RULES = [
  { drugA: "Aspirin", drugB: "Ibuprofen", minGapHours: 4, note: "Taking these too close together raises the risk of stomach irritation." },
  { drugA: "Calcium", drugB: "Iron", minGapHours: 2, note: "Calcium can block the body from absorbing iron if taken at the same time." },
  { drugA: "Levothyroxine", drugB: "Calcium", minGapHours: 4, note: "Calcium can reduce how well Levothyroxine is absorbed." },
  { drugA: "Levothyroxine", drugB: "Iron", minGapHours: 4, note: "Iron can reduce how well Levothyroxine is absorbed." },
  { drugA: "Ciprofloxacin", drugB: "Calcium", minGapHours: 2, note: "Calcium can reduce how well this antibiotic is absorbed." },
  { drugA: "Warfarin", drugB: "Aspirin", minGapHours: 6, note: "Both thin the blood, so taking them close together raises bleeding risk." }
];

let interactionRules = [];

function findRuleConflicts() {
  let conflicts = [];

  for (let r = 0; r < interactionRules.length; r++) {
    let rule = interactionRules[r];

    let medA = null;
    let medB = null;

    for (let m = 0; m < medications.length; m++) {
      let med = medications[m];
      if (med.name.toLowerCase() === rule.drugA.toLowerCase()) {
        medA = med;
      }
      if (med.name.toLowerCase() === rule.drugB.toLowerCase()) {
        medB = med;
      }
    }

    if (medA === null || medB === null) {
      continue;
    }

    for (let i = 0; i < medA.doseTimes.length; i++) {
      for (let j = 0; j < medB.doseTimes.length; j++) {
        let timeA = medA.doseTimes[i];
        let timeB = medB.doseTimes[j];
        let gap = circularGapHours(timeA, timeB);

        if (gap < rule.minGapHours) {
          conflicts.push({
            medA: medA.name,
            medB: medB.name,
            timeA: timeA,
            timeB: timeB,
            gap: gap,
            requiredGap: rule.minGapHours,
            note: rule.note
          });
        }
      }
    }
  }

  return conflicts;
}

function findCustomGapConflicts() {
  let conflicts = [];

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      let medA = medications[i];
      let medB = medications[j];

      let gapA = 0;
      if (medA.customGapHours) {
        gapA = medA.customGapHours;
      }
      let gapB = 0;
      if (medB.customGapHours) {
        gapB = medB.customGapHours;
      }

      let requiredGap = gapA;
      if (gapB > requiredGap) {
        requiredGap = gapB;
      }

      if (requiredGap <= 0) {
        continue;
      }

      for (let a = 0; a < medA.doseTimes.length; a++) {
        for (let b = 0; b < medB.doseTimes.length; b++) {
          let timeA = medA.doseTimes[a];
          let timeB = medB.doseTimes[b];
          let gap = circularGapHours(timeA, timeB);

          if (gap < requiredGap) {
            conflicts.push({
              medA: medA.name,
              medB: medB.name,
              timeA: timeA,
              timeB: timeB,
              gap: gap,
              requiredGap: requiredGap,
              note: "Custom spacing rule: needs at least " + requiredGap + "h between doses."
            });
          }
        }
      }
    }
  }

  return conflicts;
}

function findConflicts() {
  let ruleConflicts = findRuleConflicts();
  let customConflicts = findCustomGapConflicts();
  let allConflicts = [];

  for (let i = 0; i < ruleConflicts.length; i++) {
    allConflicts.push(ruleConflicts[i]);
  }
  for (let j = 0; j < customConflicts.length; j++) {
    allConflicts.push(customConflicts[j]);
  }

  return allConflicts;
}

function getFlaggedDoseList(conflicts) {
  let flagged = [];

  for (let i = 0; i < conflicts.length; i++) {
    let c = conflicts[i];
    let keyA = c.medA + "|" + c.timeA;
    let keyB = c.medB + "|" + c.timeB;

    if (flagged.indexOf(keyA) === -1) {
      flagged.push(keyA);
    }
    if (flagged.indexOf(keyB) === -1) {
      flagged.push(keyB);
    }
  }

  return flagged;
}

function isDoseFlagged(flaggedList, key) {
  return flaggedList.indexOf(key) !== -1;
}

function getDosesForHour(hour) {
  let doses = [];

  for (let i = 0; i < medications.length; i++) {
    let med = medications[i];
    for (let j = 0; j < med.doseTimes.length; j++) {
      let time = med.doseTimes[j];
      let doseHour = Number(time.split(":")[0]);
      if (doseHour === hour) {
        doses.push({ id: med.id, name: med.name, time: time, dose: med.dose });
      }
    }
  }

  return doses;
}

function createDoseTag(dose, flaggedDoses) {
  let tag = document.createElement("span");
  let key = dose.name + "|" + dose.time;

  if (isDoseFlagged(flaggedDoses, key)) {
    tag.className = "dose-tag conflict";
  } else {
    tag.className = "dose-tag";
  }

  tag.textContent = dose.name + " " + dose.dose + " (" + dose.time + ")";
  return tag;
}

function createDoseRow(dose, flaggedDoses) {
  let row = document.createElement("div");
  row.className = "dose-row";

  let tag = createDoseTag(dose, flaggedDoses);

  let takenKey = dose.id + "|" + dose.time;
  let taken = isDoseTaken(takenKey);

  let status = document.createElement("span");
  if (taken) {
    status.className = "dose-status taken";
    status.textContent = "Taken";
  } else {
    status.className = "dose-status pending";
    status.textContent = "Pending";
  }

  let toggleBtn = document.createElement("button");
  toggleBtn.className = "taken-toggle-btn";
  if (taken) {
    toggleBtn.textContent = "Mark as Pending";
  } else {
    toggleBtn.textContent = "Mark as Taken";
  }
  toggleBtn.addEventListener("click", function () {
    toggleDoseTaken(takenKey);
    renderAll();
  });

  row.appendChild(tag);
  row.appendChild(status);
  row.appendChild(toggleBtn);

  return row;
}

function renderMedicationList() {
  medicationListEl.innerHTML = "";

  if (medications.length === 0) {
    noMedicationsMsg.style.display = "block";
  } else {
    noMedicationsMsg.style.display = "none";
  }

  for (let i = 0; i < medications.length; i++) {
    let med = medications[i];
    let li = document.createElement("li");

    let gapText = "";
    if (med.customGapHours > 0) {
      gapText = " &middot; custom gap: " + med.customGapHours + "h";
    }

    let info = document.createElement("div");
    info.className = "med-info";
    info.innerHTML =
      "<strong>" + med.name + "</strong> - " + med.dose +
      "<div class='med-details'>" +
      med.frequency + "x/day &middot; times: " + med.doseTimes.join(", ") + gapText +
      "</div>";

    let editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "edit-btn";
    editBtn.addEventListener("click", function () {
      startEditMedication(med.id);
    });

    let deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", function () {
      deleteMedication(med.id);
    });

    let buttonGroup = document.createElement("div");
    buttonGroup.className = "med-buttons";
    buttonGroup.appendChild(editBtn);
    buttonGroup.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(buttonGroup);
    medicationListEl.appendChild(li);
  }
}

function renderConflicts(conflicts) {
  conflictListEl.innerHTML = "";

  if (conflicts.length === 0) {
    noConflictsMsg.style.display = "block";
  } else {
    noConflictsMsg.style.display = "none";
  }

  for (let i = 0; i < conflicts.length; i++) {
    let c = conflicts[i];
    let li = document.createElement("li");
    li.textContent =
      c.medA + " (" + c.timeA + ") and " + c.medB + " (" + c.timeB + ") are only " +
      c.gap.toFixed(1) + "h apart - needs at least " + c.requiredGap + "h. " + c.note;
    conflictListEl.appendChild(li);
  }
}

function renderSchedule(conflicts) {
  scheduleEl.innerHTML = "";
  let flaggedDoses = getFlaggedDoseList(conflicts);

  for (let hour = 0; hour < 24; hour++) {
    let dosesThisHour = getDosesForHour(hour);
    if (dosesThisHour.length === 0) {
      continue;
    }

    let row = document.createElement("div");
    row.className = "schedule-row";

    let hourEl = document.createElement("div");
    hourEl.className = "schedule-hour";
    hourEl.textContent = twoDigits(hour) + ":00";

    let dosesEl = document.createElement("div");
    dosesEl.className = "schedule-doses";

    for (let i = 0; i < dosesThisHour.length; i++) {
      dosesEl.appendChild(createDoseRow(dosesThisHour[i], flaggedDoses));
    }

    row.appendChild(hourEl);
    row.appendChild(dosesEl);
    scheduleEl.appendChild(row);
  }

  if (medications.length === 0) {
    scheduleEl.innerHTML = "<p class='muted' style='padding:10px;'>Add a medication to see its schedule.</p>";
  }
}

function renderGeneratedSchedule() {
  let conflicts = findConflicts();
  let flaggedDoses = getFlaggedDoseList(conflicts);

  generatedScheduleEl.innerHTML = "";

  if (medications.length === 0) {
    generatedScheduleEl.innerHTML = "<p class='muted' style='padding:10px;'>Add a medication first, then generate the schedule.</p>";
    return;
  }

  for (let hour = 0; hour < 24; hour++) {
    let dosesThisHour = getDosesForHour(hour);

    let row = document.createElement("div");
    if (dosesThisHour.length === 0) {
      row.className = "schedule-row empty-hour";
    } else {
      row.className = "schedule-row";
    }

    let hourEl = document.createElement("div");
    hourEl.className = "schedule-hour";
    hourEl.textContent = twoDigits(hour) + ":00";

    let dosesEl = document.createElement("div");
    dosesEl.className = "schedule-doses";

    if (dosesThisHour.length === 0) {
      dosesEl.textContent = "—";
    } else {
      for (let i = 0; i < dosesThisHour.length; i++) {
        dosesEl.appendChild(createDoseTag(dosesThisHour[i], flaggedDoses));
      }
    }

    row.appendChild(hourEl);
    row.appendChild(dosesEl);
    generatedScheduleEl.appendChild(row);
  }
}

function renderAll() {
  let conflicts = findConflicts();
  renderMedicationList();
  renderConflicts(conflicts);
  renderSchedule(conflicts);
}

function deleteMedication(id) {
  let remaining = [];
  for (let i = 0; i < medications.length; i++) {
    if (medications[i].id !== id) {
      remaining.push(medications[i]);
    }
  }
  medications = remaining;

  saveMedicationsToStorage();
  renderAll();

  if (editingMedicationId === id) {
    cancelEdit();
  }
}

function startEditMedication(id) {
  let med = null;
  for (let i = 0; i < medications.length; i++) {
    if (medications[i].id === id) {
      med = medications[i];
    }
  }

  if (med === null) {
    return;
  }

  editingMedicationId = id;

  nameInput.value = med.name;
  doseInput.value = med.dose;
  frequencySelect.value = String(med.frequency);
  startTimeInput.value = med.startTime;

  let gapValue = med.customGapHours;
  if (!gapValue) {
    gapValue = 0;
  }
  gapSelect.value = String(gapValue);

  formTitle.textContent = "Edit Medication";
  saveBtn.textContent = "Update Medication";
  cancelEditBtn.classList.remove("hidden");
  formError.textContent = "";

  switchTab("tab-add");
  nameInput.focus();
}

function cancelEdit() {
  editingMedicationId = null;
  form.reset();
  formTitle.textContent = "Add a Medication";
  saveBtn.textContent = "Add Medication";
  cancelEditBtn.classList.add("hidden");
  formError.textContent = "";
}

cancelEditBtn.addEventListener("click", cancelEdit);

form.addEventListener("submit", function (event) {
  event.preventDefault();

  let name = nameInput.value.trim();
  let dose = doseInput.value.trim();
  let frequency = Number(frequencySelect.value);
  let startTime = startTimeInput.value;
  let customGapHours = Number(gapSelect.value);

  if (!name) {
    formError.textContent = "Please enter a medication name.";
    return;
  }
  if (!dose) {
    formError.textContent = "Please enter a dose (e.g. 500mg).";
    return;
  }
  if (!startTime) {
    formError.textContent = "Please choose a first dose time.";
    return;
  }

  if (editingMedicationId) {
    let med = null;
    for (let i = 0; i < medications.length; i++) {
      if (medications[i].id === editingMedicationId) {
        med = medications[i];
      }
    }
    med.name = name;
    med.dose = dose;
    med.frequency = frequency;
    med.startTime = startTime;
    med.customGapHours = customGapHours;
    med.doseTimes = computeDoseTimes(frequency, startTime);
  } else {
    medications.push({
      id: Date.now(),
      name: name,
      dose: dose,
      frequency: frequency,
      startTime: startTime,
      customGapHours: customGapHours,
      doseTimes: computeDoseTimes(frequency, startTime)
    });
  }

  saveMedicationsToStorage();
  renderAll();
  cancelEdit();
});

function switchTab(tabId) {
  for (let i = 0; i < tabButtons.length; i++) {
    let btn = tabButtons[i];
    if (btn.dataset.tab === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  for (let i = 0; i < tabPanels.length; i++) {
    let panel = tabPanels[i];
    if (panel.id === tabId) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  }
}

for (let i = 0; i < tabButtons.length; i++) {
  let btn = tabButtons[i];
  btn.addEventListener("click", function () {
    switchTab(btn.dataset.tab);
  });
}

generateBtn.addEventListener("click", renderGeneratedSchedule);

function init() {
  currentUserLabel.textContent = "Logged in as " + getCurrentUser();
  logoutBtn.addEventListener("click", logout);

  loadMedicationsFromStorage();
  loadTakenFromStorage();

  fetch("rules.json")
    .then(function (response) {
      return response.json();
    })
    .then(function (rules) {
      interactionRules = rules;
      renderAll();
    })
    .catch(function () {
      interactionRules = FALLBACK_RULES;
      renderAll();
    });
}

init();
