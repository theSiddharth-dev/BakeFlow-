require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Function to send email (same as before)
const sendEmail = async (to, subject, text, html, attachments = []) => {
  try {
    const response = await resend.emails.send({
      from: `"BakeFlow" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
      attachments
      // attachments (optional - can add later if needed)
    });

    console.log("Email sent:", response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = { sendEmail };