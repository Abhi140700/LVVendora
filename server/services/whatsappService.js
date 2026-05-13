let client = null;
let initializing = false;
let initPromise = null;
let latestQr = "";
let latestError = "";
let ready = false;
let lastEventAt = null;

const markEvent = () => {
  lastEventAt = new Date();
};

const formatPhoneNumber = (rawPhone = "") => {
  const digits = String(rawPhone).replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `91${digits}@c.us`;
  }

  if (digits.length >= 11) {
    return `${digits}@c.us`;
  }

  return "";
};

export const getWhatsAppStatus = () => ({
  enabled: ready,
  initializing,
  latestQr,
  latestError,
  lastEventAt
});

export const ensureWhatsAppClient = async () => {
  if (client && ready) {
    return client;
  }

  if (initPromise) {
    return initPromise;
  }

  initializing = true;
  latestError = "";
  markEvent();

  initPromise = (async () => {
    try {
      const [{ Client, LocalAuth }, qrcodeTerminal] = await Promise.all([
        import("whatsapp-web.js"),
        import("qrcode-terminal")
      ]);

      client = new Client({
        authStrategy: new LocalAuth({ clientId: "pos-system" }),
        puppeteer: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        }
      });

      client.on("qr", (qr) => {
        latestQr = qr;
        ready = false;
        markEvent();
        qrcodeTerminal.default.generate(qr, { small: true });
      });

      client.on("ready", () => {
        latestQr = "";
        latestError = "";
        ready = true;
        initializing = false;
        markEvent();
      });

      client.on("authenticated", () => {
        latestError = "";
        markEvent();
      });

      client.on("auth_failure", (message) => {
        latestError = message || "WhatsApp authentication failed";
        ready = false;
        initializing = false;
        markEvent();
      });

      client.on("disconnected", (reason) => {
        latestError = reason || "WhatsApp disconnected";
        ready = false;
        initializing = false;
        client = null;
        initPromise = null;
        markEvent();
      });

      await client.initialize();
      return client;
    } catch (error) {
      latestError = error.message || "Failed to initialize WhatsApp client";
      ready = false;
      client = null;
      throw error;
    } finally {
      initializing = false;
      markEvent();
    }
  })();

  return initPromise;
};

export const sendWhatsAppMessage = async ({ phone, message }) => {
  const formattedPhone = formatPhoneNumber(phone);
  if (!formattedPhone) {
    throw new Error("Valid customer phone is required for WhatsApp delivery");
  }

  const activeClient = await ensureWhatsAppClient();
  if (!ready || !activeClient) {
    throw new Error("WhatsApp client is not ready yet. Scan QR and wait for connection.");
  }

  return activeClient.sendMessage(formattedPhone, message);
};

export const broadcastWhatsAppMessage = async ({ recipients = [], message }) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("At least one recipient is required for broadcast");
  }

  const results = [];
  for (const recipient of recipients) {
    try {
      await sendWhatsAppMessage({ phone: recipient.phone, message });
      results.push({ phone: recipient.phone, success: true });
    } catch (error) {
      results.push({ phone: recipient.phone, success: false, error: error.message });
    }
  }

  return results;
};
