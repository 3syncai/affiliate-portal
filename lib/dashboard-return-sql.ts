/** Shared return detection for dashboard order/return counts (read-only). */
export const COMMISSION_HAS_RETURN_SQL = `
  EXISTS (
    SELECT 1 FROM return_request rr
    WHERE rr.order_id = acl.order_id
      AND rr.deleted_at IS NULL
      AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
  )
`;

/** Cancelled commission row or active customer return request. */
export const COMMISSION_IS_RETURN_OR_CANCELLED_SQL = `
  acl.status = 'CANCELLED' OR ${COMMISSION_HAS_RETURN_SQL}
`;
