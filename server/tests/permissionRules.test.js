import test from "node:test";
import assert from "node:assert/strict";
import { getRoleRules } from "../utils/permissionRules.js";

test("admin has broad permissions", () => {
  const rules = getRoleRules("admin");
  assert.equal(rules.allowPriceOverride, true);
  assert.equal(rules.canCloseSession, true);
  assert.equal(rules.canAdjustStock, true);
  assert.equal(rules.maxBillDiscountPercent, 100);
});

test("sales role is restricted", () => {
  const rules = getRoleRules("sales");
  assert.equal(rules.allowPriceOverride, false);
  assert.equal(rules.canCloseSession, false);
  assert.equal(rules.canBroadcast, false);
  assert.equal(rules.canDeletePurchase, false);
  assert.equal(rules.maxBillDiscountPercent, 10);
});

test("stock role can adjust stock but cannot delete purchase bills", () => {
  const rules = getRoleRules("stock");
  assert.equal(rules.canAdjustStock, true);
  assert.equal(rules.canDeletePurchase, false);
  assert.equal(rules.canCloseSession, false);
});
