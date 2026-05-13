import { describe, expect, it } from "vitest";
import {
    applyDiscountPercentToLines,
    createLineItem,
    getBarcodeDefaultQty,
    getLineBillableQty,
    getLineDiscountAmount,
    recalculateLine,
    round2,
} from "./salesPOSUtils";
import {
    getBillActionGuard,
    getLineUpdateGuard,
    hasRecoverableBillState,
    validateSaleBeforeSave,
} from "./posLogic";

describe("validateSaleBeforeSave", () => {
    it("blocks bill completion when no items exist", () => {
        expect(validateSaleBeforeSave({ lines: [] })).toBe("Add at least one item to the bill.");
    });

    it("blocks bill completion on stock warnings", () => {
        expect(validateSaleBeforeSave({
            lines: [{ id: "1" }],
            stockWarnings: [{ itemName: "Shirt" }],
        })).toContain("Stock warning");
    });

    it("blocks credit sale without customer", () => {
        expect(validateSaleBeforeSave({
            lines: [{ id: "1" }],
            activeMode: "credit",
            customerName: "",
            permissionRules: { maxBillDiscountPercent: 10 },
        })).toBe("Customer is required for credit and advance bills.");
    });

    it("passes a valid cashpay bill", () => {
        expect(validateSaleBeforeSave({
            lines: [{ id: "1", lineDiscountPercent: 0 }],
            stockWarnings: [],
            discountPercent: 0,
            permissionRules: { maxBillDiscountPercent: 10 },
            salesSettings: { paymentRows: [] },
            activeMode: "cashpay",
            paidAmount: 100,
            advanceAmount: 0,
            payableAmount: 100,
            customerName: "Walk-in",
        })).toBe("");
    });
});

describe("getBillActionGuard", () => {
    const rules = { canDeleteBill: false, canRecallHoldBill: false, canReprintBill: false };

    it("blocks delete when role is not allowed", () => {
        expect(getBillActionGuard({ action: "delete", permissionRules: rules })).toContain("delete");
    });

    it("blocks recall when role is not allowed", () => {
        expect(getBillActionGuard({ action: "recall", permissionRules: rules })).toContain("recall");
    });
});

describe("getLineUpdateGuard", () => {
    it("blocks sale rate override for restricted roles", () => {
        expect(getLineUpdateGuard({
            field: "saleRate",
            value: 90,
            permissionRules: { allowPriceOverride: false },
            line: { saleRate: 100, mrp: 120 },
            role: "sales",
        })).toContain("override");
    });
});

describe("hasRecoverableBillState", () => {
    it("detects useful recovery snapshot", () => {
        expect(hasRecoverableBillState({ billNo: "B1", items: [] })).toBe(true);
        expect(hasRecoverableBillState({ items: [{ id: "1" }] })).toBe(true);
        expect(hasRecoverableBillState({})).toBe(false);
    });
});

describe("meter barcode quantity defaults", () => {
    it("creates MTRS lines with one piece qty and barcode Def. Qty as meters", () => {
        const line = createLineItem({
            _id: "inv-1",
            itemId: "item-1",
            name: "Suiting",
            unit: "MTRS",
            defaultSalesQty: 1.2,
            sellingRate: 100,
            stock: 10,
        });

        expect(line.qty).toBe(1);
        expect(line.mtrQty).toBe(1.2);
        expect(getLineBillableQty(line)).toBe(1.2);
        expect(line.lineTotal).toBe(120);
    });

    it("adds one piece and MTRS barcode Def. Qty on repeat scans", () => {
        const product = { unit: "MTRS", defaultSalesQty: 1.2 };
        const existing = { unit: "MTRS", qty: 1, mtrQty: 1.2, saleRate: 100, originalSaleRate: 100 };
        const nextLine = recalculateLine({
            ...existing,
            qty: Number(existing.qty) + 1,
            mtrQty: getLineBillableQty(existing) + getBarcodeDefaultQty(product),
        });

        expect(nextLine.qty).toBe(2);
        expect(nextLine.mtrQty).toBe(2.4);
        expect(getLineBillableQty(nextLine)).toBe(2.4);
        expect(round2(nextLine.lineTotal)).toBe(240);
    });
});

describe("item discount percentage", () => {
    it("applies entered discount percentage to sale rate while keeping MRP", () => {
        const [line] = applyDiscountPercentToLines([
            recalculateLine({
                id: "line-1",
                unit: "PCS",
                qty: 2,
                mrp: 460,
                saleRate: 460,
                originalSaleRate: 460,
            }),
        ], 10);

        expect(line.mrp).toBe(460);
        expect(line.saleRate).toBe(414);
        expect(line.lineTotal).toBe(828);
        expect(getLineDiscountAmount(line)).toBe(92);
    });

    it("uses MTRS quantity when applying discount percentage", () => {
        const [line] = applyDiscountPercentToLines([
            recalculateLine({
                id: "line-1",
                unit: "MTRS",
                qty: 1,
                mtrQty: 2.5,
                mrp: 120,
                saleRate: 100,
                originalSaleRate: 100,
            }),
        ], 10);

        expect(line.qty).toBe(1);
        expect(line.mtrQty).toBe(2.5);
        expect(line.saleRate).toBe(90);
        expect(line.lineTotal).toBe(225);
        expect(getLineDiscountAmount(line)).toBe(25);
    });
});
