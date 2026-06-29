"use client";

import CommissionStatusBadge from "@/app/components/CommissionStatusBadge";
import {
    formatTransactionDate,
    saleLevelBadgeClass,
    saleLevelLabel,
    type RecentTransactionRow,
} from "@/lib/transaction-display";
import {
    formatSignedCommission,
    isVoidedLedgerEntry,
    ledgerCommissionClass,
} from "@/lib/ledger-commission-display";

type RecentTransactionsTableProps = {
    orders: RecentTransactionRow[];
    loading?: boolean;
    emptyMessage?: string;
    filterLabel?: string | null;
};

export default function RecentTransactionsTable({
    orders,
    loading = false,
    emptyMessage = "No earnings recorded yet.",
    filterLabel = null,
}: RecentTransactionsTableProps) {
    const emptyText = filterLabel
        ? `No transactions match this filter (${filterLabel.toLowerCase()}).`
        : emptyMessage;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                    Recent Transactions
                </h2>
                <div className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded border border-gray-200">
                    Last {orders.length} records
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-t-transparent border-gray-300 rounded-full animate-spin" />
                </div>
            ) : orders.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-sm">{emptyText}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Details
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer/Partner
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Your Earning
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {orders.map((order) => {
                                const voided = isVoidedLedgerEntry(order);

                                return (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatTransactionDate(order.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${saleLevelBadgeClass(order.saleLevel)}`}
                                            >
                                                {saleLevelLabel(order.saleLevel)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div className="font-medium text-gray-900">
                                                {order.product_name}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="text-xs text-gray-500">
                                                    #{order.order_id}
                                                </div>
                                                <CommissionStatusBadge
                                                    status={order.status || ""}
                                                    unlockAt={order.unlock_at}
                                                    hasReturn={order.has_return}
                                                    returnRequestPending={
                                                        order.has_return_request && !order.has_return
                                                    }
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="text-gray-900">
                                                {order.participant_name}
                                            </div>
                                            {order.participant_branch ? (
                                                <span className="block text-xs text-gray-400 mt-0.5">
                                                    {order.participant_branch}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td
                                            className={`px-6 py-4 whitespace-nowrap text-sm text-right ${ledgerCommissionClass(
                                                order.commission_amount,
                                                voided,
                                            )}`}
                                        >
                                            {formatSignedCommission(order.commission_amount)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
