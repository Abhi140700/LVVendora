import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import https from "https";
import connectDB from "./config/db.js";

// ✅ FORCE LOAD MODELS (VERY IMPORTANT)
import "./models/Item.js";
import "./models/Category.js";
import "./models/Brand.js";
import "./models/Inventory.js";
import "./models/Purchase.js";
import "./models/Sales.js";
import "./models/BillCounter.js";
import "./models/CashSalesAdjustment.js";
import "./models/AuditLog.js";
import "./models/POSSession.js";
import "./models/CustomerLedger.js";
import "./models/CustomerLoyaltyLedger.js";
import "./models/CustomerCommunicationLog.js";
import "./models/CashEntry.js";
import "./models/TallySettings.js";
import "./models/TallySyncLog.js";

import authRoutes from "./routes/authRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import labelRoutes from "./routes/labelRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/master/categoryRoutes.js";
import brandRoutes from "./routes/master/brandRoutes.js"; // ✅ ADD THIS
import itemRoutes from "./routes/master/itemRoutes.js";
import partyRoutes from "./routes/master/partyRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import purchaseReturnRoutes from "./routes/purchaseReturnRoutes.js";
import whatsappRoutes from "./routes/whatsappRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import accountingRoutes from "./routes/accountingRoutes.js";
import tallyRoutes from "./routes/tallyRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import systemSettingsRoutes from "./routes/systemSettingsRoutes.js";
import { ensureDefaultUsers } from "./services/bootstrapService.js";
import "./models/SystemSettings.js";

dotenv.config();
const app = express();
const APP_HOST = process.env.HOST || "0.0.0.0";
const USE_HTTPS = process.env.HTTPS === "true";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "../certs/localhost-key.pem";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "../certs/localhost-cert.pem";

app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/label", labelRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes); // ✅ FIXED
app.use("/api/items", itemRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/tally", tallyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", systemSettingsRoutes);
app.use("/api/purchase-returns", purchaseReturnRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/audit-logs", auditRoutes);

app.get("/", (req, res) => {
    res.send("API is running...");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: err.message });
});


const PORT = process.env.PORT || 5000;
connectDB()
    .then(() => {
        return ensureDefaultUsers();
    })
    .then(() => {
        if (USE_HTTPS) {
            const httpsOptions = {
                key: fs.readFileSync(SSL_KEY_PATH),
                cert: fs.readFileSync(SSL_CERT_PATH),
            };

            https.createServer(httpsOptions, app).listen(PORT, APP_HOST, () => {
                console.log(`HTTPS server running on https://${APP_HOST}:${PORT}`);
            });
            return;
        }

        app.listen(PORT, APP_HOST, () => console.log(`HTTP server running on http://${APP_HOST}:${PORT}`));
    })
    .catch((err) => {
        console.error("Failed to connect to DB", err);
        process.exit(1);
    });
