"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Smartphone,
  ChartNoAxesCombined,
  Network,
  Monitor,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import styles from "./login.module.css";

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccess(
        "Registration successful! Please login with your credentials.",
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const completeLogin = (data: {
    token: string;
    user: Record<string, unknown>;
    role: string;
    redirectTo?: string | null;
    is_approved?: boolean;
    initial_password_reset_completed?: boolean;
  }) => {
    localStorage.setItem("affiliate_token", data.token);
    localStorage.setItem("affiliate_user", JSON.stringify(data.user));
    localStorage.setItem("affiliate_role", data.role);

    if (data.role === "admin") {
      window.location.href = "/admin/dashboard";
      return;
    }
    if (data.role === "state") {
      window.location.href =
        data.redirectTo ||
        (data.initial_password_reset_completed === false
          ? "/reset-initial-password"
          : "/state-admin/dashboard");
      return;
    }
    if (data.role === "asm") {
      window.location.href =
        data.redirectTo ||
        (data.initial_password_reset_completed === false
          ? "/reset-initial-password"
          : "/asm/dashboard");
      return;
    }
    if (data.role === "branch") {
      window.location.href =
        data.redirectTo ||
        (data.initial_password_reset_completed === false
          ? "/reset-initial-password"
          : "/branch/dashboard");
      return;
    }
    if (data.redirectTo) {
      window.location.href = data.redirectTo;
      return;
    }
    if (!data.is_approved) {
      window.location.href = "/verification-pending";
      return;
    }
    window.location.href = "/dashboard";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post("/api/auth/login", { email, password });
      const data = response.data;

      if (data.requiresOtp) {
        setOtpStep(true);
        setChallengeId(data.challengeId);
        setMaskedPhone(data.maskedPhone || "");
        setOtp("");
        setResendCooldown(data.resendCooldownSeconds || 30);
        setSuccess(data.message || "OTP sent to your mobile number.");
        return;
      }

      if (data.success && data.token) {
        completeLogin(data);
        return;
      }

      setError(data.message || "Login failed. Please try again.");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "An error occurred. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post("/api/auth/verify-otp", {
        challengeId,
        otp,
      });
      const data = response.data;

      if (data.success && data.token) {
        completeLogin(data);
        return;
      }

      setError(data.message || "Invalid OTP. Please try again.");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "OTP verification failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post("/api/auth/resend-otp", {
        challengeId,
      });
      const data = response.data;
      setSuccess(data.message || "OTP resent successfully.");
      setResendCooldown(data.resendCooldownSeconds || 30);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "Failed to resend OTP.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setChallengeId("");
    setMaskedPhone("");
    setOtp("");
    setResendCooldown(0);
    setError("");
    setSuccess("");
  };

  return (
    <main className={styles.page}>
      <svg className={styles.backdrop} viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="login-mint" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#dcefd8" stopOpacity=".65" />
            <stop offset="1" stopColor="#eff8f1" stopOpacity=".35" />
          </linearGradient>
          <linearGradient id="login-gold" x1="0" x2="1">
            <stop stopColor="#edb64d" />
            <stop offset="1" stopColor="#b3d770" />
          </linearGradient>
        </defs>
        <path d="M420 900C290 600 550 410 840 335S1085 80 1320 0H1440C1140 145 1220 325 880 420S460 650 575 900Z" fill="url(#login-mint)" />
        <path d="M0 772C220 945 382 785 620 840S1140 1040 1440 685V775C1150 1100 850 940 612 881S230 1010 0 832Z" fill="url(#login-mint)" />
        <path d="M0 770C240 952 375 794 620 844C350 813 237 958 0 783Z" fill="url(#login-gold)" />
      </svg>
      <div className={styles.layout}>
        <section className={styles.brand} aria-labelledby="partner-heading">
          <Link href="/" className={styles.brandLink} aria-label="OWEG Partners home">
            <span className={styles.wordmark}>
              <span className={styles.brandName}>
                <span className={styles.brandInitial}>
                  <Image src="/uploads/coin/Oweg3d-400.png" alt="O" width={86} height={86} className={styles.brandMark} priority />
                </span>
                WEG<span className={styles.registered}>®</span>
              </span>
              <span className={styles.partnerName}>PARTNERS<TrendingUp aria-hidden="true" /></span>
              <span className={styles.tagline}>YOUR LIFETIME EARNING PARTNER.</span>
            </span>
          </Link>
          <div className={styles.brandCopy}>
            <h1 id="partner-heading">Grow With OWEG Partners.</h1>
            <p>Your business, your network, your earnings.</p>
          </div>
          <div className={styles.growth}>
            <ul className={styles.features}>
              <li>
                <span className={styles.featureIcon}><ChartNoAxesCombined aria-hidden="true" /></span>
                <span><strong>Track commissions</strong><span>and earnings in real time</span></span>
              </li>
              <li>
                <span className={styles.featureIcon}><Network aria-hidden="true" /></span>
                <span><strong>Monitor partners</strong><span>and sales</span></span>
              </li>
              <li>
                <span className={styles.featureIcon}><Monitor aria-hidden="true" /></span>
                <span><strong>Access your</strong><span>partner dashboard</span></span>
              </li>
            </ul>
            <Image src="/images/partner-growth.png" alt="" width={640} height={427} className={styles.illustration} priority />
          </div>
        </section>
        <section className={styles.formSection} aria-labelledby="login-heading">
          <div className={styles.card}>
            <header className={styles.formHeader}>
              <h2 id="login-heading">{otpStep ? "Verify your number" : "Welcome back!"}</h2>
              <p>{otpStep ? "One more step to access your OWEG partnership." : "Sign in to manage your OWEG partnership."}</p>
            </header>
          {/* Success Alert */}
          {success && (
            <div role="status"
              className="mb-6 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div role="alert"
              className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!otpStep ? (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
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
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="block w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Forgot password?
                </a>
              </div>

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
          ) : (
            <form onSubmit={handleVerifyOtp} className={styles.form}>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Enter the 6-digit OTP sent to{" "}
                <span className="font-semibold">
                  {maskedPhone || "your mobile"}
                </span>
                .
              </div>

              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  One-Time Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Smartphone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all tracking-[0.2em] sm:tracking-[0.35em] text-center text-base sm:text-lg font-semibold"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify OTP</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="font-medium text-gray-600 hover:text-gray-900 text-center sm:text-left py-2 sm:py-0"
                >
                  Back to login
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                  className="font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-gray-400 text-center sm:text-right py-2 sm:py-0"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <div className={styles.signup}>
            <p>Don&apos;t have an account? <Link href="/register">Sign up for free</Link></p>
          </div>
          </div>
          <footer className={styles.footer}>
            <ShieldCheck aria-hidden="true" />
            <span>Secure Partner Access <span className={styles.footerDot}>·</span> © {new Date().getFullYear()} OWEG. All rights reserved.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
