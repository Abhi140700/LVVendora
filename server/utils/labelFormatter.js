export const formatLabelPayload = (payload = {}) => ({
  productName: payload.productName || "",
  barcode: payload.barcode || "",
  price: Number(payload.price || 0),
});
