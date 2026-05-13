import assert from "node:assert/strict";
import test from "node:test";
import { parsePurchaseBillScanSource } from "../utils/purchaseBillScanner.js";

test("parsePurchaseBillScanSource parses Saraswati Fabrics textile bill rows", () => {
  const result = parsePurchaseBillScanSource(`
SARASWATI FABRICS
TAX INVOICE
Invoice No. : 713
Invoice Date : 09/12/2025
Name : RANISAAJ BOUTIQUE
Sr.No.|Description Of Goods HSN Cut Pcs Mts Rate Pe Amount
1. RUBY SILK 5407 1 20.00 88.00 M 1760.00
2. SIMAR SILK 5407 8 138.50 105.00 M 14542.50
Net Amount 239406.00
`);

  assert.equal(result.party, "SARASWATI FABRICS");
  assert.equal(result.billNo, "713");
  assert.equal(result.billDate, "2025-12-09");
  assert.equal(result.billAmount, 239406);
  assert.equal(result.items.length, 2);
  assert.deepEqual(
    {
      name: result.items[0].name,
      hsn: result.items[0].hsn,
      qty: result.items[0].qty,
      unit: result.items[0].unit,
      purchaseRate: result.items[0].purchaseRate,
      amount: result.items[0].amount
    },
    {
      name: "RUBY SILK",
      hsn: "5407",
      qty: 20,
      unit: "MTRS",
      purchaseRate: 88,
      amount: 1760
    }
  );
});

test("parsePurchaseBillScanSource parses grid tax invoice rows and corrects OCR rate drift", () => {
  const result = parsePurchaseBillScanSource(`
SARASWATI SAREE DEPOT LTD.
Tax Invoice
Invoice No = SRR/56002
Date 21-08-2025
S.No. | DESCRIPTION OF GOODS HSN| CH.No Pcs Mtr Rate | GST%| Taxable Amt,
1 ISAREE 7 REYNOLDS 88 RAW COPPER 500720}7/70278 56 877.19 5 32,320.40
Net Amount 33936.00
`);

  assert.equal(result.party, "SARASWATI SAREE DEPOT LTD.");
  assert.equal(result.billNo, "SRR/56002");
  assert.equal(result.billDate, "2025-08-21");
  assert.equal(result.billAmount, 33936);
  assert.equal(result.items.length, 1);
  assert.deepEqual(
    {
      name: result.items[0].name,
      hsn: result.items[0].hsn,
      qty: result.items[0].qty,
      unit: result.items[0].unit,
      purchaseRate: result.items[0].purchaseRate,
      amount: result.items[0].amount
    },
    {
      name: "ISAREE 7 REYNOLDS 88 RAW COPPER",
      hsn: "500720",
      qty: 56,
      unit: "PCS",
      purchaseRate: 577.15,
      amount: 32320.4
    }
  );
});
