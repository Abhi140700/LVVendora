export const generateBarcode = (seed = "ITEM") =>
  `${seed}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
