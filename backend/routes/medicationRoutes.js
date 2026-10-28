const express = require("express");
const {
  listMedications,
  createMedication,
  getMedication,
  updateMedication,
  deleteMedication,
} = require("../controllers/medicationController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth); // all medication endpoints are protected

router.get("/", listMedications);
router.post("/", createMedication);
router.get("/:id", getMedication);
router.put("/:id", updateMedication);
router.delete("/:id", deleteMedication);

module.exports = router;
