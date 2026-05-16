import CustomerLoyaltyLedger from "../models/CustomerLoyaltyLedger.js";
import Party from "../models/Party.js";

const normalizeText = (value = "") => String(value || "").trim();
const clampNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const buildCompanyAcronym = (companyName = "LVVendora") => {
  const normalized = normalizeText(companyName).replace(/[^a-zA-Z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((word) => word[0]).join("").toUpperCase();
  }
  const compact = words[0] || "LV";
  const uppercaseLetters = compact.match(/[A-Z]/g)?.join("") || "";
  return (uppercaseLetters.length >= 2 ? uppercaseLetters : compact.slice(0, 3)).toUpperCase();
};

export const generateLoyaltyCardNo = async ({ companyName, phone, padding = 4, session = null }) => {
  const prefix = buildCompanyAcronym(companyName);
  const sequence = await Party.countDocuments({ partyType: "customer", loyaltyCardNo: { $exists: true, $ne: "" } }).session(session);
  const nextSequence = String(sequence + 1).padStart(Math.max(1, Number(padding) || 4), "0");
  const phoneDigits = normalizeText(phone).replace(/\D/g, "");
  return `${prefix}${nextSequence}${phoneDigits}`;
};

export const enrollCustomerInLoyalty = async ({
  customer,
  settings = {},
  createdBy,
  session = null
}) => {
  if (!customer || customer.partyType !== "customer") {
    return customer;
  }

  if (customer.loyaltyCardNo) {
    return customer;
  }

  const loyaltySettings = settings.loyalty || {};
  const enrollmentFee = Math.max(0, clampNumber(loyaltySettings.enrollmentFee));
  const openingPoints = Math.max(0, Math.floor(clampNumber(loyaltySettings.enrollmentBonusPoints)));
  customer.loyaltyCardNo = await generateLoyaltyCardNo({
    companyName: settings.companyName,
    phone: customer.phone,
    padding: loyaltySettings.cardSequencePadding,
    session
  });
  customer.loyaltyAppliedAt = new Date();
  customer.loyaltyEnrollmentFee = enrollmentFee;
  customer.loyaltyOpeningPoints = openingPoints;
  await customer.save({ session });

  if (openingPoints > 0) {
    await CustomerLoyaltyLedger.create([{
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      entryType: "adjustment",
      points: openingPoints,
      amountValue: enrollmentFee,
      balanceAfter: openingPoints,
      note: `Loyalty enrollment${enrollmentFee ? ` fee Rs. ${enrollmentFee.toFixed(2)}` : ""}`,
      createdBy
    }], { session });
  }

  return customer;
};
