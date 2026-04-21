export const AUDIT_TRAIL_QUERIES = {
  getForEntity: `
    SELECT * FROM audit_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at ASC
  `,
  getLatestForEntity: `
    SELECT TOP 1 * FROM audit_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `,
  getByAction: `
    SELECT * FROM audit_log
    WHERE entity_type = ? AND action = ?
    ORDER BY created_at DESC
  `,
  countMissingAudit: `
    SELECT COUNT(*) as count
    FROM journal_entries je
    LEFT JOIN audit_log al ON al.entity_id = je.journal_id AND al.entity_type = 'JournalEntry'
    WHERE je.status = 'posted' AND al.entity_id IS NULL
  `,
};
