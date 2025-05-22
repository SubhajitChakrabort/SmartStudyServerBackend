const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../config/db"); // Import your database connection

const razorpay = new Razorpay({
  key_id: "rzp_test_mFFaw12AfREkru", // Replace with your Razorpay key
  key_secret: "9e3RFXcJc0KijB84mtr3ZPQD", // Replace with your Razorpay secret
});

// Create an order
const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: amount * 100, // Amount in paise (e.g., ₹23.10 = 2310 paise)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

//Capture payment
const capturePayment = async (req, res) => {
  try {
    const { order_id, payment_id, signature, userId, amount } = req.body;

    // Verify the signature
    const generatedSignature = crypto
      .createHmac("sha256", "9e3RFXcJc0KijB84mtr3ZPQD")
      .update(`${order_id}|${payment_id}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid signature",
      });
    }

    // Insert payment details into the database
    const query = `
      INSERT INTO payments (user_id, order_id, payment_id, amount, status, payment_date)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    db.query(query, [userId, order_id, payment_id, amount, "completed"], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      // Distribute commission after successful payment
      distributeCommission(amount, userId);

      res.status(200).json({
        success: true,
        message: "Payment captured successfully",
        paymentId: payment_id,
        invoiceNumber: `INV-${userId}-${Date.now().toString().slice(-6)}`
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// const capturePayment = async (req, res) => {
//   try {
//     const { order_id, payment_id, signature, userId } = req.body;

//     // Verify the signature
//     const generatedSignature = crypto
//       .createHmac("sha256", "9e3RFXcJc0KijB84mtr3ZPQD")
//       .update(`${order_id}|${payment_id}`)
//       .digest("hex");

//     if (generatedSignature !== signature) {
//       return res.status(400).json({
//         success: false,
//         error: "Invalid signature",
//       });
//     }

//     // Insert payment details into the database
//     const query = `
//       INSERT INTO payments (user_id, order_id, payment_id, amount, status)
//       VALUES (?, ?, ?, ?, ?)
//     `;
//     db.query(query, [userId, order_id, payment_id, 2310, "completed"], (err, result) => {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           error: err.message,
//         });
//       }

//       res.status(200).json({
//         success: true,
//         message: "Payment captured successfully",
//       });
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// };
// const capturePayment = async (req, res) => {
//   try {
//     const { order_id, payment_id, signature, userId, amount } = req.body;

//     // Verify the signature
//     const generatedSignature = crypto
//       .createHmac("sha256", "9e3RFXcJc0KijB84mtr3ZPQD")
//       .update(`${order_id}|${payment_id}`)
//       .digest("hex");

//     if (generatedSignature !== signature) {
//       return res.status(400).json({
//         success: false,
//         error: "Invalid signature",
//       });
//     }

//     // Insert payment details into the database
//     const query = `
//       INSERT INTO payments (user_id, order_id, payment_id, amount, status)
//       VALUES (?, ?, ?, ?, ?)
//     `;
//     db.query(query, [userId, order_id, payment_id, amount, "completed"], (err, result) => {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           error: err.message,
//         });
//       }

//       res.status(200).json({
//         success: true,
//         message: "Payment captured successfully",
//       });
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// };
const getCommissionReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // First, get the teacher count for calculations
    const [teacherCountResult] = await db.promise().query("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
    const teacherCount = teacherCountResult[0].count;

    // Get all payments
    const query = `
      SELECT 
        u.name as studentName,
        u.department,
        u.email,
        u.phone,
        p.amount as registrationAmount,
        p.created_at as date
      FROM payments p
      JOIN users u ON u.id = p.user_id
      WHERE p.status = 'completed'
      ORDER BY p.created_at DESC
    `;

    const [payments] = await db.promise().query(query);

    // Process payments based on user role
    // let formattedPayments = payments.map(payment => {
    //   const amount = Number(payment.registrationAmount);
    //   const adminCommission = amount * 0.3;
    //   const teacherTotalCommission = amount * 0.7;
    //   const teacherIndividualCommission = teacherTotalCommission / teacherCount;

    //   return {
    //     ...payment,
    //     registrationAmount: amount,
    //     adminCommission: adminCommission,
    //     teacherTotalCommission: teacherTotalCommission,
    //     teacherIndividualCommission: teacherIndividualCommission,
    //     commission: userRole === 'admin' ? adminCommission : teacherIndividualCommission
    //   };
    // });
// Process payments based on user role
let formattedPayments = payments.map(payment => {
  const baseAmount = Number(payment.registrationAmount);
  const sgst = baseAmount * 0.05;
  const cgst = baseAmount * 0.05;
  const totalAmount = baseAmount + sgst + cgst;
  
  // Calculate commissions based on total amount (including taxes)
  const adminCommission = totalAmount * 0.3;
  const teacherTotalCommission = totalAmount * 0.7;
  const teacherIndividualCommission = teacherTotalCommission / teacherCount;

  return {
    ...payment,
    registrationAmount: baseAmount,
    sgst: sgst,
    cgst: cgst,
    totalAmount: totalAmount,
    adminCommission: adminCommission,
    teacherTotalCommission: teacherTotalCommission,
    teacherIndividualCommission: teacherIndividualCommission,
    commission: userRole === 'admin' ? adminCommission : teacherIndividualCommission
  };
});

    // Calculate total commission based on user role
    const totalCommission = formattedPayments.reduce((sum, payment) => 
      sum + (userRole === 'admin' ? payment.adminCommission : payment.teacherIndividualCommission), 0);

    res.status(200).json({
      success: true,
      userRole,
      userId,
      commissions: formattedPayments,
      totalCommission: Number(totalCommission.toFixed(2))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const distributeCommission = async (amount, userId) => {
  try {
    const teacherQuery = "SELECT COUNT(*) as teacherCount FROM users WHERE role = 'teacher'";
    const [teacherResult] = await db.promise().query(teacherQuery);
    const teacherCount = teacherResult[0].teacherCount;

    const teacherShare = (amount * 0.70) / teacherCount; // 70% split among teachers
    const adminShare = amount * 0.30; // 30% for admin

    // Record admin commission
    const adminCommissionQuery = `
      INSERT INTO commissions (user_id, amount, type, student_id)
      SELECT id, ?, 'admin', ? FROM users WHERE role = 'admin'
    `;
    await db.promise().query(adminCommissionQuery, [adminShare, userId]);

    // Record teacher commissions
    const teacherCommissionQuery = `
      INSERT INTO commissions (user_id, amount, type, student_id)
      SELECT id, ?, 'teacher', ? FROM users WHERE role = 'teacher'
    `;
    await db.promise().query(teacherCommissionQuery, [teacherShare, userId]);

    return true;
  } catch (error) {
    console.error('Commission distribution error:', error);
    return false;
  }
};

// Update capturePayment function



module.exports = {
  createOrder,
  capturePayment,
  getCommissionReport,
  distributeCommission,

};