"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { RotateCcw, Search, XCircle, Package, User, Users } from "lucide-react";
import CommissionStatusBadge from "@/app/components/CommissionStatusBadge";
import type { ReferralCategory, IssueType } from "@/lib/returns-response";

type ReturnOrder = {
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
  referral_category?: ReferralCategory;
  sale_type?: string;
  referrer_name?: string;
  refer_code?: string;
};

type ReturnStats = {
  total: number;
  cancelled: number;
  returnRequested: number;
  selfReturns?: number;
  teamReturns?: number;
};

type FilterKey =
  | "all"
  | "self"
  | "team"
  | "cancelled"
  | "return_requested";

type AsmUser = {
  id?: string;
  city?: string;
  state?: string;
  refer_code?: string;
};

export default function ASMReturnsPage() {
  const [orders, setOrders] = useState<ReturnOrder[]>([]);
  const [stats, setStats] = useState<ReturnStats>({
    total: 0,
    cancelled: 0,
    returnRequested: 0,
    selfReturns: 0,
    teamReturns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [user, setUser] = useState<AsmUser | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("affiliate_user");
    if (!userData) return;
    const parsed = JSON.parse(userData) as AsmUser;
    setUser(parsed);
    if (parsed.city && parsed.state) {
      fetchReturns(parsed);
    }
  }, []);

  const fetchReturns = async (adminUser: AsmUser) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        city: adminUser.city || "",
        state: adminUser.state || "",
      });
      if (adminUser.id) params.set("adminId", adminUser.id);
      if (adminUser.refer_code) params.set("refer_code", adminUser.refer_code);

      const response = await axios.get(
        `/api/asm/returns?${params.toString()}`,
      );
      if (response.data.success) {
        setOrders(response.data.orders || []);
        setStats(
          response.data.stats || {
            total: 0,
            cancelled: 0,
            returnRequested: 0,
            selfReturns: 0,
            teamReturns: 0,
          },
        );
      }
    } catch (error) {
      console.error("Failed to fetch returns:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "self" && order.referral_category === "self") ||
        (activeFilter === "team" && order.referral_category === "team") ||
        (activeFilter === "cancelled" &&
          (order.issue_type === "cancelled" || order.issue_type === "both")) ||
        (activeFilter === "return_requested" &&
          (order.issue_type === "return_requested" ||
            order.issue_type === "both"));

      if (!matchesFilter) return false;

      const q = searchTerm.toLowerCase();
      return (
        order.order_id.toLowerCase().includes(q) ||
        (order.product_name || "").toLowerCase().includes(q) ||
        (order.customer_name || "").toLowerCase().includes(q) ||
        (order.customer_email || "").toLowerCase().includes(q) ||
        (order.sale_type || "").toLowerCase().includes(q) ||
        (order.referrer_name || "").toLowerCase().includes(q) ||
        (order.refer_code || "").toLowerCase().includes(q)
      );
    });
  }, [orders, activeFilter, searchTerm]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatCurrency = (amount: number) =>
    `₹${(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const issueLabel = (type: IssueType) => {
    if (type === "both") return "Cancelled + Return";
    if (type === "cancelled") return "Cancelled";
    return "Return Requested";
  };

  const territoryLabel =
    user?.city && user?.state ? `${user.city}, ${user.state}` : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading returns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Total Returns</h1>
        <p className="text-gray-600 mt-1">
          Self-referral and team sales returns in {territoryLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Returns</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            Self Referral
          </p>
          <p className="text-2xl font-bold text-emerald-600">
            {stats.selfReturns ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Team Sales
          </p>
          <p className="text-2xl font-bold text-indigo-600">
            {stats.teamReturns ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Cancelled Orders</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Return Requested</p>
          <p className="text-2xl font-bold text-rose-600">
            {stats.returnRequested}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search order, product, customer, referrer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "self", label: "Self Referral" },
              { key: "team", label: "Team Sales" },
              { key: "cancelled", label: "Cancelled" },
              { key: "return_requested", label: "Return Requested" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveFilter(chip.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === chip.key
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No returns found for this filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sale Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Referrer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Issue Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      #{String(order.order_id).slice(-8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">
                      <span className="inline-flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {order.product_name || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.customer_name || order.customer_email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          order.referral_category === "self"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {order.referral_category === "self" ? (
                          <User className="w-3 h-3" />
                        ) : (
                          <Users className="w-3 h-3" />
                        )}
                        {order.sale_type || "Team Sales"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="font-medium">
                        {order.referrer_name || "—"}
                      </div>
                      {order.refer_code && (
                        <div className="text-xs text-gray-400 font-mono">
                          {order.refer_code}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                          order.issue_type === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : order.issue_type === "return_requested"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {order.issue_type === "cancelled" && (
                          <XCircle className="w-3 h-3" />
                        )}
                        {order.issue_type === "return_requested" && (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        {issueLabel(order.issue_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CommissionStatusBadge
                        status={order.commission_status}
                        hasReturn={order.has_return}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(
                        order.return_requested_at || order.created_at,
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(order.order_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
