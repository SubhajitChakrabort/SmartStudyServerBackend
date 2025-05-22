const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/auth");

router.post("/create-order", paymentController.createOrder);
router.post("/capture-payment", paymentController.capturePayment);
router.get("/commission-report", authMiddleware, paymentController.getCommissionReport);

module.exports = router;
