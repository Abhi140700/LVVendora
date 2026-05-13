import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { resetTransactionSupportCache, runInTransaction, UNSUPPORTED_TRANSACTION_MESSAGE } from "../utils/transaction.js";

test.afterEach(() => {
  resetTransactionSupportCache();
});

test("runInTransaction commits on success and returns result", async () => {
  const originalDb = mongoose.connection.db;
  const originalStartSession = mongoose.startSession;
  const calls = [];

  mongoose.connection.db = {
    admin() {
      return {
        async command() {
          return { setName: "rs0" };
        }
      };
    }
  };

  mongoose.startSession = async () => ({
    startTransaction() {
      calls.push("start");
    },
    inTransaction() {
      return true;
    },
    async commitTransaction() {
      calls.push("commit");
    },
    async abortTransaction() {
      calls.push("abort");
    },
    async endSession() {
      calls.push("end");
    }
  });

  try {
    const result = await runInTransaction(async () => {
      calls.push("work");
      return 42;
    });

    assert.equal(result, 42);
    assert.deepEqual(calls, ["start", "work", "commit", "end"]);
  } finally {
    mongoose.connection.db = originalDb;
    mongoose.startSession = originalStartSession;
  }
});

test("runInTransaction aborts on error and rethrows", async () => {
  const originalDb = mongoose.connection.db;
  const originalStartSession = mongoose.startSession;
  const calls = [];

  mongoose.connection.db = {
    admin() {
      return {
        async command() {
          return { setName: "rs0" };
        }
      };
    }
  };

  mongoose.startSession = async () => ({
    startTransaction() {
      calls.push("start");
    },
    inTransaction() {
      return true;
    },
    async commitTransaction() {
      calls.push("commit");
    },
    async abortTransaction() {
      calls.push("abort");
    },
    async endSession() {
      calls.push("end");
    }
  });

  try {
    await assert.rejects(
      runInTransaction(async () => {
        calls.push("work");
        throw new Error("boom");
      }),
      /boom/
    );

    assert.deepEqual(calls, ["start", "work", "abort", "end"]);
  } finally {
    mongoose.connection.db = originalDb;
    mongoose.startSession = originalStartSession;
  }
});

test("runInTransaction falls back cleanly on standalone Mongo", async () => {
  const originalDb = mongoose.connection.db;
  const originalStartSession = mongoose.startSession;
  const calls = [];

  mongoose.connection.db = {
    admin() {
      return {
        async command() {
          return {};
        }
      };
    }
  };

  mongoose.startSession = async () => {
    calls.push("startSession");
    throw new Error("startSession should not be called on standalone Mongo");
  };

  try {
    const result = await runInTransaction(async (session) => {
      calls.push(["work", session]);
      return "fallback";
    });

    assert.equal(result, "fallback");
    assert.deepEqual(calls, [["work", null]]);
  } finally {
    mongoose.connection.db = originalDb;
    mongoose.startSession = originalStartSession;
  }
});

test("runInTransaction retries without a session if Mongo rejects transactions mid-flight", async () => {
  const originalDb = mongoose.connection.db;
  const originalStartSession = mongoose.startSession;
  const calls = [];

  mongoose.connection.db = {
    admin() {
      return {
        async command() {
          return { setName: "rs0" };
        }
      };
    }
  };

  mongoose.startSession = async () => ({
    startTransaction() {
      calls.push("start");
    },
    inTransaction() {
      return true;
    },
    async commitTransaction() {
      calls.push("commit");
    },
    async abortTransaction() {
      calls.push("abort");
    },
    async endSession() {
      calls.push("end");
    }
  });

  let firstAttempt = true;

  try {
    const result = await runInTransaction(async (session) => {
      calls.push(["work", session ? "session" : null]);
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error(UNSUPPORTED_TRANSACTION_MESSAGE);
      }
      return "fallback-after-error";
    });

    assert.equal(result, "fallback-after-error");
    assert.deepEqual(calls, ["start", ["work", "session"], "abort", ["work", null], "end"]);
  } finally {
    mongoose.connection.db = originalDb;
    mongoose.startSession = originalStartSession;
  }
});
