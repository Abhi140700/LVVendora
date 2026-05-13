import test from "node:test";
import assert from "node:assert/strict";
import Inventory from "../models/Inventory.js";
import { deductInventoryItems, restockInventoryItems } from "../services/inventoryService.js";

test("deductInventoryItems enforces stock floor when negative stock is disabled", async () => {
  const originalFindOneAndUpdate = Inventory.findOneAndUpdate;
  const calls = [];

  Inventory.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return null;
  };

  try {
    await assert.rejects(
      deductInventoryItems(
        [{ inventoryId: "inv1", qty: 5, itemName: "Shirt" }],
        { allowNegativeStock: false }
      ),
      /Insufficient or missing stock for Shirt/
    );

    assert.deepEqual(calls[0].filter, {
      _id: "inv1",
      stock: { $gte: 5 }
    });
    assert.deepEqual(calls[0].update, { $inc: { stock: -5 } });
  } finally {
    Inventory.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("deductInventoryItems skips stock floor when negative stock is enabled", async () => {
  const originalFindOneAndUpdate = Inventory.findOneAndUpdate;
  const calls = [];

  Inventory.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return { _id: "inv1", stock: -2 };
  };

  try {
    await deductInventoryItems(
      [{ inventoryId: "inv1", qty: 5, itemName: "Shirt" }],
      { allowNegativeStock: true }
    );

    assert.deepEqual(calls[0].filter, { _id: "inv1" });
    assert.deepEqual(calls[0].update, { $inc: { stock: -5 } });
  } finally {
    Inventory.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("restockInventoryItems matches by inventoryId, itemId, or barcode", async () => {
  const originalFindOneAndUpdate = Inventory.findOneAndUpdate;
  const calls = [];

  Inventory.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return { _id: "inv1", stock: 10 };
  };

  try {
    await restockInventoryItems([
      { inventoryId: "inv1", itemId: "item1", barcode: "abc123", qty: 3, itemName: "Shirt" }
    ]);

    assert.deepEqual(calls[0].filter, {
      $or: [
        { _id: "inv1" },
        { itemId: "item1" },
        { barcode: "abc123" }
      ]
    });
    assert.deepEqual(calls[0].update, { $inc: { stock: 3 } });
  } finally {
    Inventory.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
