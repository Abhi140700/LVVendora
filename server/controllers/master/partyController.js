import Party from "../../models/Party.js";
import { getSystemSettings } from "../../services/systemSettingsService.js";
import { enrollCustomerInLoyalty } from "../../services/loyaltyService.js";

const INDIAN_STATE_CODES = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh"
};

const normalizeName = (value = "") => value.trim().replace(/\s+/g, " ");
const deriveStateCodeFromGst = (gstNo = "") => gstNo.slice(0, 2);
const RAPIDAPI_GST_BASE_URL = "https://gst-insights-api.p.rapidapi.com";
const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";

const mapGstPayload = (payload, gstNo) => {
  const rootRecord = Array.isArray(payload?.data) ? payload.data[0] || {} : payload?.data || payload?.result || payload || {};
  const taxpayerInfo =
    payload?.taxpayerInfo ||
    rootRecord?.taxpayerInfo ||
    rootRecord ||
    {};
  const principalAddress =
    taxpayerInfo?.pradr?.addr ||
    taxpayerInfo?.pradr ||
    taxpayerInfo?.principalAddress?.address ||
    taxpayerInfo?.principalAddress ||
    taxpayerInfo?.address ||
    {};
  const flatAddress = payload?.principalPlace || payload?.address || rootRecord?.principalAddress?.address || {};
  const address = { ...principalAddress, ...flatAddress };
  const stateCode = pickFirst(
    taxpayerInfo?.stateCode,
    taxpayerInfo?.StateCode,
    taxpayerInfo?.gstNumber ? deriveStateCodeFromGst(taxpayerInfo.gstNumber) : "",
    address?.stcd,
    address?.stateCode,
    deriveStateCodeFromGst(gstNo)
  );
  const addressLine1 = pickFirst(
    [address?.buildingName, address?.buildingNumber].filter(Boolean).join(", "),
    address?.bnm,
    address?.addressLine1,
    address?.adr1,
    [address?.bno, address?.flno, address?.floorNumber].filter(Boolean).join(", ")
  );
  const addressLine2 = pickFirst(
    [address?.street, address?.location, address?.district].filter(Boolean).join(", "),
    address?.st,
    address?.addressLine2,
    address?.adr2,
    [address?.dst, address?.loc, address?.locality, address?.landMark, address?.landmark].filter(Boolean).join(", ")
  );
  const city = pickFirst(
    address?.district,
    address?.loc,
    address?.city,
    address?.cty,
    taxpayerInfo?.city,
    taxpayerInfo?.cty
  );
  const legalName = pickFirst(
    taxpayerInfo?.legalName,
    taxpayerInfo?.lgnm,
    taxpayerInfo?.LegalName,
    taxpayerInfo?.businessName
  );
  const tradeName = pickFirst(
    taxpayerInfo?.tradeName,
    taxpayerInfo?.tradeNam,
    taxpayerInfo?.TradeName,
    taxpayerInfo?.trade_name
  );
  const phone = pickFirst(
    taxpayerInfo?.phone,
    taxpayerInfo?.mobile,
    taxpayerInfo?.mobileNumber,
    taxpayerInfo?.mob,
    payload?.phone,
    payload?.mobile
  );
  const email = pickFirst(
    taxpayerInfo?.email,
    taxpayerInfo?.emailId,
    taxpayerInfo?.mail,
    payload?.email,
    payload?.emailId
  );
  const contactPerson = pickFirst(
    taxpayerInfo?.contactPerson,
    taxpayerInfo?.contact,
    payload?.contactPerson,
    tradeName,
    legalName
  );

  return {
    legalName,
    tradeName,
    partyName: tradeName || legalName,
    contactPerson,
    phone,
    email,
    gstNo: pickFirst(taxpayerInfo?.gstNumber, taxpayerInfo?.gstNo, gstNo),
    addressLine1,
    addressLine2,
    city,
    pincode: pickFirst(address?.pncd, address?.pincode, address?.zip),
    state: pickFirst(
      taxpayerInfo?.state,
      taxpayerInfo?.StateName,
      address?.state,
      INDIAN_STATE_CODES[deriveStateCodeFromGst(pickFirst(taxpayerInfo?.gstNumber, taxpayerInfo?.gstNo, gstNo))],
      INDIAN_STATE_CODES[stateCode]
    ),
    stateCode: deriveStateCodeFromGst(pickFirst(taxpayerInfo?.gstNumber, taxpayerInfo?.gstNo, gstNo)),
    raw: payload
  };
};

const getNextSalesmanCode = async () => {
  const lastSalesman = await Party.findOne({ partyType: "salesman" })
    .sort({ salesmanCode: -1, createdAt: -1 })
    .select("salesmanCode")
    .lean();

  return Number(lastSalesman?.salesmanCode || 0) + 1;
};

// Get all parties
export const getParties = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) {
      filter.partyType = req.query.type;
    }

    const parties = await Party.find(filter).sort({ name: 1 }).lean();

    res.status(200).json({
      success: true,
      count: parties.length,
      data: parties
    });
  } catch (err) {
    console.error("Get Parties Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parties"
    });
  }
};

export const getNextPartyCode = async (req, res) => {
  try {
    const type = String(req.query.type || "").trim();
    if (type !== "salesman") {
      return res.status(400).json({
        success: false,
        message: "Unsupported party type for next code lookup"
      });
    }

    const nextCode = await getNextSalesmanCode();
    return res.status(200).json({
      success: true,
      data: {
        nextCode
      }
    });
  } catch (err) {
    console.error("Get Next Party Code Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate next party code"
    });
  }
};

// Create party
export const createParty = async (req, res) => {
  try {
    const {
      name,
      partyType = "party",
      phone,
      location,
      customerType,
      creditLimit,
      segmentTags,
      loyaltyCardNo,
      applyLoyalty,
      dateOfBirth,
      anniversary,
      email,
      contactPerson,
      addressLine1,
      addressLine2,
      city,
      state,
      stateCode,
      pincode,
      gstNo,
      bankName,
      bankBranch,
      accountNo,
      ifsc,
      notes
    } = req.body;

    const normalizedName = normalizeName(name);

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    const existing = await Party.findOne({ name: normalizedName, partyType });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Party already exists"
      });
    }

    const payload = {
      name: normalizedName,
      partyType,
      salesmanCode: partyType === "salesman" ? Number(req.body.salesmanCode || await getNextSalesmanCode()) : undefined,
      contactPerson,
      phone,
      location,
      customerType: partyType === "customer" && ["retail", "wholesale", "vip"].includes(customerType) ? customerType : undefined,
      creditLimit: partyType === "customer" ? Math.max(0, Number(creditLimit || 0)) : undefined,
      segmentTags: partyType === "customer"
        ? [...new Set((Array.isArray(segmentTags) ? segmentTags : String(segmentTags || "").split(",")).map((tag) => String(tag || "").trim()).filter(Boolean))]
        : undefined,
      loyaltyCardNo: partyType === "customer" ? String(loyaltyCardNo || "").trim() || undefined : undefined,
      dateOfBirth: dateOfBirth || undefined,
      anniversary: anniversary || undefined,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      stateCode,
      pincode,
      gstNo,
      bankName,
      bankBranch,
      accountNo,
      ifsc,
      notes
    };

    const party = await Party.create(payload);
    if (partyType === "customer" && applyLoyalty) {
      await enrollCustomerInLoyalty({
        customer: party,
        settings: await getSystemSettings(),
        createdBy: req.user?._id
      });
    }

    res.status(201).json({
      success: true,
      data: party
    });

  } catch (err) {
    console.error("Create Party Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create party"
    });
  }
};

export const lookupGstDetails = async (req, res) => {
  try {
    const gstNo = String(req.params.gstNo || "").trim().toUpperCase();

    if (!gstNo || gstNo.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Valid GST number is required"
      });
    }

    const stateCode = deriveStateCodeFromGst(gstNo);

    const rapidApiKey = process.env.RAPIDAPI_GST_KEY || process.env.GST_API_KEY;
    const rapidApiHost = process.env.RAPIDAPI_GST_HOST || "gst-insights-api.p.rapidapi.com";
    const rapidApiUrl = process.env.RAPIDAPI_GST_URL || RAPIDAPI_GST_BASE_URL;

    if (!rapidApiKey) {
      return res.status(200).json({
        success: true,
        source: "derived",
        message: "RapidAPI GST key not configured in server env. Returned details derived from GST number only.",
        data: {
          gstNo,
          stateCode,
          state: INDIAN_STATE_CODES[stateCode] || ""
        }
      });
    }

    const url = new URL(`/getGSTDetailsUsingGST/${encodeURIComponent(gstNo)}`, rapidApiUrl);
    const headers = {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": rapidApiHost,
      "Content-Type": "application/json"
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const upstreamText = await response.text().catch(() => "");
      const fallback = {
        gstNo,
        stateCode,
        state: INDIAN_STATE_CODES[stateCode] || ""
      };

      return res.status(200).json({
        success: true,
        source: "derived",
        message: upstreamText
          ? `GST lookup failed upstream. Returned derived state details only.`
          : "GST lookup failed upstream. Returned derived state details only.",
        data: fallback
      });
    }

    const payload = await response.json();
    return res.status(200).json({
      success: true,
      source: "api",
      data: mapGstPayload(payload, gstNo)
    });
  } catch (err) {
    console.error("GST Lookup Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch GST details"
    });
  }
};

// Update party
export const updateParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);

    if (!party) {
      return res.status(404).json({
        success: false,
        message: "Party not found"
      });
    }

    const nextPayload = { ...req.body };
    if (party.partyType === "salesman" || req.body.partyType === "salesman") {
      nextPayload.salesmanCode = Number(req.body.salesmanCode || party.salesmanCode || await getNextSalesmanCode());
    }

    Object.assign(party, nextPayload);
    if (party.partyType === "customer" && req.body.applyLoyalty) {
      await enrollCustomerInLoyalty({
        customer: party,
        settings: await getSystemSettings(),
        createdBy: req.user?._id
      });
    }
    await party.save();

    res.status(200).json({
      success: true,
      data: party
    });

  } catch (err) {
    console.error("Update Party Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update party"
    });
  }
};

// Delete party
export const deleteParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);

    if (!party) {
      return res.status(404).json({
        success: false,
        message: "Party not found"
      });
    }

    await party.deleteOne();

    res.status(200).json({
      success: true,
      message: "Party deleted successfully"
    });

  } catch (err) {
    console.error("Delete Party Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete party"
    });
  }
};
