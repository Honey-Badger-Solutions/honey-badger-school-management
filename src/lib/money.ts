/** Amounts are whole Ethiopian Birr (integers). */
export function fmtETB(amount: number): string {
  return `ETB ${amount.toLocaleString('en-US')}`
}

/** '1,250.00' style for receipts */
export function fmtAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
