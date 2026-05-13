import AccountingAdjustmentEntry from "./AccountingAdjustmentEntry";

export default function PaymentEntry() {
  return (
    <AccountingAdjustmentEntry
      title="Payment Entry"
      description="Record debit entries against customer ledgers for payouts, write-offs, or manual adjustments."
      formTitle="New Payment Entry"
      saveLabel="Save Payment Entry"
      successMessage="Payment entry saved."
      defaultDirection="debit"
    />
  );
}
