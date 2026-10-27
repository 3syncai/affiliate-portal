"use client";

import { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  formatSignedCommission,
  isVoidedLedgerEntry,
  ledgerCommissionClass,
} from "@/lib/ledger-commission-display";

interface ReturnLedgerItem {
  id: string;
  created_at: string;
  order_id: string;
  product_name: string;
  quantity: number;
  order_amount: number;
  commission_amount: number;
  affiliate_commission: number;
  branch_admin_bonus: number;
  status: string;
  commission_source: string;
  unlock_at: string | null;
  first_name: string;
  last_name: string;
  email: string;
  refer_code: string;
  is_agent: boolean;
  return_status: string | null;
  return_requested_at: string | null;
  has_return: boolean;
}

const fetcher = (url: string) => axios.get(url).then((res) => res.data);

export default function AdminReturnsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading } = useSWR(
    `/api/admin/returns?page=${page}&limit=${limit}&search=${searchTerm}&status=${statusFilter}`,
    fetcher,
  );

  const returns = data?.data || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const displayStatus = (item: ReturnLedgerItem) => {
    if (item.has_return) return "RETURNED";
    return item.status;
  };

  const statusBadgeClass = (item: ReturnLedgerItem) => {
    const label = displayStatus(item);
    if (label === "RETURNED") return "bg-rose-100 text-rose-800";
    if (label === "CREDITED") return "bg-green-100 text-green-800";
    if (label === "PENDING") return "bg-yellow-100 text-yellow-800";
    if (label === "CANCELLED") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(
        `/api/admin/returns?limit=-1&search=${searchTerm}&status=${statusFilter}`,
      );
      if (response.data.success) {
        const rows = response.data.data as ReturnLedgerItem[];
        const csvHeader = [
          "Date,Order ID,Product,Qty,Order Amount,Commission,Commission Status,Return Status,Source,Agent Name,Refer Code",
        ];
        const csvRows = rows.map((item) =>
          [
            `"${new Date(item.created_at).toLocaleDateString("en-IN")}"`,
            `"${item.order_id}"`,
            `"${item.product_name}"`,
            item.quantity,
            item.order_amount,
            item.affiliate_commission,
            displayStatus(item),
            `"${item.return_status || ""}"`,
            item.commission_source,
            `"${item.first_name ? item.first_name + " " + item.last_name : "Unknown"}"`,
            `"${item.refer_code}"`,
          ].join(","),
        );

        const csvContent =
          "data:text/csv;charset=utf-8," +
          [csvHeader, ...csvRows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute(
          "download",
          `referral_returns_${new Date().toISOString().split("T")[0]}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-4 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Returns</h1>
          <p className="text-sm text-gray-500">
            Referral-code orders with a customer return request
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary stats (page totals) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500">Total Results</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{pagination.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500">This Page</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">{returns.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm text-gray-500">Filter</p>
          <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{statusFilter}</p>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Order ID, Product, Agent Name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(
            [
              { value: "ALL", label: "All Status" },
              { value: "AWAITING_APPROVAL", label: "Awaiting Approval" },
              { value: "APPROVED", label: "Return Approved" },
              { value: "RETURNED", label: "Returned" },
              { value: "PENDING", label: "Commission Pending" },
              { value: "CREDITED", label: "Commission Credited" },
              { value: "CANCELLED", label: "Cancelled" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => {
                setStatusFilter(chip.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === chip.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center text-gray-500">
          No referral return records found
        </div>
      ) : (
        <>
          {/* Mobile return cards */}
          <div className="md:hidden space-y-3">
            {returns.map((item: ReturnLedgerItem) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-500 font-mono">ID: {item.order_id}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${statusBadgeClass(item)}`}
                  >
                    {displayStatus(item)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Agent</p>
                    <p className="font-medium text-gray-900 truncate">
                      {item.first_name
                        ? `${item.first_name} ${item.last_name}`.trim()
                        : "Unknown"}
                    </p>
                    <p className="text-gray-500 truncate">{item.refer_code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Date</p>
                    <p>{formatDate(item.return_requested_at || item.created_at).split(",")[0]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Order Amt</p>
                    <p className="font-bold text-gray-900">{formatCurrency(item.order_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Commission</p>
                    <p
                      className={ledgerCommissionClass(
                        item.affiliate_commission,
                        isVoidedLedgerEntry(item),
                      )}
                    >
                      {formatSignedCommission(item.affiliate_commission)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Amt
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returns.map((item: ReturnLedgerItem) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {formatDate(item.return_requested_at || item.created_at).split(",")[0]}
                          </span>
                          <span className="text-xs">
                            {formatDate(item.return_requested_at || item.created_at).split(",")[1]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">
                          {item.product_name}
                        </div>
                        <div className="text-gray-500 text-xs">ID: {item.order_id}</div>
                        <div className="text-gray-500 text-xs">Qty: {item.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-sm font-medium text-gray-900">
                          {item.first_name
                            ? `${item.first_name} ${item.last_name}`.trim()
                            : "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500">{item.refer_code}</div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                          Sales Executive
                        </span>
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
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(item)}`}
                        >
                          {displayStatus(item)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">
                      {pagination.total === 0 ? 0 : (page - 1) * limit + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(page * limit, pagination.total)}
                    </span>{" "}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(pagination.totalPages, p + 1))
                      }
                      disabled={page === pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile pagination */}
          <div className="md:hidden flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </button>
            <p className="text-xs text-gray-600">
              Page {page} / {pagination.totalPages || 1}
            </p>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
