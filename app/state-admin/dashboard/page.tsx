"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import useSWR from "swr";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Users,
  DollarSign,
  ShoppingBag,
  Building2,
  Briefcase,
  ChevronRight,
  UserPlus,
  BarChart3,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Share2,
  Copy,
  Check,
  Sparkles,
  Wallet,
  MoreHorizontal,
  Wifi,
  WifiOff,
  Download,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import { Toast } from "@/components/Toast";
import { STORE_URL } from "@/lib/config";

type Activity = {
  id: string;
  type: string;
  message: string;
  branch_name: string;
  amount?: number;
  created_at: string;
};

type AdditionalCampaign = {
  id: number;
  product_id: string;
  product_name: string | null;
  product_thumbnail?: string | null;
  additional_rate: number;
  target_role: string;
  starts_at: string;
  ends_at: string | null;
};

const fetcher = (url: string) => axios.get(url).then((res) => res.data);

export default function StateAdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState<{
    message: string;
    amount?: number;
  }>({ message: "" });

  useEffect(() => {
    const userData = localStorage.getItem("affiliate_user");
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);

      if (!parsed.refer_code) {
        refreshUserProfile();
      }
    }
  }, []);

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });

  const generateBrandedQr = async (
    referCode: string,
    name: string,
    role: string,
  ) => {
    const signupUrl = `${STORE_URL}/signup?ref=${referCode}`;
    const qrSize = 300;
    const qrPadding = 20;
    const canvasWidth = qrSize + qrPadding * 2;
    const canvasHeight = qrSize + qrPadding * 2 + 68;
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, signupUrl, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    const qrX = qrPadding;
    const qrY = qrPadding;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    try {
      const logo = await loadImage("/uploads/coin/Oweg3d-400.png");
      const logoSize = 56;
      const logoX = qrX + (qrSize - logoSize) / 2;
      const logoY = qrY + (qrSize - logoSize) / 2;
      ctx.beginPath();
      ctx.arc(
        logoX + logoSize / 2,
        logoY + logoSize / 2,
        logoSize / 2 + 8,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch (error) {
      console.error("State-admin logo overlay failed:", error);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#111827";
    ctx.font = "600 16px Arial";
    ctx.fillText(name || "State Admin", canvasWidth / 2, qrY + qrSize + 30);
    ctx.fillStyle = "#4B5563";
    ctx.font = "500 14px Arial";
    ctx.fillText(role || "State Admin", canvasWidth / 2, qrY + qrSize + 52);
    setQrDataUrl(canvas.toDataURL("image/png"));
  };

  useEffect(() => {
    if (!user?.refer_code) return;
    const name =
      user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name}`
        : user?.email || "State Admin";
    generateBrandedQr(user.refer_code, name, "State Admin").catch(
      console.error,
    );
  }, [user]);

  // SWR Data Fetching
  const {
    data: statsData,
    mutate: mutateStats,
    isLoading: statsLoading,
  } = useSWR(
    user?.state
      ? `/api/state-admin/dashboard/stats?state=${encodeURIComponent(user.state)}`
      : null,
    fetcher,
  );

  const {
    data: activitiesData,
    mutate: mutateActivities,
    isLoading: activitiesLoading,
  } = useSWR(
    user?.state
      ? `/api/state-admin/dashboard/activities?state=${encodeURIComponent(user.state)}`
      : null,
    fetcher,
  );

  const { data: additionalData, isLoading: additionalLoading } = useSWR(
    "/api/additional-commissions/active?role=state",
    fetcher,
  );

  // Derived states
  const stats = statsData?.success
    ? statsData.stats
    : {
        activeBranches: 0,
        branchHeads: 0,
        totalASMs: 0,
        salesExecutives: 0,
        totalOrders: 0,
        totalReturns: 0,
        totalCommission: 0,
        pending_commission: 0,
        credited_commission: 0,
        directRate: 0,
        overrideRate: 0,
      };

  const activities: Activity[] = activitiesData?.success
    ? activitiesData.activities
    : [];
  const loading = statsLoading || activitiesLoading;

  // Live updates
  const handleUpdate = useCallback(
    (data: any) => {
      if (
        data.type === "commission_update" ||
        data.type === "new_agent" ||
        data.type === "stats_update"
      ) {
        setToastData({
          message: data.message || "New activity received!",
          amount: data.amount,
        });
        setShowToast(true);
        mutateStats();
        mutateActivities();
      }
    },
    [mutateStats, mutateActivities],
  );

  const { isConnected } = useSSE({
    affiliateCode: user?.refer_code || "",
    onMessage: handleUpdate,
  });

  const refreshUserProfile = async () => {
    try {
      const token = localStorage.getItem("affiliate_token");
      if (!token) return;
      const response = await axios.get("/api/state-admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem("affiliate_user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Failed to refresh user profile:", error);
    }
  };

  const copyReferralCode = async () => {
    if (user?.refer_code) {
      await navigator.clipboard.writeText(user.refer_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl || !user?.refer_code) return;
    const link = document.createElement("a");
    link.download = `state-admin-qr-${user.refer_code}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-gray-50/50 min-h-screen p-4">
      {/* Payment Received Toast */}
      {showToast && (
        <Toast
          message={toastData.message}
          type="payment"
          amount={toastData.amount}
          onClose={() => setShowToast(false)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Overview of your state performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
          >
            {isConnected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {isConnected ? "Live Updates On" : "Connecting..."}
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100/50">
            <span className="text-xs font-semibold text-slate-500">
              {user?.state} State
            </span>
            <div className="h-4 w-[1px] bg-slate-200"></div>
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">
              {new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard overview — UI labels match client hierarchy (ASM = /branch, Branch = /asm) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Branches"
          value={stats.activeBranches ?? stats.totalBranches ?? 0}
          icon={Building2}
          color="orange"
          sublabel="In your state"
        />
        <StatCard
          label="Branch Heads"
          value={stats.branchHeads ?? 0}
          icon={Briefcase}
          color="yellow"
          sublabel="Area managers"
        />
        <StatCard
          label="ASM's"
          value={stats.totalASMs ?? 0}
          icon={Users}
          color="blue"
          sublabel="Area sales managers"
        />
        <StatCard
          label="Sales Executives"
          value={stats.salesExecutives ?? stats.totalAgents ?? 0}
          icon={UserCheck}
          color="indigo"
          sublabel="Partners in state"
        />
        <StatCard
          label="Total Orders"
          value={stats.totalOrders ?? 0}
          icon={ShoppingBag}
          color="purple"
          sublabel="All time"
        />
        <StatCard
          label="Total Returns"
          value={stats.totalReturns ?? 0}
          icon={RotateCcw}
          color="rose"
          sublabel="With return request"
        />
        <StatCard
          label="Total Commission"
          value={formatCurrency(stats.totalCommission ?? 0)}
          icon={DollarSign}
          color="green"
          isCurrency
          sublabel={`Credited: ${formatCurrency(stats.credited_commission || 0)}`}
        />
        <StatCard
          label="Pending Commission"
          value={formatCurrency(stats.pending_commission || 0)}
          icon={Clock}
          color="amber"
          isCurrency
          sublabel="Awaiting credit"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Recent Activity
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {activities.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">
                  No recent activity
                </h3>
                <p className="text-slate-500 mt-1">
                  Activities will appear here instantly.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {activities.slice(0, 5).map((activity: Activity, i: number) => (
                  <ActivityItem key={i} activity={activity} />
                ))}
              </div>
            )}
            <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
              <button className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider">
                View Full History
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Referral & Attributes */}
        <div className="space-y-6">
          {/* Referral Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Share2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Your Referral Code
                </h3>
                <p className="text-xs text-slate-500">
                  Share to earn direct commissions
                </p>
              </div>
            </div>

            <div
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-2 mb-6 group hover:border-indigo-200 transition-colors cursor-pointer"
              onClick={copyReferralCode}
            >
              <span className="font-mono font-bold text-slate-700 text-lg tracking-wider">
                {user?.refer_code || "LOADING..."}
              </span>
              <div
                className={`p-2 rounded-lg transition-all ${copied ? "text-green-600 bg-green-50" : "text-slate-400 bg-white shadow-sm group-hover:text-indigo-600"}`}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                <div className="text-lg font-bold text-emerald-600">
                  {stats.directRate}%
                </div>
                <div className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider">
                  Direct Sales
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                <div className="text-lg font-bold text-blue-600">
                  {stats.overrideRate}%
                </div>
                <div className="text-[10px] font-bold text-blue-800/60 uppercase tracking-wider">
                  Team Sales Commission
                </div>
              </div>
            </div>
          </div>

          {qrDataUrl && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900 text-sm">
                  Customer Registration
                </h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                For customer sign-ups
              </p>
              <div className="flex flex-col items-center">
                <img
                  src={qrDataUrl}
                  alt="State Admin QR Code"
                  className="w-full max-w-[220px] h-auto rounded-lg"
                />
                <button
                  onClick={downloadQR}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium w-full justify-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download QR
                </button>
              </div>
            </div>
          )}

          {/* Quick Attributes */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Quick Attributes
            </h3>

            <div className="space-y-4">
              <QuickAttrItem
                icon={Users}
                label="View Partners"
                value="Manage team"
                color="orange"
                href="/state-admin/agents"
              />
            </div>
          </div>

          {/* Active Offers */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Offers
              </h3>
              <Link
                href="/state-admin/offers"
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                View Offers
              </Link>
            </div>

            <div className="space-y-3">
              {additionalLoading ? (
                <p className="text-xs text-slate-500">Loading offers...</p>
              ) : !additionalData?.campaigns?.length ? (
                <p className="text-xs text-slate-500">
                  No active additional commission offers for State Admin.
                </p>
              ) : (
                (additionalData.campaigns as AdditionalCampaign[])
                  .slice(0, 4)
                  .map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {campaign.product_thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={campaign.product_thumbnail}
                              alt={campaign.product_name || campaign.product_id}
                              className="w-10 h-10 rounded object-cover border border-emerald-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-emerald-100 border border-emerald-200 shrink-0" />
                          )}
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {campaign.product_name || campaign.product_id}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-emerald-700 shrink-0">
                          +{Number(campaign.additional_rate || 0).toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Ends{" "}
                        {campaign.ends_at
                          ? new Date(campaign.ends_at).toLocaleString("en-IN")
                          : "Not set"}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sublabel,
  isCurrency,
}: any) {
  const styles = {
    orange: { bg: "bg-orange-50", text: "text-orange-600", iconBg: "bg-white" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", iconBg: "bg-white" },
    green: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      iconBg: "bg-white",
    },
    yellow: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-white" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-white" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", iconBg: "bg-white" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", iconBg: "bg-white" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-white" },
  };

  // @ts-ignore
  const currentStyle = styles[color] || styles.orange;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
          <h3
            className={`text-2xl font-bold text-slate-800 ${isCurrency ? "tracking-tight" : ""}`}
          >
            {value}
          </h3>
          {sublabel && (
            <p className="text-xs text-slate-400 mt-1">{sublabel}</p>
          )}
        </div>
        <div
          className={`p-3 rounded-xl ${currentStyle.bg} ${currentStyle.text} shadow-sm group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {/* Decorative blob */}
      <div
        className={`absolute -bottom-4 -right-4 w-24 h-24 ${currentStyle.bg} rounded-full opacity-50 blur-2xl group-hover:opacity-70 transition-opacity`}
      ></div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const isCommission = activity.type === "commission";
  const isApproval = activity.type === "approval";

  return (
    <div className="p-5 flex items-start gap-4 group hover:bg-slate-50/80 transition-colors">
      <div
        className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border 
                 ${
                   isCommission
                     ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                     : isApproval
                       ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                       : "bg-slate-50 border-slate-200 text-slate-500"
                 }`}
      >
        {isCommission ? (
          <DollarSign className="w-5 h-5" />
        ) : isApproval ? (
          <Check className="w-5 h-5" />
        ) : (
          <MoreHorizontal className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-sm font-bold text-slate-800 truncate pr-2">
            {activity.message.split(" earned")[0]}{" "}
            {/* Simple parse to highlight name if possible */}
            <span className="font-normal text-slate-600">
              {activity.message.includes("earned")
                ? " earned commission"
                : activity.message.includes("approved")
                  ? " was approved"
                  : ""}
            </span>
          </p>
          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
            {new Date(activity.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        {isCommission && (
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 mt-1">
            <p className="text-xs text-slate-500 line-clamp-1 italic">
              Product commission from {activity.branch_name}
            </p>
          </div>
        )}
        {!isCommission && (
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {activity.branch_name} Branch
          </p>
        )}
      </div>
    </div>
  );
}

function QuickAttrItem({ icon: Icon, label, value, color, href }: any) {
  const styles = {
    orange: { bg: "bg-orange-50", text: "text-orange-600" },
    yellow: { bg: "bg-amber-50", text: "text-amber-600" },
  };
  // @ts-ignore
  const s = styles[color] || styles.orange;

  return (
    <Link
      href={href}
      className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors -mx-2"
    >
      <div className={`p-3 rounded-xl ${s.bg} ${s.text}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
          {label}
        </h4>
        <p className="text-xs text-slate-400">{value}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 -mr-1" />
    </Link>
  );
}
