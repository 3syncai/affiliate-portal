import {
  RETURN_REQUEST_APPROVED_STATUSES,
  RETURN_REQUEST_REJECTED_STATUSES,
  returnStatusSqlList,
} from "@/lib/return-request-status";

const REJECTED_SQL = returnStatusSqlList(RETURN_REQUEST_REJECTED_STATUSES);
const APPROVED_SQL = returnStatusSqlList(RETURN_REQUEST_APPROVED_STATUSES);

/** Admin-approved return — voids commission, stops timer, shows RETURNED badge. */
export const COMMISSION_HAS_RETURN_SQL = `
  EXISTS (
    SELECT 1 FROM return_request rr
    WHERE rr.order_id = acl.order_id
      AND rr.deleted_at IS NULL
      AND LOWER(COALESCE(rr.status, '')) IN (${APPROVED_SQL})
  )
`;

/** Any non-rejected return request, including awaiting admin approval. */
export const COMMISSION_HAS_ANY_RETURN_REQUEST_SQL = `
  EXISTS (
    SELECT 1 FROM return_request rr
    WHERE rr.order_id = acl.order_id
      AND rr.deleted_at IS NULL
      AND LOWER(COALESCE(rr.status, '')) NOT IN (${REJECTED_SQL})
  )
`;

/** Cancelled commission row or any active customer return request. */
export const COMMISSION_IS_RETURN_OR_CANCELLED_SQL = `
  acl.status = 'CANCELLED' OR ${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL}
`;
