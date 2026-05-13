export const ROLE_RULES = {
  superadmin: {
    allowPriceOverride: true,
    maxBillDiscountPercent: 100,
    maxLineDiscountPercent: 100,
    canCloseSession: true,
    canBroadcast: true,
    canReprintLabel: true,
    canReprintBill: true,
    canRecallHoldBill: true,
    canDeleteBill: true,
    canDeletePurchase: true,
    canAdjustStock: true
  },
  admin: {
    allowPriceOverride: true,
    maxBillDiscountPercent: 100,
    maxLineDiscountPercent: 100,
    canCloseSession: true,
    canBroadcast: true,
    canReprintLabel: true,
    canReprintBill: true,
    canRecallHoldBill: true,
    canDeleteBill: true,
    canDeletePurchase: true,
    canAdjustStock: true
  },
  manager: {
    allowPriceOverride: true,
    maxBillDiscountPercent: 25,
    maxLineDiscountPercent: 25,
    canCloseSession: true,
    canBroadcast: true,
    canReprintLabel: true,
    canReprintBill: true,
    canRecallHoldBill: true,
    canDeleteBill: false,
    canDeletePurchase: false,
    canAdjustStock: false
  },
  sales: {
    allowPriceOverride: false,
    maxBillDiscountPercent: 10,
    maxLineDiscountPercent: 10,
    canCloseSession: false,
    canBroadcast: false,
    canReprintLabel: false,
    canReprintBill: false,
    canRecallHoldBill: true,
    canDeleteBill: false,
    canDeletePurchase: false,
    canAdjustStock: false
  },
  accountant: {
    allowPriceOverride: false,
    maxBillDiscountPercent: 0,
    maxLineDiscountPercent: 0,
    canCloseSession: true,
    canBroadcast: false,
    canReprintLabel: false,
    canReprintBill: false,
    canRecallHoldBill: false,
    canDeleteBill: false,
    canDeletePurchase: false,
    canAdjustStock: false
  },
  stock: {
    allowPriceOverride: false,
    maxBillDiscountPercent: 0,
    maxLineDiscountPercent: 0,
    canCloseSession: false,
    canBroadcast: false,
    canReprintLabel: true,
    canReprintBill: false,
    canRecallHoldBill: false,
    canDeleteBill: false,
    canDeletePurchase: false,
    canAdjustStock: true
  }
};

export const getRoleRules = (role) => ROLE_RULES[role] || ROLE_RULES.sales;
