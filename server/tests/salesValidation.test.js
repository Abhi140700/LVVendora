import test from "node:test";
import assert from "node:assert/strict";
import { recomputeSaleTotals } from "../utils/salesValidation.js";

test("recomputeSaleTotals recalculates totals from line items", () => {
  const result = recomputeSaleTotals({
    items: [{ total: 120 }, { total: 80 }],
    discountPercent: 10,
    paymentBreakdown: [{ mode: "Cash", amount: 180 }],
    billType: "cashpay"
  });

  assert.equal(result.subtotal, 200);
  assert.equal(result.discountAmount, 20);
  assert.equal(result.payable, 180);
  assert.equal(result.paidAmount, 180);
});

test("recomputeSaleTotals computes credit due for credit sale", () => {
  const result = recomputeSaleTotals({
    items: [{ total: 300 }],
    paymentBreakdown: [{ mode: "Cash", amount: 100 }],
    billType: "credit"
  });

  assert.equal(result.payable, 300);
  assert.equal(result.computedCreditDue, 200);
});
