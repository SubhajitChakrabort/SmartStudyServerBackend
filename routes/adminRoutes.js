const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Fetch pending verifications (non-regular students with unverified offer letters)
router.get("/pending-verifications", adminController.getPendingVerifications);

// Verify a non-regular student
router.put("/verify-student/:studentId", adminController.verifyStudent);

// Fetch admin profile data with pending verification count
router.get("/profile", adminController.getAdminProfile);

router.get("/download-offer-letter/:studentId", adminController.downloadOfferLetter);
router.get('/download-employee-proof/:studentId', adminController.downloadEmployeeProof);

module.exports = router;