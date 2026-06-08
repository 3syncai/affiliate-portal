"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import ConfirmModal from "@/app/components/ConfirmModal";

type AffiliateProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  refer_code: string;
  branch: string | null;
  city: string | null;
  state: string | null;
  role: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

const emptyForm: ProfileFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

export default function DashboardProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [profileError, setProfileError] = useState("");

  // Profile form
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("affiliate_token");
    const userData = localStorage.getItem("affiliate_user");
    const role = localStorage.getItem("affiliate_role");

    if (!token || !userData) {
      router.push("/login");
      return;
    }

    if (role === "admin") {
      router.push("/admin/dashboard");
      return;
    }

    const init = async () => {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        seedForm(parsed);

        if (parsed?.refer_code) {
          try {
            const response = await axios.get(
              `/api/affiliate/profile?refer_code=${encodeURIComponent(parsed.refer_code)}`
            );
            if (response.data?.success) {
              setProfile(response.data.profile);
              seedForm(response.data.profile);
            }
          } catch (err) {
            console.error("Profile API failed, using local user fallback:", err);
            setProfileError("Live profile details unavailable. Showing saved details.");
          }
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        setProfileError("Unable to load full profile. Showing available details.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  const seedForm = (src: any) => {
    setForm({
      first_name: src?.first_name ?? "",
      last_name: src?.last_name ?? "",
      email: src?.email ?? "",
      phone: src?.phone ?? "",
    });
  };

  const data = profile || user;

  const displayName = useMemo(() => {
    const source = profile || user;
    const first = source?.first_name || "";
    const last = source?.last_name || "";
    const full = `${first} ${last}`.trim();
    return full || source?.email || "User";
  }, [profile, user]);

  const fmtDate = (value?: string | null) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const performLogout = () => {
    localStorage.removeItem("affiliate_token");
    localStorage.removeItem("affiliate_user");
    localStorage.removeItem("affiliate_role");
    router.push("/login");
  };

  const startEdit = () => {
    setSaveError("");
    setSaveSuccess("");
    seedForm(data);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError("");
    seedForm(data);
  };

  const saveProfile = async () => {
    if (!data?.refer_code) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const response = await axios.put("/api/affiliate/profile", {
        referCode: data.refer_code,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      if (response.data?.success) {
        const updated = response.data.profile;
        setProfile(updated);
        // Keep localStorage user in sync so navbar/QR pick up new name immediately
        const merged = { ...(user || {}), ...updated };
        localStorage.setItem("affiliate_user", JSON.stringify(merged));
        setUser(merged);
        seedForm(updated);
        setEditing(false);
        const changed: string[] = response.data.changedFields || [];
        setSaveSuccess(
          changed.length > 0
            ? `Profile updated. Your branch admin has been notified about the ${changed.join(", ")} change.`
            : "Profile saved."
        );
      } else {
        setSaveError(response.data?.error || "Failed to update profile");
      }
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!data?.refer_code) return;
    setPwError("");
    setPwSuccess("");
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      setPwError("All password fields are required");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New password and confirmation do not match");
      return;
    }
    setPwSaving(true);
    try {
      const response = await axios.put("/api/affiliate/profile", {
        referCode: data.refer_code,
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      if (response.data?.success) {
        setPwSuccess("Password updated successfully.");
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setPwError(response.data?.error || "Failed to update password");
      }
    } catch (err: any) {
      setPwError(err?.response?.data?.error || "Failed to update password");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">Sales Executive</h1>
              <a
                href="/dashboard"
                className="ml-4 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/products"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors"
              >
                Products
              </a>
              <a
                href="/offers"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors"
              >
                Offers
              </a>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md text-sm font-medium border border-emerald-100">
                Profile
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, <strong className="text-gray-900">{displayName}</strong>
              </span>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">My Profile</h2>
            <p className="text-sm text-gray-500 mt-1">Your account details</p>
          </div>
          {profileError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2 text-sm">
              {profileError}
            </div>
          )}
          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2 text-sm">
              {saveSuccess}
            </div>
          )}

          {/* Header card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl font-bold">
                {(displayName || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{displayName}</h3>
                <p className="text-sm text-gray-600">{data?.email || "N/A"}</p>
                <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {data?.is_active ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          </div>

          {/* Personal details card (editable) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Personal Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Changes to name, email or phone will notify your branch admin.
                </p>
              </div>
              {!editing ? (
                <button
                  onClick={startEdit}
                  className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>

            {saveError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                {saveError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="First Name"
                icon={<User className="w-4 h-4 text-gray-500" />}
                value={form.first_name}
                editing={editing}
                onChange={(v) => setForm((f) => ({ ...f, first_name: v }))}
                placeholder="First name"
              />
              <Field
                label="Last Name"
                icon={<User className="w-4 h-4 text-gray-500" />}
                value={form.last_name}
                editing={editing}
                onChange={(v) => setForm((f) => ({ ...f, last_name: v }))}
                placeholder="Last name"
              />
              <Field
                label="Email"
                icon={<Mail className="w-4 h-4 text-gray-500" />}
                value={form.email}
                editing={editing}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                type="email"
                placeholder="you@example.com"
              />
              <Field
                label="Phone"
                icon={<Phone className="w-4 h-4 text-gray-500" />}
                value={form.phone}
                editing={editing}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="Phone number"
              />
              <ReadOnlyField
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Reference Code"
                value={data?.refer_code || "N/A"}
              />
              <ReadOnlyField
                icon={<Building2 className="w-4 h-4 text-gray-500" />}
                label="Branch"
                value={data?.branch || "N/A"}
              />
              <ReadOnlyField
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="City / State"
                value={`${data?.city || "N/A"} / ${data?.state || "N/A"}`}
              />
              <ReadOnlyField
                icon={<CalendarDays className="w-4 h-4 text-gray-500" />}
                label="Joined On"
                value={fmtDate(data?.created_at)}
              />
            </div>
          </div>

          {/* Bank details card */}
          <button
            type="button"
            onClick={() => router.push("/dashboard/wallet")}
            className="w-full text-left bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Edit Bank Details</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Update your payout account, IFSC, UPI, and other payment information from the Wallet page.
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </button>

          {/* Password change card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Use at least 6 characters. Password changes are private and not shared with the branch admin.
            </p>

            {pwError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2 text-sm">
                {pwSuccess}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <PasswordInput
                label="Current Password"
                value={pwForm.currentPassword}
                onChange={(v) => setPwForm((f) => ({ ...f, currentPassword: v }))}
              />
              <PasswordInput
                label="New Password"
                value={pwForm.newPassword}
                onChange={(v) => setPwForm((f) => ({ ...f, newPassword: v }))}
              />
              <PasswordInput
                label="Confirm New Password"
                value={pwForm.confirmPassword}
                onChange={(v) => setPwForm((f) => ({ ...f, confirmPassword: v }))}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={changePassword}
                disabled={pwSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
              >
                {pwSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      </main>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Do you want to logout?"
        message="You will be returned to the login screen."
        confirmLabel="Yes, logout"
        cancelLabel="No"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          performLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  editing,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          {icon}
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-medium text-gray-900">{value || "N/A"}</p>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
        autoComplete="new-password"
      />
    </div>
  );
}
