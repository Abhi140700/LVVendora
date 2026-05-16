import BillCounter from "../models/BillCounter.js";

export const BILLING_MODES = ["CASH", "ADVANCE", "CREDIT"];

const MODE_PREFIX = {
  CASH: "CASH",
  ADVANCE: "ADV",
  CREDIT: "CR"
};

export const normalizeBillingMode = (value = "CASH") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "CASHPAY" || normalized === "CARD-UPI" || normalized === "CARD_UPI") return "CASH";
  if (normalized === "ADV" || normalized === "ADVANCE") return "ADVANCE";
  if (normalized === "CR" || normalized === "CREDIT") return "CREDIT";
  return "CASH";
};

export const getFinancialYear = (referenceDate = new Date()) => {
  const date = new Date(referenceDate || Date.now());
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

export const buildCompanyAcronym = (companyName = "") => String(companyName || "")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0]?.toUpperCase() || "")
  .join("") || "LV";

export const getModePrefix = (mode = "CASH") => MODE_PREFIX[normalizeBillingMode(mode)] || "CASH";

export const buildDisplayBillNo = ({ companyName, mode, modeBillNo }) => {
  const acronym = buildCompanyAcronym(companyName);
  return `${acronym}/${getModePrefix(mode)}-${Number(modeBillNo || 0)}`;
};

export const getNextBillNo = async ({
  mode = "CASH",
  saleDate = new Date(),
  companyName = "",
  increment = false,
  session = null
} = {}) => {
  const billingMode = normalizeBillingMode(mode);
  const financialYear = getFinancialYear(saleDate);
  const prefix = getModePrefix(billingMode);

  if (increment) {
    const counter = await BillCounter.findOneAndUpdate(
      { mode: billingMode, financialYear },
      {
        $inc: { currentNumber: 1 },
        $setOnInsert: { mode: billingMode, financialYear, prefix }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    ).lean();

    return {
      billingMode,
      modeBillNo: counter.currentNumber,
      displayBillNo: buildDisplayBillNo({ companyName, mode: billingMode, modeBillNo: counter.currentNumber }),
      financialYear,
      prefix
    };
  }

  const counter = await BillCounter.findOne({ mode: billingMode, financialYear }).session(session).lean();
  const modeBillNo = Number(counter?.currentNumber || 0) + 1;
  return {
    billingMode,
    modeBillNo,
    displayBillNo: buildDisplayBillNo({ companyName, mode: billingMode, modeBillNo }),
    financialYear,
    prefix
  };
};
