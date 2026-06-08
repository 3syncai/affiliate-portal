"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Users, Eye, Search, MapPin } from "lucide-react";

type AsmUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  branch: string;
  city: string;
  state: string;
  is_active: boolean;
  created_at: string;
};

export default function StateAdminAsmsPage() {
  const [asms, setAsms] = useState<AsmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAsm, setSelectedAsm] = useState<AsmUser | null>(null);
  const [user, setUser] = useState<{ state?: string } | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("affiliate_user");
    if (!userData) return;
    const parsed = JSON.parse(userData);
    setUser(parsed);
    if (parsed.state) {
      fetchAsms(parsed.state);
    }
  }, []);

  const fetchAsms = async (state: string) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/state-admin/branch-admins?state=${encodeURIComponent(state)}`,
      );
      if (response.data.success) {
        setAsms(response.data.asms || []);
      }
    } catch (error) {
      console.error("Failed to fetch ASMs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAsms = asms.filter(
    (asm) =>
      asm.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asm.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asm.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asm.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asm.city.toLowerCase().includes(searchTerm.toLowerCase()),
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
        <div className="text-lg text-gray-500">Loading ASM&apos;s...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">ASM&apos;s</h1>
        <p className="text-gray-600 mt-1">
          View ASMs in {user?.state} (client hierarchy)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, branch, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total ASM&apos;s</p>
          <p className="text-2xl font-bold text-gray-900">{asms.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {asms.filter((a) => a.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-red-600">
            {asms.filter((a) => !a.is_active).length}
          </p>
        </div>
      </div>

      {filteredAsms.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No ASM&apos;s found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAsms.map((asm) => (
                  <tr key={asm.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {asm.first_name} {asm.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {asm.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {asm.branch}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        <MapPin className="w-3 h-3" />
                        {asm.city}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          asm.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {asm.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAsm(asm)}
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
      )}

      {selectedAsm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              ASM Details
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Name:</strong> {selectedAsm.first_name}{" "}
                {selectedAsm.last_name}
              </p>
              <p>
                <strong>Email:</strong> {selectedAsm.email}
              </p>
              <p>
                <strong>Phone:</strong> {selectedAsm.phone || "-"}
              </p>
              <p>
                <strong>Branch:</strong> {selectedAsm.branch}
              </p>
              <p>
                <strong>City:</strong> {selectedAsm.city}
              </p>
              <p>
                <strong>State:</strong> {selectedAsm.state}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {selectedAsm.is_active ? "Active" : "Inactive"}
              </p>
              <p>
                <strong>Created:</strong> {formatDate(selectedAsm.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAsm(null)}
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
