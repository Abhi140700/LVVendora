export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const calculateExpectedCash = ({ openingCash = 0, expenseAmount = 0, sales = [] }) => {
  const cashFromSales = sales.reduce((sum, sale) => {
    const rowSum = (sale.paymentBreakdown || [])
      .filter((row) => String(row.mode || "").toLowerCase() === "cash")
      .reduce((innerSum, row) => innerSum + round2(row.amount), 0);
    return sum + rowSum;
  }, 0);

  return round2(round2(openingCash) + round2(cashFromSales) - round2(expenseAmount));
};
