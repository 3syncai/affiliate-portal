"use client";

import { IndianRupee } from "lucide-react";

import ActivityHistoryPage from "@/components/dashboard/ActivityHistoryPage";

export default function AdminActivityPage() {
  return (
    <ActivityHistoryPage currencyIcon={IndianRupee}
      title="Activity History"
      description="Nationwide commissions, partner approvals, returns, and referral activity."
      apiUrl="/api/affiliate/admin/activity?limit=50"
    />
  );
}
