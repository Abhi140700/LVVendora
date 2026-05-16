import Sales from "../models/Sales.js";
import POSDraft from "../models/POSDraft.js";
import { runInTransaction } from "../utils/transaction.js";

export const completeSale = async ({
  salePayload,
  createdBy,
  afterCreate
}) => runInTransaction(async (session) => {
  const payload = typeof salePayload === "function"
    ? await salePayload({ session })
    : salePayload;
  const [sale] = await Sales.create([payload], { session });
  if (afterCreate) {
    await afterCreate({ sale, session });
  }
  await POSDraft.findOneAndDelete({ createdBy, status: "draft" }).session(session);
  return sale;
});
