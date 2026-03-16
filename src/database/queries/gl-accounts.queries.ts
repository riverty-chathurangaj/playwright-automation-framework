export const GL_ACCOUNT_QUERIES = {
  getByCode: `SELECT * FROM gl_accounts WHERE account_code = ?`,
  getById: `SELECT * FROM gl_accounts WHERE account_id = ?`,
  getAll: `SELECT * FROM gl_accounts WHERE is_active = 1 ORDER BY account_code`,
  getBalance: `SELECT balance FROM gl_accounts WHERE account_code = ?`,
  exists: `SELECT COUNT(*) as count FROM gl_accounts WHERE account_code = ?`,
  getByType: `SELECT * FROM gl_accounts WHERE account_type = ? ORDER BY account_code`,
  countByType: `SELECT account_type, COUNT(*) as count FROM gl_accounts GROUP BY account_type`,
};
