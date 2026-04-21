export const BALANCE_QUERIES = {
  getAccountBalance: `SELECT balance, currency FROM gl_accounts WHERE account_code = ?`,
  getTrialBalance: `
    SELECT
      ga.account_code,
      ga.account_name,
      ga.account_type,
      SUM(je.debit_amount) as debit_total,
      SUM(je.credit_amount) as credit_total,
      SUM(je.debit_amount) - SUM(je.credit_amount) as balance
    FROM gl_accounts ga
    LEFT JOIN journal_entries je ON je.account_code = ga.account_code AND je.status = 'posted'
    GROUP BY ga.account_code, ga.account_name, ga.account_type
    ORDER BY ga.account_code
  `,
  validateBalance: `
    SELECT
      SUM(debit_amount) as total_debits,
      SUM(credit_amount) as total_credits,
      SUM(debit_amount) - SUM(credit_amount) as difference
    FROM journal_entries
    WHERE status = 'posted'
  `,
};
