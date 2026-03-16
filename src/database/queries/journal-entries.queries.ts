export const JOURNAL_ENTRY_QUERIES = {
  getById: `SELECT * FROM journal_entries WHERE journal_id = ?`,
  getByAccount: `SELECT * FROM journal_entries WHERE account_code = ? ORDER BY created_at DESC`,
  getPosted: `SELECT * FROM journal_entries WHERE status = 'posted' ORDER BY posting_date DESC`,
  getByStatus: `SELECT * FROM journal_entries WHERE status = ? ORDER BY created_at DESC`,
  getTotals: `
    SELECT
      SUM(debit_amount) as total_debits,
      SUM(credit_amount) as total_credits,
      ABS(SUM(debit_amount) - SUM(credit_amount)) as imbalance
    FROM journal_entries
    WHERE status = 'posted'
  `,
  getForPeriod: `
    SELECT * FROM journal_entries
    WHERE account_code = ?
    AND posting_date BETWEEN ? AND ?
    ORDER BY posting_date ASC
  `,
  checkBalance: `
    SELECT
      CASE WHEN ABS(SUM(debit_amount) - SUM(credit_amount)) < 0.001 THEN 1 ELSE 0 END as is_balanced
    FROM journal_entries
    WHERE status = 'posted'
  `,
};
