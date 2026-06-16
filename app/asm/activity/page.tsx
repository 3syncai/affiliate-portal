"use client";

import { useState } from "react";
import ActivityHistoryPage from "@/components/dashboard/ActivityHistoryPage";

type BmUser = {
  id?: string;
  city?: string;
  state?: string;
};

function readStoredUser(): BmUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("affiliate_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BmUser;
  } catch {
    return null;
  }
}

export default function AsmActivityPage() {
  const [user] = useState(readStoredUser);

  const apiUrl =
    user?.city && user?.state
      ? `/api/asm/activity?city=${encodeURIComponent(user.city)}&state=${encodeURIComponent(user.state)}${user.id ? `&adminId=${user.id}` : ""}&limit=50`
      : null;

  return (
    <ActivityHistoryPage
      title="Activity History"
      description="Sales executive and ASM commissions, partner requests, returns, and notifications in your area."
      apiUrl={apiUrl}
    />
  );
}
