import test from "node:test";
import assert from "node:assert/strict";
import { calculateExpectedCash } from "../utils/posSession.js";

test("calculateExpectedCash includes opening cash and only cash payments", () => {
  const result = calculateExpectedCash({
    openingCash: 1000,
    expenseAmount: 150,
    sales: [
      { paymentBreakdown: [{ mode: "Cash", amount: 500 }, { mode: "UPI", amount: 250 }] },
      { paymentBreakdown: [{ mode: "cash", amount: 200 }] },
    ]
  });

  assert.equal(result, 1550);
});

test("calculateExpectedCash handles empty sales", () => {
  const result = calculateExpectedCash({
    openingCash: 500,
    expenseAmount: 50,
    sales: []
  });

  assert.equal(result, 450);
});
