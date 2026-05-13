import mongoose from "mongoose";

const UNSUPPORTED_TRANSACTION_MESSAGE = "Transaction numbers are only allowed on a replica set member or mongos";

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("transaction numbers are only allowed on a replica set member or mongos")
    || message.includes("replica set")
    || error?.code === 20
  );
};

let transactionSupportPromise = null;

const detectTransactionSupport = async () => {
  const connection = mongoose.connection;
  if (!connection?.db) {
    return false;
  }

  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    return Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch (helloError) {
    try {
      const legacyHello = await connection.db.admin().command({ isMaster: 1 });
      return Boolean(legacyHello?.setName || legacyHello?.msg === "isdbgrid");
    } catch {
      return false;
    }
  }
};

const supportsTransactions = async () => {
  if (!transactionSupportPromise) {
    transactionSupportPromise = detectTransactionSupport().catch(() => false);
  }

  return transactionSupportPromise;
};

export const resetTransactionSupportCache = () => {
  transactionSupportPromise = null;
};

export const runInTransaction = async (work) => {
  if (!(await supportsTransactions())) {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      if (typeof session.inTransaction === "function" ? session.inTransaction() : true) {
        await session.abortTransaction().catch(() => {});
      }
      resetTransactionSupportCache();
      return work(null);
    }

    if (typeof session.inTransaction === "function" ? session.inTransaction() : true) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export { UNSUPPORTED_TRANSACTION_MESSAGE };
