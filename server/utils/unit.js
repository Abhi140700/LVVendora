export const normalizeUnit = (value = "") => {
  const normalized = String(value || "").trim().toUpperCase();

  if (["MTR", "MTRS", "METER", "METERS"].includes(normalized)) {
    return "MTRS";
  }

  return "PCS";
};

export const isMeterUnit = (value = "") => normalizeUnit(value) === "MTRS";
