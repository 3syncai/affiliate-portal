"use client";

import { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
} from "lucide-react";

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
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Returns</h1>
          <p className="text-sm text-gray-500">
            Referral-code orders with a customer return request
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Order ID, Product, Agent Name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="APPROVED">Return Approved</option>
            <option value="RETURNED">Returned (commission voided)</option>
            <option value="PENDING">Commission Pending</option>
            <option value="CREDITED">Commission Credited</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No referral return records found
                  </td>
                </tr>
              ) : (
                returns.map((item: ReturnLedgerItem) => (
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
                          className={`font-bold ${
                            item.has_return || item.affiliate_commission === 0
                              ? "text-gray-400 line-through"
                              : "text-emerald-600"
                          }`}
                        >
                          +{formatCurrency(item.affiliate_commission)}
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
                ))
              )}
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
    </div>
  );
}
