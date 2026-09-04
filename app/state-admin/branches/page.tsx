"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Building2, Eye, Search, MapPin } from "lucide-react";

type StoreBranch = {
  id: string;
  branch_name: string;
  city: string;
  state: string;
  is_active: boolean;
  contact_phone: string | null;
  created_at: string;
};

export default function StateAdminBranchesPage() {
  const [branches, setBranches] = useState<StoreBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<StoreBranch | null>(
    null,
  );
  const [user, setUser] = useState<{ state?: string } | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("affiliate_user");
    if (!userData) return;
    const parsed = JSON.parse(userData);
    setUser(parsed);
    if (parsed.state) {
      fetchBranches(parsed.state);
    }
  }, []);

  const fetchBranches = async (state: string) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/state-admin/stores?state=${encodeURIComponent(state)}`,
      );
      if (response.data.success) {
        setBranches(response.data.stores || []);
      }
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.city.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading active branches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
            Active Branches
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">
            Store branches operating in {user?.state}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by branch or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500">Total Active</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {branches.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500">Cities</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {new Set(branches.map((b) => b.city)).size}
          </p>
        </div>
      </div>

      {filteredBranches.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No active branches found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredBranches.map((branch) => (
              <div
                key={branch.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {branch.branch_name}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{branch.city}</span>
                    </span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                  <div className="min-w-0">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                      State
                    </p>
                    <p className="truncate">{branch.state}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                      Phone
                    </p>
                    <p className="truncate">{branch.contact_phone || "-"}</p>
                  </div>
                  <div className="min-w-0 col-span-2">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">
                      Created
                    </p>
                    <p>{formatDate(branch.created_at)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBranch(branch)}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-900 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Branch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      City
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBranches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {branch.branch_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          <MapPin className="w-3 h-3" />
                          {branch.city}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(branch.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedBranch(branch)}
                          className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedBranch && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setSelectedBranch(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-lg max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Branch Details
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Branch:</strong> {selectedBranch.branch_name}
              </p>
              <p>
                <strong>City:</strong> {selectedBranch.city}
              </p>
              <p>
                <strong>State:</strong> {selectedBranch.state}
              </p>
              <p>
                <strong>Phone:</strong> {selectedBranch.contact_phone || "-"}
              </p>
              <p>
                <strong>Status:</strong> Active
              </p>
              <p>
                <strong>Created:</strong>{" "}
                {formatDate(selectedBranch.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBranch(null)}
              className="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
