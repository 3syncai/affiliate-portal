"use client";

import { IndianRupee } from "lucide-react";

import { useState } from "react";
import ActivityHistoryPage from "@/components/dashboard/ActivityHistoryPage";

type StateUser = {
  id?: string;
  state?: string;
};

function readStoredUser(): StateUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("affiliate_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StateUser;
  } catch {
    return null;
  }
}

export default function StateAdminActivityPage() {
  const [user] = useState(readStoredUser);

  const apiUrl =
    user?.state
      ? `/api/state-admin/dashboard/activities?state=${encodeURIComponent(user.state)}${user.id ? `&adminId=${user.id}` : ""}&limit=50`
      : null;

  return (
    <ActivityHistoryPage currencyIcon={IndianRupee}
      title="Activity History"
      description="State-wide commissions, referrals, returns, branch manager activity, and notifications."
      apiUrl={apiUrl}
    />
  );
}
