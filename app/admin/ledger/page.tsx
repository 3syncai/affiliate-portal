"use client";

import { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import {
  formatSignedCommission,
  isVoidedLedgerEntry,
  ledgerCommissionClass,
} from "@/lib/ledger-commission-display";
import {
  LEDGER_CSV_HEADERS,
  csvEscape,
  formatCommissionSourceLabel,
  formatLedgerExportDate,
  formatLedgerRoleLabel,
} from "@/lib/ledger-export";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Download,
    Filter,
    Calendar
} from "lucide-react";

interface LedgerItem {
    id: string;
    created_at: string;
    order_id: string;
    product_name: string;
    quantity: number;
    item_price: number;
    order_amount: number;
    commission_amount: number;
    affiliate_commission: number;
    branch_admin_bonus: number;
    status: string;
    commission_source: string;
    first_name: string;
    last_name: string;
    email: string;
    refer_code: string;
    is_agent: boolean;
    has_return?: boolean;
    sale_location?: string;
    sale_by_name?: string;
    sale_by_code?: string;
}

const ledgerDisplayStatus = (item: LedgerItem) =>
    item.has_return ? "RETURNED" : item.status;

const ledgerStatusBadgeClass = (item: LedgerItem) => {
    const label = ledgerDisplayStatus(item);
    if (label === "RETURNED") return "bg-rose-100 text-rose-800";
    if (label === "CREDITED") return "bg-green-100 text-green-800";
    if (label === "PENDING") return "bg-yellow-100 text-yellow-800";
    if (label === "CANCELLED") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
};

const fetcher = (url: string) => axios.get(url).then((res) => res.data);

export default function CommissionLedgerPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const { data, isLoading } = useSWR(
        `/api/admin/ledger?page=${page}&limit=${limit}&search=${searchTerm}&status=${statusFilter}`,
        fetcher
    );

    const ledger = data?.data || [];
    const pagination = data?.pagination || { total: 0, totalPages: 1 };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata"
        });
    };

    const getRoleBadge = (item: LedgerItem) => {
        let role = "User";
        let colorClass = "bg-gray-100 text-gray-800";

        if (item.is_agent) {
            role = "Sales Executive";
            colorClass = "bg-purple-100 text-purple-800";
        } else if (item.commission_source === 'state_admin' || item.commission_source === 'state_admin_direct') {
            role = "State Admin";
            colorClass = "bg-blue-100 text-blue-800";
        } else if (item.commission_source === 'area_manager') {
            role = "Area Sales Manager";
            colorClass = "bg-indigo-100 text-indigo-800";
        } else if (item.commission_source === 'branch_admin' || (item.commission_source && item.commission_source.includes('branch'))) {
            role = "Branch Admin";
            colorClass = "bg-orange-100 text-orange-800";
        }

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                {role}
            </span>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(amount);
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`/api/admin/ledger?limit=-1&search=${searchTerm}&status=${statusFilter}`);
            if (response.data.success) {
                const data = response.data.data;
                const csvRows = data.map((item: LedgerItem) =>
                    [
                        csvEscape(formatLedgerExportDate(item.created_at)),
                        csvEscape(item.product_name),
                        csvEscape(item.order_id),
                        csvEscape(item.sale_location || ""),
                        csvEscape(item.sale_by_name || "Unknown"),
                        csvEscape(item.sale_by_code || ""),
                        item.quantity ?? 0,
                        item.item_price ?? 0,
                        item.order_amount ?? 0,
                        item.affiliate_commission ?? 0,
                        ledgerDisplayStatus(item),
                        formatCommissionSourceLabel(item.commission_source),
                        formatLedgerRoleLabel(item),
                    ].join(","),
                );

                const csvContent = [LEDGER_CSV_HEADERS.join(","), ...csvRows].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute(
                    "download",
                    `partner-module-ledger-${new Date().toISOString().split("T")[0]}.csv`,
                );
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export data");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Commission Ledger</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Comprehensive history of all commission transactions
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer w-full sm:w-auto shrink-0"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search Order ID, Product, Agent Name..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="CREDITED">Credited</option>
                        <option value="PENDING">Pending</option>
                        <option value="RETURNED">Returned</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
                        Loading...
                    </div>
                ) : ledger.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
                        No records found
                    </div>
                ) : (
                    ledger.map((item: LedgerItem) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0"
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">
                                        {item.product_name}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono truncate">
                                        ID: {item.order_id}
                                    </p>
                                </div>
                                <span
                                    className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${ledgerStatusBadgeClass(item)}`}
                                >
                                    {ledgerDisplayStatus(item)}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                                <div className="min-w-0">
                                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                                        Date
                                    </p>
                                    <p className="font-medium text-gray-900">
                                        {formatDate(item.created_at).split(",")[0]}
                                    </p>
                                    <p className="text-[11px] text-gray-500">
                                        {formatDate(item.created_at).split(",")[1]}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                                        Qty
                                    </p>
                                    <p className="font-medium text-gray-900">{item.quantity}</p>
                                </div>
                                <div className="min-w-0 col-span-2">
                                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                                        Agent
                                    </p>
                                    <p className="font-medium text-gray-900 truncate">
                                        {item.first_name
                                            ? `${item.first_name} ${item.last_name}`
                                            : "Unknown"}
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                        {item.refer_code}
                                    </p>
                                    <div className="mt-1">{getRoleBadge(item)}</div>
                                </div>
                                <div className="min-w-0">
                                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                                        Order Amt
                                    </p>
                                    <p className="font-semibold text-gray-900">
                                        {formatCurrency(item.order_amount)}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                                        Commission
                                    </p>
                                    <p
                                        className={ledgerCommissionClass(
                                            item.affiliate_commission,
                                            isVoidedLedgerEntry(item),
                                        )}
                                    >
                                        {formatSignedCommission(item.affiliate_commission)}
                                    </p>
                                    {item.branch_admin_bonus > 0 && (
                                        <p className="text-[11px] text-blue-600">
                                            Incl. Bonus: {formatCurrency(item.branch_admin_bonus)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Amt</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : ledger.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No records found</td>
                                </tr>
                            ) : (
                                ledger.map((item: LedgerItem) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{formatDate(item.created_at).split(',')[0]}</span>
                                                <span className="text-xs">{formatDate(item.created_at).split(',')[1]}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="font-medium text-gray-900">{item.product_name}</div>
                                            <div className="text-gray-500 text-xs">ID: {item.order_id}</div>
                                            <div className="text-gray-500 text-xs">Qty: {item.quantity}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center">
                                                <div className="ml-0">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {item.first_name ? `${item.first_name} ${item.last_name}` : 'Unknown'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{item.refer_code}</div>
                                                    {getRoleBadge(item)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                            {formatCurrency(item.order_amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                            <div className="flex flex-col items-end">
                                                <span
                                                    className={ledgerCommissionClass(
                                                        item.affiliate_commission,
                                                        isVoidedLedgerEntry(item),
                                                    )}
                                                >
                                                    {formatSignedCommission(item.affiliate_commission)}
                                                </span>
                                                {item.branch_admin_bonus > 0 && (
                                                    <span className="text-xs text-blue-600">Incl. Bonus: {formatCurrency(item.branch_admin_bonus)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span
                                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${ledgerStatusBadgeClass(item)}`}
                                            >
                                                {ledgerDisplayStatus(item)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="bg-white px-3 sm:px-6 py-3 border border-gray-200 rounded-xl shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-700 text-center sm:text-left">
                    Showing{" "}
                    <span className="font-medium">{pagination.total === 0 ? 0 : (page - 1) * limit + 1}</span>{" "}
                    to{" "}
                    <span className="font-medium">{Math.min(page * limit, pagination.total)}</span>{" "}
                    of <span className="font-medium">{pagination.total}</span> results
                </p>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px self-center" aria-label="Pagination">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                </nav>
            </div>
        </div>
    );
}
