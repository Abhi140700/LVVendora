import AccountingAdjustmentEntry from "./AccountingAdjustmentEntry";

export default function JournalEntry() {
  return (
    <AccountingAdjustmentEntry
      title="Journal Entry"
      description="Create credit or debit ledger adjustments for manual accounting corrections on customer balances."
      formTitle="New Journal Entry"
      saveLabel="Save Journal Entry"
      successMessage="Journal entry saved."
      defaultDirection="credit"
      allowDirectionChange
    />
  );
}
