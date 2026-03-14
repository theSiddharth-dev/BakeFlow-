const { subscribeToQueue } = require("./broker");
const { sendEmail } = require("../email");
const axios = require("axios");

module.exports = function () {
  subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
    const emailHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome to BakeFlow</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      font-family: Arial, sans-serif;
    }

    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }

    .header {
      background-color: #ff8c42;
      color: #ffffff;
      padding: 25px;
      text-align: center;
    }

    .content {
      padding: 25px;
      color: #333333;
    }

    .button {
      display: inline-block;
      padding: 12px 22px;
      margin-top: 20px;
      background-color: #ff8c42;
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }

    .info-box {
      background-color: #fafafa;
      padding: 15px;
      border-radius: 6px;
      margin-top: 15px;
      border: 1px solid #eeeeee;
    }

    .footer {
      text-align: center;
      padding: 15px;
      font-size: 12px;
      color: #888888;
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>

  <div class="container">

    <div class="header">
      <h1>Welcome to BakeFlow 🍞</h1>
    </div>

    <div class="content">
      <h2>Hello ${data.fullName.firstName + " " + (data.fullName.lastName || "")}</h2>

      <p>We're excited to have you on board! 🎉</p>

      <p>Your account has been successfully created. You can now explore our delicious cakes, pastries, and fresh bakery items.</p>

      <div class="info-box">
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Registered On:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <p>Click the button below to start ordering your favorite treats:</p>
      

      <p>If you have any questions, feel free to contact our support team.</p>

      <p>Best regards,<br/>The BakeFlow Team 🧡</p>
    </div>

    <div class="footer">
      © 2026 BakeFlow | All Rights Reserved <br>
      Thank you for choosing us ❤️
    </div>

  </div>

</body>
    </html>`;

    await sendEmail(
      data.email,
      "Welcome to BakeFlow",
      "Thank you for registering with us!",
      emailHtmlTemplate,
    );
  });

  subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_INITIATED",async (data)=>{
    const emailHtmlTemplate = `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Initiated - BakeFlow</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f8f6f3; font-family: Arial, sans-serif;">

  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#d2691e; padding:20px; text-align:center; color:#ffffff;">
        <h1 style="margin:0; font-size:24px;">🍞 BakeFlow</h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:30px;">
        <h2 style="margin-top:0; color:#333333;">Payment Initiated Successfully!</h2>
        
        <p style="color:#555555; line-height:1.6;">
          Hi <strong>${data.username}</strong>,
        </p>

        <p style="color:#555555; line-height:1.6;">
          Your payment for Order <strong>${data.orderId}</strong> has been successfully initiated.
          We are currently processing your transaction.
        </p>

        <!-- Order Summary -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0; border-collapse:collapse;">
          <tr>
            <td style="padding:10px; border:1px solid #eee;"><strong>Order ID</strong></td>
            <td style="padding:10px; border:1px solid #eee;">${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #eee;"><strong>Amount</strong></td>
            <td style="padding:10px; border:1px solid #eee;">${data.currency} ${data.amount}</td>
          </tr>
        </table>

        <p style="color:#555555; line-height:1.6;">
          Once the payment is confirmed, we will notify you immediately.
        </p>

        <p style="color:#777777; font-size:13px; line-height:1.6;">
          If you did not initiate this payment, please contact our support team immediately.
        </p>

        <p style="margin-top:30px; color:#555555;">
          Warm regards,<br>
          <strong>The BakeFlow Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f3f3f3; padding:20px; text-align:center; font-size:12px; color:#999999;">
        © {{year}} BakeFlow. All rights reserved.<br>
        {{companyAddress}}<br>
        <a href="{{supportEmail}}" style="color:#d2691e; text-decoration:none;">Contact Support</a>
      </td>
    </tr>

  </table>

</body>
</html>
    `
    await sendEmail(data.email,"Payment Initiated","Your payment is being processed",emailHtmlTemplate);

  })

  subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED", async (data) => {
    const paymentSuccessTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Successful - BakeFlow</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      font-family: Arial, sans-serif;
    }

    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }

    .header {
      background-color: #28a745;
      color: #ffffff;
      padding: 25px;
      text-align: center;
    }

    .content {
      padding: 25px;
      color: #333333;
    }

    .success-box {
      background-color: #f0fff4;
      padding: 15px;
      border-radius: 6px;
      margin-top: 15px;
      border: 1px solid #c6f6d5;
    }

    .info-box {
      background-color: #fafafa;
      padding: 15px;
      border-radius: 6px;
      margin-top: 15px;
      border: 1px solid #eeeeee;
    }

    .button {
      display: inline-block;
      padding: 12px 22px;
      margin-top: 20px;
      background-color: #28a745;
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }

    .footer {
      text-align: center;
      padding: 15px;
      font-size: 12px;
      color: #888888;
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>

  <div class="container">

    <div class="header">
      <h1>Payment Successful 🎉</h1>
    </div>

    <div class="content">

      <h2>Hello ${data.username}</h2>

      <p>Great news! Your payment has been successfully processed. 🧾</p>

      <div class="success-box">
        <strong>Amount Paid:</strong> ₹${data.amount} <br/>
        <strong>Currency:</strong> ${data.currency} <br/>
        <strong>Payment ID:</strong> ${data.paymentId} <br/>
        <strong>Date:</strong> ${new Date().toLocaleString()}
      </div>

      <div class="info-box">
        <strong>Order ID:</strong> ${data.orderId} <br/>
        <strong>Payment Method:</strong> ${data.paymentMethod}
      </div>

      <p>Your delicious treats are now being prepared! 🍰</p>

      <a href="${data.orderTrackingUrl || "#"}" class="button">
        Track Your Order
      </a>

      <p>If you have any questions, feel free to contact our support team.</p>

      <p>Thank you for choosing BakeFlow ❤️</p>

    </div>

    <div class="footer">
      © 2026 BakeFlow | All Rights Reserved <br>
      Freshly baked happiness, delivered to you 🧡
    </div>

  </div>

</body>
</html>
`;
    const attachments = [];

    if (data.receiptAttachmentBase64) {
      attachments.push({
        filename: data.receiptFileName || `receipt-${data.orderId}.pdf`,
        content: Buffer.from(data.receiptAttachmentBase64, "base64"),
        contentType: "application/pdf",
      });
    } else if (data.receiptAuthToken && process.env.ORDER_SERVICE_URL) {
      try {
        const receiptResponse = await axios.get(
          `${process.env.ORDER_SERVICE_URL}/api/orders/${data.orderId}/receipt`,
          {
            headers: {
              Authorization: `Bearer ${data.receiptAuthToken}`,
            },
            responseType: "arraybuffer",
          },
        );

        attachments.push({
          filename: data.receiptFileName || `receipt-${data.orderId}.pdf`,
          content: Buffer.from(receiptResponse.data),
          contentType: "application/pdf",
        });
      } catch (receiptFetchErr) {
        console.error(
          "Unable to attach receipt in payment email:",
          receiptFetchErr.message,
        );
      }
    }

    await sendEmail(
      data.email,
      "Payment Successful",
      "We have received your payment for order ",
      paymentSuccessTemplate,
      attachments,
    );
  });


  subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", async (data)=>{
    const paymentFailedTemplate = `
    <h1> Payment Failed </h1>
    <p> Dear ${data.username},</p>
    Unfortunately, your payment for the order ID: ${data.orderId} has failed</p>
    <p>Please try again or contact support if the issue persists.</p>
    <p> Best regards,<Br/> The BakeFlow Team </p>
    `;

    await sendEmail(data.email,"Payment Failed","Your payment could not be processed", paymentFailedTemplate);
  })

  subscribeToQueue("PRODUCT_NOTIFICATION.PRODUCT_CREATED",async (data)=>
    {

    const emailHtmlTemplate = `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>New Product Launch - Bakeflow</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      font-family: Arial, sans-serif;
    }

    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }

    .header {
      background-color: #ff8c42;
      color: #ffffff;
      padding: 25px;
      text-align: center;
    }

    .content {
      padding: 25px;
      color: #333333;
    }

    .button {
      display: inline-block;
      padding: 12px 22px;
      margin-top: 20px;
      background-color: #ff8c42;
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }

    .info-box {
      background-color: #fafafa;
      padding: 15px;
      border-radius: 6px;
      margin-top: 15px;
      border: 1px solid #eeeeee;
    }

    .footer {
      text-align: center;
      padding: 15px;
      font-size: 12px;
      color: #888888;
      background-color: #f9f9f9;
    }
  </style>
</head>

<body>

  <div class="container">

    <!-- Header -->
    <div class="header">
      <h1 style="margin:0;">Bakeflow 🍰</h1>
      <p style="margin:8px 0 0;">Something Fresh Just Arrived!</p>
    </div>

    <!-- Content -->
    <div class="content">
      <h2 style="margin-top:0;">✨ Introducing ${data.productName} </h2>

      <p>
        We’re excited to launch our newest delight — <strong>${data.productName}</strong>.
        Freshly baked with premium ingredients and crafted to perfection.
      </p>

      <div class="info-box">
        <strong>Why you'll love it:</strong>
        <ul style="padding-left:18px; margin:10px 0;">
          <li>Made with high-quality ingredients</li>
          <li>Rich taste & perfect texture</li>
          <li>Deliciously baked to perfection</li>
          <li>Available for limited period of time</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      © {{year}} Bakeflow. All rights reserved.
    </div>

  </div>

</body>
</html>
    `
  await sendEmail(data.email,"New Product Launched","Check out our latest product",emailHtmlTemplate);
  })
};
