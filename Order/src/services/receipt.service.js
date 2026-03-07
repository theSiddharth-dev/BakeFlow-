const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const RECEIPTS_DIR = path.join(__dirname, "..", "..", "receipts");

const ensureReceiptsDir = () => {
  if (!fs.existsSync(RECEIPTS_DIR)) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  }
};

const formatCurrency = (value, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
  }
};

const formatDateTime = (dateValue) => {
  try {
    return new Date(dateValue).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateValue || "-");
  }
};

const generateReceiptPdf = async ({
  bakeryName,
  systemName,
  orderId,
  customerName,
  paymentMethod,
  paymentStatus,
  paymentId,
  orderDate,
  currency,
  items,
  subtotal,
  tax,
  total,
}) => {
  ensureReceiptsDir();

  const safeOrderId = String(orderId || "order").replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `receipt-${safeOrderId}-${Date.now()}.pdf`;
  const absoluteFilePath = path.join(RECEIPTS_DIR, fileName);
  const relativeFilePath = path.join("receipts", fileName);

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(absoluteFilePath);
    doc.pipe(stream);

    doc
      .fontSize(22)
      .fillColor("#111827")
      .text(bakeryName || "Bakery", { align: "left" })
      .fontSize(12)
      .fillColor("#4b5563")
      .text(systemName || "Bakeflow", { align: "left" });

    doc
      .fontSize(12)
      .fillColor("#111827")
      .text(`Order Date: ${formatDateTime(orderDate)}`, { align: "right" })
      .moveDown(0.8);

    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#d1d5db")
      .stroke()
      .moveDown(1);

    doc
      .fontSize(16)
      .fillColor("#111827")
      .text("Payment Receipt", { align: "left" })
      .moveDown(0.6);

    doc
      .fontSize(11)
      .fillColor("#374151")
      .text(`Customer Name: ${customerName || "Customer"}`)
      .text(`Payment Method: ${paymentMethod || "Razorpay"}`)
      .text(`Payment Status: ${paymentStatus || "PAID"}`)
      .moveDown(1);

    const tableStartY = doc.y;
    const col = {
      item: 45,
      qty: 330,
      unit: 395,
      total: 490,
    };

    doc
      .fontSize(10)
      .fillColor("#111827")
      .text("Item", col.item, tableStartY, { width: 260 })
      .text("Qty", col.qty, tableStartY)
      .text("Unit Price", col.unit, tableStartY)
      .text("Total", col.total, tableStartY);

    doc
      .moveTo(40, tableStartY + 16)
      .lineTo(555, tableStartY + 16)
      .strokeColor("#d1d5db")
      .stroke();

    let rowY = tableStartY + 24;

    (items || []).forEach((item) => {
      doc
        .fontSize(10)
        .fillColor("#374151")
        .text(String(item.name || "Item"), col.item, rowY, { width: 270 })
        .text(String(item.quantity || 0), col.qty, rowY)
        .text(formatCurrency(item.unitPrice, currency), col.unit, rowY)
        .text(formatCurrency(item.totalPrice, currency), col.total, rowY);

      rowY += 20;
    });

    const summaryY = rowY + 12;

    doc
      .moveTo(40, summaryY)
      .lineTo(265, summaryY)
      .strokeColor("#d1d5db")
      .stroke();

    doc
      .fontSize(11)
      .fillColor("#111827")
      .text("Subtotal", 45, summaryY + 10)
      .text(formatCurrency(subtotal, currency), 155, summaryY + 10)
      .text("Tax", 45, summaryY + 30)
      .text(formatCurrency(tax, currency), 155, summaryY + 30)
      .fontSize(12)
      .text("Total", 45, summaryY + 54)
      .text(formatCurrency(total, currency), 155, summaryY + 54);

    doc
      .fontSize(11)
      .fillColor("#4b5563")
      .text("Thank you for your business!", 40, summaryY + 100);

    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return {
    fileName,
    absoluteFilePath,
    relativeFilePath,
  };
};

module.exports = {
  RECEIPTS_DIR,
  generateReceiptPdf,
};
