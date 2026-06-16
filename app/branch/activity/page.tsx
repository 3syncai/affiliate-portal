"use client";

import { useState } from "react";
import ActivityHistoryPage from "@/components/dashboard/ActivityHistoryPage";

type BranchUser = {
  id?: string;
  branch?: string;
};

function readStoredUser(): BranchUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("affiliate_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BranchUser;
  } catch {
    return null;
  }
}

export default function BranchActivityPage() {
  const [user] = useState(readStoredUser);

  const apiUrl =
    user?.branch
      ? `/api/branch/activity?branch=${encodeURIComponent(user.branch)}${user.id ? `&adminId=${user.id}` : ""}&limit=50`
      : null;

  return (
    <ActivityHistoryPage
      title="Activity History"
      description="Orders, commissions, partner approvals, returns, and notifications for your branch."
      apiUrl={apiUrl}
    />
  );
}
