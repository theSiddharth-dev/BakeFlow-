require("dotenv").config();
const nodemailer = require("nodemailer");

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Configure the email transporter using OAuth2
const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true,
  maxConnections: toPositiveInt(process.env.EMAIL_POOL_MAX_CONNECTIONS, 5),
  maxMessages: toPositiveInt(process.env.EMAIL_POOL_MAX_MESSAGES, 100),
  connectionTimeout: toPositiveInt(
    process.env.EMAIL_CONNECTION_TIMEOUT_MS,
    10000,
  ),
  greetingTimeout: toPositiveInt(process.env.EMAIL_GREETING_TIMEOUT_MS, 5000),
  socketTimeout: toPositiveInt(process.env.EMAIL_SOCKET_TIMEOUT_MS, 15000),
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Function to send email
const sendEmail = async (to, subject, text, html, attachments = []) => {
  try {
    const info = await transporter.sendMail({
      from: `"BakeFlow" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
      attachments,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = { sendEmail };
