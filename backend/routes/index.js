const express = require("express");

const authRoutes = require("./authRoutes");
const medicationRoutes = require("./medicationRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/medications", medicationRoutes);

module.exports = router;
