"use client"

import { useEffect, useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  LogOut,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
import PasswordRequirementItem from "@/components/PasswordRequirementItem"
import { getPasswordRequirements } from "@/lib/password-policy"

type SubAdminRole = "state" | "asm" | "branch"

const ROLE_CONFIG: Record<
  SubAdminRole,
  { label: string; dashboard: string }
> = {
  state: { label: "State Admin", dashboard: "/state-admin/dashboard" },
  asm: { label: "Branch Head", dashboard: "/asm/dashboard" },
  branch: { label: "Area Sales Manager", dashboard: "/branch/dashboard" },
}

const isSubAdminRole = (value: unknown): value is SubAdminRole =>
  value === "state" || value === "asm" || value === "branch"

export default function ResetInitialPasswordPage() {
  const router = useRouter()
  const [role, setRole] = useState<SubAdminRole | null>(null)
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("affiliate_token")
    const userData = localStorage.getItem("affiliate_user")
    const storedRole = localStorage.getItem("affiliate_role")

    if (!token || !userData || !isSubAdminRole(storedRole)) {
      router.replace("/login")
      return
    }

    try {
      const parsed = JSON.parse(userData)
      if (parsed?.profile_completed !== true) {
        router.replace("/complete-profile")
        return
      }
      if (parsed?.initial_password_reset_completed === true) {
        router.replace(ROLE_CONFIG[storedRole].dashboard)
        return
      }
      setRole(storedRole)
      setUser(parsed)
    } catch {
      router.replace("/login")
      return
    } finally {
      setLoadingAuth(false)
    }
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!role) return

    const token = localStorage.getItem("affiliate_token")
    if (!token) {
      setError("Session expired. Please log in again.")
      return
    }

    setSubmitting(true)
    try {
      const res = await axios.post(
        "/api/auth/reset-initial-password",
        { password, confirmPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to reset password")
      }

      const updatedUser = {
        ...user,
        initial_password_reset_completed: true,
      }
      localStorage.setItem("affiliate_user", JSON.stringify(updatedUser))

      setSuccess("Password updated. Redirecting to your dashboard...")
      const redirect =
        res.data.redirectTo || ROLE_CONFIG[role].dashboard
      setTimeout(() => {
        window.location.href = redirect
      }, 900)
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "Something went wrong. Please try again."
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("affiliate_token")
    localStorage.removeItem("affiliate_user")
    localStorage.removeItem("affiliate_role")
    router.replace("/login")
  }

  if (loadingAuth || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "there"

  const passwordRequirements = getPasswordRequirements(password)
  const allRequirementsMet = passwordRequirements.every((rule) => rule.met)
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword
  const showPasswordValidation = password.length > 0
  const showConfirmValidation = confirmPassword.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              One-time setup
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Set your password
            </h1>
            <p className="text-slate-600 mt-2">
              Hi <span className="font-semibold text-slate-900">{displayName}</span>.
              Create a secure password for your{" "}
              <span className="font-semibold">{ROLE_CONFIG[role].label}</span> account.
              You will use this password for all future logins.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden sm:inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 rounded-lg hover:bg-white/60"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 space-y-5"
        >
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="font-semibold text-slate-800 mb-2 text-sm">
              Password must include:
            </p>
            <ul className="space-y-2">
              {passwordRequirements.map((rule) => (
                <PasswordRequirementItem
                  key={rule.id}
                  met={rule.met}
                  label={rule.label}
                  showValidation={showPasswordValidation}
                />
              ))}
              <PasswordRequirementItem
                met={passwordsMatch}
                label="Passwords match"
                showValidation={showConfirmValidation}
              />
            </ul>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                maxLength={15}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                maxLength={15}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-11 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting || !allRequirementsMet || !passwordsMatch
            }
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Save password and continue</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
