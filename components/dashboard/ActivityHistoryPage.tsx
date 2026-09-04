"use client";

import useSWR from "swr";
import axios from "axios";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import { mapActivityEventToFeedItem, type ActivityEvent } from "@/lib/recent-activity";

const fetcher = (url: string) => axios.get(url).then((res) => res.data);

type ActivityHistoryPageProps = {
  title?: string;
  description?: string;
  apiUrl: string | null;
  limit?: number;
};

export default function ActivityHistoryPage({
  title = "Activity History",
  description = "Full timeline of recent events in your territory.",
  apiUrl,
  limit = 50,
}: ActivityHistoryPageProps) {
  const { data, isLoading } = useSWR(apiUrl, fetcher);

  const activities: ActivityEvent[] = data?.success ? data.activities : [];
  const items = activities.map(mapActivityEventToFeedItem);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1 break-words">{description}</p>
      </div>

      <RecentActivityFeed
        items={items}
        loading={isLoading}
        limit={limit}
        showViewAll={false}
        emptyMessage="No activity recorded yet."
      />
    </div>
  );
}
