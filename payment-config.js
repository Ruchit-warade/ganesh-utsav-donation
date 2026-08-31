/**
 * payment-config.js
 * ------------------------------------------------------------
 * Organizers MUST add the official payment details here.
 *
 * DO NOT collect card numbers / CVV / OTP / UPI PIN / bank
 * passwords anywhere in this app. The contributor pays via their
 * own UPI app by scanning the QR / using the UPI ID, then enters
 * the transaction reference (UTR) for the admins to verify.
 */

export const PAYMENT_CONFIG = {
  // Official UPI ID for Ganesh Utsav 2026, IIT Mandi.
  // REPLACE_WITH_OFFICIAL_UPI_ID  ->  e.g. "ganeshutsav@ybl"
  upiId: "REPLACE_WITH_OFFICIAL_UPI_ID",

  // Path to the official UPI QR image (relative to site root).
  // Organizer: drop your QR PNG at  assets/images/upi-qr.png
  // REPLACE_WITH_OFFICIAL_QR -> keep the default path if you use it.
  qrCodePath: "./assets/images/upi-qr.png",

  // Short display name shown near the QR.
  payeeName: "Ganesh Utsav IIT Mandi",

  // Instructions shown to the contributor on the payment screen.
  instructions:
    "Scan the official QR code (or use the UPI ID below) with any UPI app " +
    "(GPay, PhonePe, Paytm, BHIM) and complete your contribution. " +
    "After paying, note the Transaction / UTR reference shown in the success " +
    "screen and enter it in the form to submit your contribution.",

  // Currency indicator used across the app.
  currencySymbol: "₹", // ₹ (rupee). Change to "$" etc. if needed.
};
