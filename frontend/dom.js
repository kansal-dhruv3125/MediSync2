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
