export const clampNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const round2 = (value) => Math.round(clampNumber(value) * 100) / 100;

export const recomputeSaleTotals = ({
  items = [],
  discountPercent = 0,
  discountAmount,
  exchangeItems = [],
  advanceAmount = 0,
  creditDue = 0,
  paymentBreakdown = [],
  billType = "cashpay"
}) => {
  const subtotal = round2(items.reduce((sum, item) => sum + round2(item.total), 0));
  const normalizedDiscountPercent = round2(discountPercent);
  const computedDiscountAmount = round2(
    discountAmount ?? ((subtotal * normalizedDiscountPercent) / 100)
  );
  const exchangeAmount = round2(exchangeItems.reduce((sum, item) => sum + round2(item.amount), 0));
  const payable = round2(Math.max(0, subtotal - computedDiscountAmount - exchangeAmount));
  const paidAmount = round2(paymentBreakdown.reduce((sum, row) => sum + round2(row.amount), 0));
  const normalizedAdvanceAmount = round2(advanceAmount);
  const totalSettled = round2(paidAmount + normalizedAdvanceAmount);
  const computedCreditDue = ["credit", "advance"].includes(billType)
    ? round2(Math.max(0, payable - totalSettled))
    : 0;

  return {
    subtotal,
    discountPercent: normalizedDiscountPercent,
    discountAmount: computedDiscountAmount,
    exchangeAmount,
    payable,
    paidAmount,
    advanceAmount: normalizedAdvanceAmount,
    creditDue: round2(creditDue ?? computedCreditDue),
    computedCreditDue
  };
};
