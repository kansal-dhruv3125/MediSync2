const mongoose = require("mongoose");
const Medication = require("../models/Medication");

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FREQUENCY_MIN = 1;
const FREQUENCY_MAX = 4;
const GAP_MAX = 12;

/**
 * Recomputes the derived doseTimes list from frequency + startTime,
 * matching the frontend's computeDoseTimes() logic (24h cycle).
 */
function computeDoseTimes(frequency, startTime) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  const gapMinutes = Math.floor(1440 / frequency);

  const pad = (n) => (n < 10 ? "0" + n : String(n));
  const fmt = (m) => {
    const normalized = ((m % 1440) + 1440) % 1440;
    return pad(Math.floor(normalized / 60)) + ":" + pad(normalized % 60);
  };

  const times = [];
  for (let i = 0; i < frequency; i++) {
    times.push(fmt(startMinutes + i * gapMinutes));
  }
  return times;
}

/**
 * Whitelists allowed input fields and validates values.
 * Prevents mass assignment (e.g. clients cannot set userId or unknown fields).
 */
function parseMedicationInput(body) {
  const errors = [];
  const input = {};

  const isCreate = arguments.length > 2 ? arguments[2] : false;

  if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Request body must be a JSON object.");
    return { errors, input: null };
  }

  if (body.name !== undefined) {
    input.name = String(body.name).trim();
    if (!input.name) errors.push("Medication name is required.");
    else if (input.name.length > 100) errors.push("Medication name must be at most 100 characters.");
  }

  if (body.dose !== undefined) {
    input.dose = String(body.dose).trim();
    if (!input.dose) errors.push("Dose is required.");
    else if (input.dose.length > 50) errors.push("Dose must be at most 50 characters.");
  }

  if (body.frequency !== undefined) {
    const frequency = Number(body.frequency);
    if (!Number.isInteger(frequency) || frequency < FREQUENCY_MIN || frequency > FREQUENCY_MAX) {
      errors.push("Frequency must be an integer between 1 and 4.");
    } else {
      input.frequency = frequency;
    }
  }

  if (body.startTime !== undefined) {
    const startTime = String(body.startTime).trim();
    if (!TIME_PATTERN.test(startTime)) {
      errors.push('First dose time must be in 24h "HH:MM" format.');
    } else {
      input.startTime = startTime;
    }
  }

  if (body.customGapHours !== undefined) {
    const gap = Number(body.customGapHours);
    if (!Number.isInteger(gap) || gap < 0 || gap > GAP_MAX) {
      errors.push("Custom gap must be an integer between 0 and 12.");
    } else {
      input.customGapHours = gap;
    }
  }

  if (body.notes !== undefined) {
    input.notes = String(body.notes).trim();
    if (input.notes.length > 500) errors.push("Notes must be at most 500 characters.");
  }

  return { errors, input };
}

async function listMedications(req, res, next) {
  try {
    const medications = await Medication.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      message: "Medications loaded.",
      data: { medications },
    });
  } catch (err) {
    return next(err);
  }
}

async function createMedication(req, res, next) {
  try {
    const { errors, input } = parseMedicationInput(req.body, true);

    for (const required of ["name", "dose", "frequency", "startTime"]) {
      if (input[required] === undefined) {
        errors.push(
          required === "dose" ? "Dose is required." :
          required === "startTime" ? 'First dose time is required (24h "HH:MM" format).' :
          `Medication ${required} is required.`
        );
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed.", errors });
    }

    const medication = await Medication.create({
      ...input,
      userId: req.user.id, // set server-side only, never from the request body
      doseTimes: computeDoseTimes(input.frequency, input.startTime),
    });

    return res.status(201).json({
      success: true,
      message: "Medication added.",
      data: { medication },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Resolves the medication owned by the authenticated user, or null.
 * Users can only access their own records.
 */
async function findOwnedMedication(userId, id) {
  if (!mongoose.isValidObjectId(id)) {
    return { invalidId: true, medication: null };
  }
  const medication = await Medication.findOne({ _id: id, userId });
  return { invalidId: false, medication };
}

async function getMedication(req, res, next) {
  try {
    const { invalidId, medication } = await findOwnedMedication(req.user.id, req.params.id);

    if (invalidId) {
      return res.status(400).json({ success: false, message: "Invalid medication ID." });
    }
    if (!medication) {
      return res.status(404).json({ success: false, message: "Medication not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Medication loaded.",
      data: { medication },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateMedication(req, res, next) {
  try {
    const { invalidId, medication } = await findOwnedMedication(req.user.id, req.params.id);

    if (invalidId) {
      return res.status(400).json({ success: false, message: "Invalid medication ID." });
    }
    if (!medication) {
      return res.status(404).json({ success: false, message: "Medication not found." });
    }

    const { errors, input } = parseMedicationInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed.", errors });
    }

    // Apply whitelisted fields only
    for (const [key, value] of Object.entries(input)) {
      medication[key] = value;
    }

    if (input.name !== undefined && input.name === "") {
      return res.status(400).json({ success: false, message: "Validation failed.", errors: ["Medication name is required."] });
    }
    if (input.dose !== undefined && input.dose === "") {
      return res.status(400).json({ success: false, message: "Validation failed.", errors: ["Dose is required."] });
    }

    // Keep the derived schedule consistent with the (possibly new) schedule inputs
    medication.doseTimes = computeDoseTimes(medication.frequency, medication.startTime);

    await medication.save();

    return res.status(200).json({
      success: true,
      message: "Medication updated.",
      data: { medication },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteMedication(req, res, next) {
  try {
    const { invalidId, medication } = await findOwnedMedication(req.user.id, req.params.id);

    if (invalidId) {
      return res.status(400).json({ success: false, message: "Invalid medication ID." });
    }
    if (!medication) {
      return res.status(404).json({ success: false, message: "Medication not found." });
    }

    await medication.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Medication deleted.",
      data: { id: medication.id },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listMedications,
  createMedication,
  getMedication,
  updateMedication,
  deleteMedication,
};
