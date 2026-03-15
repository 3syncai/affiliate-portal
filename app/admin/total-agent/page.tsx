"use client"

import { useEffect, useState } from "react"
import { Eye, Users, Building2, MapPin, GitBranch, Search, Filter, X, User, Mail, Phone, Calendar, Briefcase } from "lucide-react"
import axios from "axios"

type UserData = {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  email: string
  phone?: string | null
  branch?: string
  area?: string
  state?: string
  designation?: string
  is_agent?: boolean
  is_approved?: boolean
  created_at?: string
  approved_at?: string
  [key: string]: any
}

type TabType = "affiliates" | "state_admins" | "area_managers" | "branch_admins"

const tabs: { id: TabType; label: string; icon: any; color: string }[] = [
  { id: "affiliates", label: "Partner Agents", icon: Users, color: "from-blue-500 to-blue-600" },
  { id: "state_admins", label: "State Admins", icon: Building2, color: "from-purple-500 to-purple-600" },
  { id: "area_managers", label: "Branch Managers", icon: MapPin, color: "from-emerald-500 to-emerald-600" },
  { id: "branch_admins", label: "Area Sales Managers", icon: GitBranch, color: "from-orange-500 to-orange-600" },
]

export default function AllUsersPage() {
  const [activeTab, setActiveTab] = useState<TabType>("affiliates")
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [stats, setStats] = useState({
    affiliates: 0,
    state_admins: 0,
    area_managers: 0,
    branch_admins: 0
  })

  useEffect(() => {
    loadAllStats()
  }, [])

  useEffect(() => {
    loadUsers(activeTab)
  }, [activeTab])

  const loadAllStats = async () => {
    try {
      // Load all counts
      const [affiliatesRes, stateRes, areaRes, branchRes] = await Promise.all([
        axios.get("/api/admin/users").catch(() => ({ data: { approved: [] } })),
        axios.get("/api/admin/state-admins").catch(() => ({ data: { admins: [] } })),
        axios.get("/api/admin/area-managers").catch(() => ({ data: { managers: [] } })),
        axios.get("/api/admin/branch-admins").catch(() => ({ data: { admins: [] } }))
      ])

      setStats({
        affiliates: (affiliatesRes.data.approved || []).filter((u: any) => u.is_agent).length,
        state_admins: (stateRes.data.stateAdmins || stateRes.data.admins || []).length,
        area_managers: (areaRes.data.managers || []).length,
        branch_admins: (branchRes.data.admins || []).length
      })
    } catch (error) {
      console.error("Failed to load stats:", error)
    }
  }

  const loadUsers = async (tab: TabType) => {
    setLoading(true)
    setUsers([])
    try {
      let response
      switch (tab) {
        case "affiliates":
          response = await axios.get("/api/affiliate/admin/users")
          setUsers((response.data.approved || []).filter((u: any) => u.is_agent))
          break
        case "state_admins":
          response = await axios.get("/api/admin/state-admins")
          setUsers(response.data.stateAdmins || response.data.admins || [])
          break
        case "area_managers":
          response = await axios.get("/api/admin/area-managers")
          setUsers(response.data.managers || [])
          break
        case "branch_admins":
          response = await axios.get("/api/admin/branch-admins")
          setUsers(response.data.admins || [])
          break
      }
    } catch (error) {
      console.error(`Failed to fetch ${tab}:`, error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-"
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return dateString
    }
  }

  const getName = (user: UserData) => {
    if (user.name) return user.name
    return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown"
  }

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const name = getName(user).toLowerCase()
    const email = (user.email || "").toLowerCase()
    const phone = (user.phone || "").toLowerCase()
    return name.includes(query) || email.includes(query) || phone.includes(query)
  })

  const currentTab = tabs.find(t => t.id === activeTab)!

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Users</h1>
          <p className="text-gray-600 mt-1">Manage all agents and administrators</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map(tab => {
          const Icon = tab.icon
          const count = stats[tab.id]
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-4 rounded-xl transition-all duration-200 text-left ${isActive
                ? `bg-gradient-to-r ${tab.color} text-white shadow-lg scale-[1.02]`
                : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md"
                }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isActive ? "bg-white/20" : "bg-gray-100"
                  }`}>
                  <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-gray-600"}`} />
                </div>
                <div className={`text-3xl font-bold ${isActive ? "text-white" : "text-gray-900"}`}>
                  {count}
                </div>
              </div>
              <div className={`mt-3 text-sm font-medium ${isActive ? "text-white/90" : "text-gray-600"}`}>
                {tab.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Search & Filter Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${currentTab.label.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-900">{filteredUsers.length}</span> {currentTab.label.toLowerCase()}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading {currentTab.label.toLowerCase()}...</span>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${currentTab.color} flex items-center justify-center`}>
              <currentTab.icon className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-500 text-lg">No {currentTab.label.toLowerCase()} found</p>
            {searchQuery && (
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contact
                  </th>
                  {activeTab !== "affiliates" && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {activeTab === "state_admins" ? "State" : activeTab === "area_managers" ? "Branch" : "Area Sales Manager"}
                    </th>
                  )}
                  {activeTab === "affiliates" && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Branch
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${currentTab.color} flex items-center justify-center text-white font-semibold text-sm`}>
                          {getName(user).charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {getName(user)}
                          </div>
                          {user.designation && (
                            <div className="text-xs text-gray-500">{user.designation}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                      <div className="text-sm text-gray-500">{user.phone || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {user.state || user.area || user.branch || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at || user.approved_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className={`bg-gradient-to-r ${currentTab.color} p-6`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
                    {getName(selectedUser).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{getName(selectedUser)}</h2>
                    <p className="text-white/80">{selectedUser.designation || currentTab.label.slice(0, -1)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm font-medium text-gray-900">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm font-medium text-gray-900">{selectedUser.phone || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Location & Role</h3>
                  <div className="space-y-3">
                    {selectedUser.state && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">State</p>
                          <p className="text-sm font-medium text-gray-900">{selectedUser.state}</p>
                        </div>
                      </div>
                    )}
                    {selectedUser.area && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Branch</p>
                          <p className="text-sm font-medium text-gray-900">{selectedUser.area}</p>
                        </div>
                      </div>
                    )}
                    {selectedUser.branch && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                          <GitBranch className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Area Sales Manager</p>
                          <p className="text-sm font-medium text-gray-900">{selectedUser.branch}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Joined</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(selectedUser.created_at || selectedUser.approved_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {(selectedUser.referral_code || selectedUser.refer_code) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">Referral Code</p>
                      <p className="text-lg font-mono font-bold text-gray-900">{selectedUser.referral_code || selectedUser.refer_code}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedUser.referral_code || selectedUser.refer_code || "")}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
