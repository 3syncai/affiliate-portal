"use client"

import { useState, FormEvent, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import axios from "axios"
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle } from "lucide-react"
import { BACKEND_URL } from "@/lib/config"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccess("Registration successful! Please login with your credentials.")
    }
  }, [searchParams])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // First try internal affiliate/admin login API (bypasses CORS issues)
      const affiliateResponse = await axios.post("/api/affiliate/login", { email, password })
      const affiliateData = affiliateResponse.data

      if (affiliateData.success) {
        // Store token in localStorage
        localStorage.setItem("affiliate_token", affiliateData.token)
        localStorage.setItem("affiliate_user", JSON.stringify(affiliateData.user))
        localStorage.setItem("affiliate_role", affiliateData.role)

        // Redirect based on role and approval status
        if (affiliateData.role === "admin") {
          window.location.href = "/admin/dashboard"
        } else if (affiliateData.role === "state") {
          window.location.href = "/state-admin/dashboard"
        } else if (affiliateData.redirectTo) {
          window.location.href = affiliateData.redirectTo
        } else if (!affiliateData.is_approved) {
          window.location.href = "/verification-pending"
        } else {
          window.location.href = "/dashboard"
        }
        return
      }
    } catch (err: any) {
      // If affiliate login fails, try state admin login
      try {
        const stateResponse = await axios.post("/api/state-admin/login", { email, password })
        const stateData = stateResponse.data

        if (stateData.success) {
          localStorage.setItem("affiliate_token", stateData.token)
          localStorage.setItem("affiliate_user", JSON.stringify(stateData.user))
          localStorage.setItem("affiliate_role", "state")
          window.location.href = "/state-admin/dashboard"
          return
        }
      } catch {
        // State admin login also failed, try ASM login
        try {
          const asmResponse = await axios.post("/api/asm/login", { email, password })
          const asmData = asmResponse.data

          if (asmData.success) {
            localStorage.setItem("affiliate_token", asmData.token)
            localStorage.setItem("affiliate_user", JSON.stringify(asmData.user))
            localStorage.setItem("affiliate_role", "asm")
            window.location.href = "/asm/dashboard"
            return
          }
        } catch {
          // ASM login also failed, try Branch Admin login
          try {
            const branchResponse = await axios.post("/api/branch/login", { email, password })
            const branchData = branchResponse.data

            if (branchData.success) {
              localStorage.setItem("affiliate_token", branchData.token)
              localStorage.setItem("affiliate_user", JSON.stringify(branchData.user))
              localStorage.setItem("affiliate_role", "branch")
              window.location.href = "/branch/dashboard"
              return
            }
          } catch {
            // Branch login also failed
          }
        }
      }
      setError(err.response?.data?.message || err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }




  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Coin Decoration */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20">
          <img
            src="/uploads/coin/coin.png"
            alt="Coin"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-12">
            <img
              src="/uploads/coin/Oweg3d-400.png"
              alt="Oweg Logo"
              className="h-20 mb-8"
            />
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Welcome to<br />Oweg Partners
            </h1>
            <p className="text-xl text-emerald-100 leading-relaxed max-w-md">
              Join our partner program and start earning commissions by promoting our products.
            </p>
          </div>

          <div className="space-y-4 text-emerald-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
              <span className="text-lg">Track your earnings in real-time</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
              <span className="text-lg">Easy withdrawal process</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
              <span className="text-lg">24/7 support and analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <img
              src="/uploads/coin/Oweg3d-400.png"
              alt="Oweg Logo"
              className="h-16 mx-auto mb-4"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Sign in to your account
            </h2>
            <p className="text-gray-600">
              Enter your credentials to access your affiliate dashboard
            </p>
          </div>

          {/* Success Alert */}
          {success && (
            <div className="mb-6 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <a
                href="/register"
                className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Sign up for free
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>© 2025 Oweg. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
