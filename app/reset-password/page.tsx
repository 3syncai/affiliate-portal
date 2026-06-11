"use client"

import { FormEvent, useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import axios from "axios"
import Link from "next/link"
import {
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
import PasswordRequirementItem from "@/components/PasswordRequirementItem"
import { getPasswordRequirements } from "@/lib/password-policy"

type ResetRole = "admin" | "state" | "asm" | "branch" | "affiliate"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""

  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [role, setRole] = useState<ResetRole | null>(null)
  const [tokenError, setTokenError] = useState("")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenError("Reset link is invalid.")
      setValidating(false)
      return
    }

    axios
      .get(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.data?.success) {
          setTokenValid(true)
          setRole(res.data.role as ResetRole)
        } else {
          setTokenError(
            res.data?.message ||
              "This reset link is invalid, expired, or has already been used.",
          )
        }
      })
      .catch((err) => {
        setTokenError(
          axios.isAxiosError(err)
            ? err.response?.data?.message || err.message
            : "Failed to validate reset link.",
        )
      })
      .finally(() => setValidating(false))
  }, [token])

  const isAdminRole = role !== "affiliate" && role !== null
  const passwordRequirements = isAdminRole
    ? getPasswordRequirements(password)
    : []
  const allRequirementsMet = isAdminRole
    ? passwordRequirements.every((rule) => rule.met)
    : password.length >= 6
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword
  const showPasswordValidation = isAdminRole && password.length > 0
  const showConfirmValidation = confirmPassword.length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!token || !tokenValid) return

    setSubmitting(true)
    try {
      const res = await axios.post("/api/auth/reset-password", {
        token,
        password,
        confirmPassword,
      })

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to reset password")
      }

      setSuccess(res.data.message)
      setTimeout(() => router.replace("/login"), 2000)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "Something went wrong. Please try again."
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Link expired or invalid
          </h1>
          <p className="text-gray-600 text-sm mb-6">{tokenError}</p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
          >
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <img
            src="/uploads/coin/Oweg3d-400.png"
            alt="OWEG"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900">Set new password</h1>
          <p className="text-gray-600 mt-2 text-sm">
            This link expires in 15 minutes and works only once.
          </p>
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
          className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 space-y-5"
        >
          {isAdminRole && (
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
          )}

          {!isAdminRole && (
            <p className="text-sm text-gray-600">
              Password must be at least 6 characters.
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
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
              submitting ||
              !allRequirementsMet ||
              !passwordsMatch ||
              !!success
            }
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <span>Update password</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
