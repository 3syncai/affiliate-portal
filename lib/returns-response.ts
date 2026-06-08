export type IssueType = "cancelled" | "return_requested" | "both";

export type ReturnOrderRow = {
  order_id: string;
  product_name: string;
  customer_name: string | null;
  customer_email: string | null;
  order_amount: number;
  commission_status: string;
  has_return: boolean;
  return_status: string | null;
  return_requested_at: string | null;
  issue_type: IssueType;
  created_at: string;
};

export function resolveIssueType(
  commissionStatus: string,
  hasReturn: boolean,
): IssueType {
  const cancelled = commissionStatus === "CANCELLED";
  if (cancelled && hasReturn) return "both";
  if (cancelled) return "cancelled";
  return "return_requested";
}

export function buildReturnsResponse(rows: Array<Record<string, unknown>>) {
  const orders: ReturnOrderRow[] = rows.map((row) => {
    const hasReturn = Boolean(row.has_return);
    const commissionStatus = String(row.commission_status || "");
    const issueType = resolveIssueType(commissionStatus, hasReturn);

    return {
      order_id: String(row.order_id),
      product_name: String(row.product_name || ""),
      customer_name: (row.customer_name as string | null) ?? null,
      customer_email: (row.customer_email as string | null) ?? null,
      order_amount: parseFloat(String(row.order_amount || "0")),
      commission_status: commissionStatus,
      has_return: hasReturn,
      return_status: (row.return_status as string | null) ?? null,
      return_requested_at: (row.return_requested_at as string | null) ?? null,
      issue_type: issueType,
      created_at: String(row.created_at),
    };
  });

  orders.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const cancelled = orders.filter(
    (o) => o.issue_type === "cancelled" || o.issue_type === "both",
  ).length;
  const returnRequested = orders.filter(
    (o) => o.issue_type === "return_requested" || o.issue_type === "both",
  ).length;

  return {
    stats: {
      total: orders.length,
      cancelled,
      returnRequested,
    },
    orders,
  };
}
