import test from "node:test";
import assert from "node:assert/strict";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const recomputePurchaseTotals = ({
  items = [],
  addCharges = 0,
  gstRate = 0,
  packingRoundoff = 0,
  discountTotal = 0,
}) => {
  const subtotal = round2(items.reduce((sum, item) => sum + Number(item.total || 0), 0));
  const taxableAmount = round2(Math.max(0, subtotal - Number(discountTotal || 0)));
  const gstAmount = round2((taxableAmount * Number(gstRate || 0)) / 100);
  return {
    subtotal,
    taxableAmount,
    totalGst: gstAmount,
    finalTotal: round2(taxableAmount + gstAmount + Number(addCharges || 0) + Number(packingRoundoff || 0)),
  };
};

test("purchase totals are recomputed from item totals", () => {
  const result = recomputePurchaseTotals({
    items: [{ total: 100 }, { total: 50 }],
    addCharges: 10,
    gstRate: 18,
    discountTotal: 20,
  });

  assert.equal(result.subtotal, 150);
  assert.equal(result.taxableAmount, 130);
  assert.equal(result.totalGst, 23.4);
  assert.equal(result.finalTotal, 163.4);
});
