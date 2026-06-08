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
  Wallet,
  ChevronRight,
  UserPlus,
  BarChart3,
  Copy,
  Check,
  Share2,
  Clock,
  ArrowUpRight,
  Wifi,
  WifiOff,
  Download,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSSE } from "@/hooks/useSSE";
import { Toast } from "@/components/Toast";
import { STORE_URL } from "@/lib/config";

type Order = {
  id: string;
  product_name: string;
  commission_amount: number;
  created_at: string;
  first_name: string;
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

export default function ASMDashboard() {
  const { theme } = useTheme();
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
      setUser(JSON.parse(userData));
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
      console.error("Branch logo overlay failed:", error);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#111827";
    ctx.font = "600 16px Arial";
    ctx.fillText(name || "Branch User", canvasWidth / 2, qrY + qrSize + 30);
    ctx.fillStyle = "#4B5563";
    ctx.font = "500 14px Arial";
    ctx.fillText(role || "Branch", canvasWidth / 2, qrY + qrSize + 52);
    setQrDataUrl(canvas.toDataURL("image/png"));
  };

  useEffect(() => {
    if (!user?.refer_code) return;
    const name =
      user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name}`
        : user?.email || "Branch User";
    generateBrandedQr(user.refer_code, name, "Branch").catch(console.error);
  }, [user]);

  const {
    data: statsData,
    mutate: mutateStats,
    isLoading: statsLoading,
  } = useSWR(
    user?.city && user?.state
      ? `/api/asm/dashboard/stats?city=${encodeURIComponent(user.city)}&state=${encodeURIComponent(user.state)}${user.id ? `&adminId=${user.id}` : ""}`
      : null,
    fetcher,
  );

  const {
    data: earningsData,
    mutate: mutateEarnings,
    isLoading: earningsLoading,
  } = useSWR(
    user?.city && user?.state
      ? `/api/asm/earnings?city=${encodeURIComponent(user.city)}&state=${encodeURIComponent(user.state)}${user.id ? `&adminId=${user.id}` : ""}`
      : null,
    fetcher,
  );

  const { data: additionalData, isLoading: additionalLoading } = useSWR(
    "/api/additional-commissions/active?role=branch",
    fetcher,
  );

  const overview = statsData?.success
    ? statsData.stats
    : {
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

  const stats = {
    directRate: overview.directRate ?? 0,
    overrideRate: overview.overrideRate ?? 0,
    recentActivity: earningsData?.success
      ? earningsData.recentOrders || []
      : ([] as Order[]),
  };

  const loading = statsLoading || earningsLoading;

  // Live updates
  const handleUpdate = useCallback(
    (data: any) => {
      if (data.type === "stats_update" || data.type === "payment_received") {
        setToastData({
          message: data.message || "New activity received!",
          amount: data.amount,
        });
        setShowToast(true);
        mutateStats();
        mutateEarnings();
      }
    },
    [mutateStats, mutateEarnings],
  );

  const { isConnected } = useSSE({
    affiliateCode: user?.refer_code || "",
    onMessage: handleUpdate,
  });

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
    link.download = `branch-qr-${user.refer_code}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Payment Received Toast */}
      {showToast && (
        <Toast
          message={toastData.message}
          type="payment"
          amount={toastData.amount}
          onClose={() => setShowToast(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Branch overview for{" "}
            <span className="font-semibold text-gray-900">
              {user?.city}, {user?.state}
            </span>
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
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 shadow-sm flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Branch Manager overview (/asm route) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            title: "ASM's",
            value: overview.totalASMs ?? 0,
            icon: Building2,
            bg: "bg-orange-50",
            color: "text-orange-600",
          },
          {
            title: "Sales Executives",
            value: overview.salesExecutives ?? 0,
            icon: UserCheck,
            bg: "bg-blue-50",
            color: "text-blue-600",
          },
          {
            title: "Total Orders",
            value: overview.totalOrders ?? 0,
            icon: ShoppingBag,
            bg: "bg-purple-50",
            color: "text-purple-600",
          },
          {
            title: "Total Returns",
            value: overview.totalReturns ?? 0,
            icon: RotateCcw,
            bg: "bg-rose-50",
            color: "text-rose-600",
          },
          {
            title: "Total Commission",
            value: formatCurrency(overview.totalCommission ?? 0),
            icon: DollarSign,
            bg: "bg-green-50",
            color: "text-green-600",
          },
          {
            title: "Pending Commission",
            value: formatCurrency(overview.pending_commission ?? 0),
            icon: Clock,
            bg: "bg-amber-50",
            color: "text-amber-600",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {card.title}
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-2">
                    {card.value}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {stats.recentActivity.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No recent activity found.
              </div>
            ) : (
              stats.recentActivity
                .slice(0, 5)
                .map((activity: Order, i: number) => (
                  <div
                    key={i}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          <span className="font-bold">
                            {activity.first_name || "Customer"}
                          </span>{" "}
                          generated commission
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {activity.product_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">
                        +{formatCurrency(activity.commission_amount || 0)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(activity.created_at).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short" },
                        )}
                      </p>
                    </div>
                  </div>
                ))
            )}
            <div className="p-3 text-center border-t border-gray-50">
              <Link
                href="/asm/earnings"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 uppercase tracking-wide"
              >
                View Full History
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Referral Code & Quick Actions */}
        <div className="space-y-6">
          {/* Referral Code Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  Your Referral Code
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Share to earn direct commissions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-center font-bold text-gray-800 tracking-wider">
                {user?.refer_code || "LOADING..."}
              </div>
              <button
                onClick={copyReferralCode}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center">
                <p className="text-xl font-bold text-emerald-600">
                  {stats.directRate}%
                </p>
                <p className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wide">
                  Direct Sales
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                <p className="text-xl font-bold text-blue-600">
                  {stats.overrideRate}%
                </p>
                <p className="text-[10px] font-bold text-blue-800/60 uppercase tracking-wide">
                  Team Sales Commission
                </p>
              </div>
            </div>
          </div>

          {qrDataUrl && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
                  alt="Branch QR Code"
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

          {/* Quick Attributes / Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-4">
              Quick Actions
            </h3>

            <div className="space-y-4">
              <Link
                href="/asm/create-branch"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Create ASM
                    </p>
                    <p className="text-xs text-gray-500">
                      Add ASM to your branch area
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
              </Link>

              <Link
                href="/asm/agents"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      View Partners
                    </p>
                    <p className="text-xs text-gray-500">Manage team members</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
              </Link>

              <Link
                href="/asm/earnings"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg text-green-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      My Earnings
                    </p>
                    <p className="text-xs text-gray-500">
                      Track your commissions
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
              </Link>
            </div>
          </div>

          {/* Active Offers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                Active Offers
              </h3>
              <Link
                href="/asm/offers"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                View Offers
              </Link>
            </div>

            <div className="space-y-3">
              {additionalLoading ? (
                <p className="text-xs text-gray-500">Loading offers...</p>
              ) : !additionalData?.campaigns?.length ? (
                <p className="text-xs text-gray-500">
                  No active additional commission offers for Branch Manager.
                </p>
              ) : (
                (additionalData.campaigns as AdditionalCampaign[])
                  .slice(0, 4)
                  .map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {campaign.product_thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={campaign.product_thumbnail}
                              alt={campaign.product_name || campaign.product_id}
                              className="w-10 h-10 rounded object-cover border border-blue-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-blue-100 border border-blue-200 shrink-0" />
                          )}
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {campaign.product_name || campaign.product_id}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-blue-700 shrink-0">
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
