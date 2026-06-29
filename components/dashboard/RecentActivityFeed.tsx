"use client";

import Link from "next/link";
import CommissionStatusBadge from "@/app/components/CommissionStatusBadge";
import {
  DollarSign,
  CheckCircle,
  UserPlus,
  CreditCard,
  Clock,
  XCircle,
  RotateCcw,
  Bell,
  Users,
  type LucideIcon,
} from "lucide-react";

export type RecentActivityFeedItem = {
  id: string;
  name: string;
  action: string;
  subtitle?: string;
  amount?: number | null;
  timestamp: string;
  commissionStatus?: string;
  unlockAt?: string | null;
  hasReturn?: boolean;
  hasReturnRequest?: boolean;
  variant?:
    | "commission"
    | "approval"
    | "request"
    | "withdrawal"
    | "payment"
    | "cancellation"
    | "return"
    | "rejection"
    | "notification"
    | "referral"
    | "default";
};

type RecentActivityFeedProps = {
  items: RecentActivityFeedItem[];
  loading?: boolean;
  emptyMessage?: string;
  viewAllHref?: string;
  limit?: number;
  showViewAll?: boolean;
};

const variantStyles: Record<
  NonNullable<RecentActivityFeedItem["variant"]>,
  { bg: string; icon: LucideIcon; iconClass: string }
> = {
  commission: {
    bg: "bg-blue-50",
    icon: DollarSign,
    iconClass: "text-blue-600",
  },
  approval: {
    bg: "bg-green-50",
    icon: CheckCircle,
    iconClass: "text-green-600",
  },
  request: {
    bg: "bg-orange-50",
    icon: UserPlus,
    iconClass: "text-orange-600",
  },
  withdrawal: {
    bg: "bg-purple-50",
    icon: CreditCard,
    iconClass: "text-purple-600",
  },
  payment: {
    bg: "bg-emerald-50",
    icon: CreditCard,
    iconClass: "text-emerald-600",
  },
  cancellation: {
    bg: "bg-red-50",
    icon: XCircle,
    iconClass: "text-red-600",
  },
  return: {
    bg: "bg-amber-50",
    icon: RotateCcw,
    iconClass: "text-amber-600",
  },
  rejection: {
    bg: "bg-red-50",
    icon: XCircle,
    iconClass: "text-red-600",
  },
  notification: {
    bg: "bg-sky-50",
    icon: Bell,
    iconClass: "text-sky-600",
  },
  referral: {
    bg: "bg-green-50",
    icon: Users,
    iconClass: "text-green-600",
  },
  default: {
    bg: "bg-gray-50",
    icon: Clock,
    iconClass: "text-gray-600",
  },
};

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatActivityDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function RecentActivityFeed({
  items,
  loading = false,
  emptyMessage = "No recent activity found.",
  viewAllHref,
  limit = 5,
  showViewAll = true,
}: RecentActivityFeedProps) {
  const visibleItems = items.slice(0, limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent border-gray-300 rounded-full animate-spin" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{emptyMessage}</div>
        ) : (
          visibleItems.map((activity) => {
            const style = variantStyles[activity.variant ?? "default"];
            const Icon = style.icon;
            const showAmount =
              activity.amount != null && Number(activity.amount) > 0;
            const showCommissionStatus = Boolean(activity.commissionStatus);

            return (
              <div
                key={activity.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${style.iconClass}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      <span className="font-bold">{activity.name}</span>{" "}
                      {activity.action}
                    </p>
                    {activity.subtitle ? (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {activity.subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  {showAmount ? (
                    <p className="text-sm font-bold text-green-600">
                      +{formatCurrency(Number(activity.amount))}
                    </p>
                  ) : null}
                  {showCommissionStatus ? (
                    <div className={`flex justify-end ${showAmount ? "mt-1" : ""}`}>
                      <CommissionStatusBadge
                        status={activity.commissionStatus!}
                        unlockAt={activity.unlockAt}
                        hasReturn={activity.hasReturn}
                        returnRequestPending={
                          activity.hasReturnRequest && !activity.hasReturn
                        }
                      />
                    </div>
                  ) : null}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatActivityDate(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {showViewAll && viewAllHref ? (
          <div className="p-3 text-center border-t border-gray-50">
            <Link
              href={viewAllHref}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 uppercase tracking-wide"
            >
              View Full History
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
