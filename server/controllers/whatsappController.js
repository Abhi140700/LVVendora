import Party from "../models/Party.js";
import Sales from "../models/Sales.js";
import {
  broadcastWhatsAppMessage,
  ensureWhatsAppClient,
  getWhatsAppStatus,
  sendWhatsAppMessage
} from "../services/whatsappService.js";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const buildInvoiceMessage = (sale) => {
  const lines = (sale.items || [])
    .map((item) => `- ${item.itemName || "Item"} x${item.qty} @ ${round2(item.sellingRate).toFixed(2)} = ${round2(item.total).toFixed(2)}`)
    .join("\n");

  return [
    "Thank you for shopping with us.",
    `Bill No: ${sale.billNo || sale.invoiceNo || "-"}`,
    `Customer: ${sale.customer || "Walk-in Customer"}`,
    `Date: ${new Date(sale.saleDate || Date.now()).toLocaleString("en-IN")}`,
    "",
    lines,
    "",
    `Subtotal: Rs. ${round2(sale.subtotal).toFixed(2)}`,
    `Discount: Rs. ${round2(sale.discount).toFixed(2)}`,
    `Exchange: Rs. ${round2(sale.exchangeAmount).toFixed(2)}`,
    `Net Amount: Rs. ${round2(sale.totalAmount).toFixed(2)}`,
    `Due: Rs. ${round2(sale.creditDue).toFixed(2)}`,
    "",
    "Please reply if you need bill support or exchange help."
  ].join("\n");
};

export const getWhatsAppConnectionStatus = async (req, res) => {
  try {
    const status = getWhatsAppStatus();
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp status",
      error: error.message
    });
  }
};

export const initializeWhatsAppConnection = async (req, res) => {
  try {
    await ensureWhatsAppClient();
    return res.status(200).json({
      success: true,
      message: "WhatsApp client initialization started",
      data: getWhatsAppStatus()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to initialize WhatsApp client",
      error: error.message
    });
  }
};

export const sendBillOnWhatsApp = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.saleId).lean();
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    const targetPhone = String(req.body.phone || sale.customerPhone || "").trim();
    if (!targetPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required"
      });
    }

    await sendWhatsAppMessage({
      phone: targetPhone,
      message: buildInvoiceMessage(sale)
    });

    await Sales.findByIdAndUpdate(sale._id, { whatsappSentAt: new Date() });

    return res.status(200).json({
      success: true,
      message: "Bill sent on WhatsApp"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send bill on WhatsApp",
      error: error.message
    });
  }
};

export const broadcastMessage = async (req, res) => {
  try {
    const { message, customerIds = [], onlyOptedIn = true } = req.body;
    if (!String(message || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Broadcast message is required"
      });
    }

    const filter = {
      partyType: "customer",
      phone: { $exists: true, $ne: "" }
    };

    if (onlyOptedIn) {
      filter.whatsappOptIn = true;
    }

    if (Array.isArray(customerIds) && customerIds.length > 0) {
      filter._id = { $in: customerIds };
    }

    const customers = await Party.find(filter).select("name phone whatsappOptIn").lean();
    const results = await broadcastWhatsAppMessage({
      recipients: customers,
      message: String(message).trim()
    });

    return res.status(200).json({
      success: true,
      message: "Broadcast processed",
      data: {
        total: customers.length,
        results
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to broadcast WhatsApp message",
      error: error.message
    });
  }
};
