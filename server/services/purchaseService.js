import Purchase from "../models/Purchase.js";
import { runInTransaction } from "../utils/transaction.js";

export const createPurchaseRecord = async ({
  purchaseData,
  afterCreate
}) => runInTransaction(async (session) => {
  const [purchase] = await Purchase.create([purchaseData], { session });
  if (afterCreate) {
    await afterCreate({ purchase, session });
  }
  return purchase;
});
