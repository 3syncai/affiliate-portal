"use client"
import Link from "next/link"
import Image from "next/image"
import {
  CheckCircle,
  TrendingUp,
  Wallet,
  ShieldCheck,
  Gift,
  Sparkles,
  Activity,
  Star,
  Headphones,
  Building2,
  Package,
  Trophy,
  BadgeCheck,
  Smile,
  Bell,
} from "lucide-react"
import { motion, useScroll, useTransform, useMotionValue, animate, useInView } from "framer-motion"
import { useEffect, useRef, useState } from "react"

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Floating animation for the coin
  const floatingAnimation = {
    y: [0, -20, 0],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden" ref={containerRef}>
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex-shrink-0 flex items-center cursor-pointer"
            >
              <Image
                src="/uploads/coin/Oweg3d-400.png"
                alt="Oweg Logo"
                width={120}
                height={48}
                className="h-12 w-auto"
              />
            </motion.div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="hidden sm:block text-gray-600 hover:text-emerald-600 font-medium transition-colors"
              >
                Sign In
              </Link>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/register"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-lg shadow-emerald-200"
                >
                  Become a Partner
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Animated Blobs */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-400 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{
              x: [0, -100, 0],
              y: [0, 50, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-teal-400 rounded-full blur-[120px]"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-block py-1 px-3 rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold mb-6"
              >
                Official Partner Portal
              </motion.span>
              <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 tracking-tight leading-tight">
                Turn Your Network Into <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                  Recurring Revenue
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Join the Oweg Partners program to sell premium home appliances and earn competitive commissions.
                Track sales, manage earnings, and grow your business with our professional tools.
              </p>


              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 0.8 }}
                className="mt-16 flex items-center justify-center lg:justify-start gap-8 text-gray-400 grayscale"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-500">Fast Enrolment</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-500">Weekly Payouts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-500">Zero Investment</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero Image / Coin */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative flex justify-center items-center"
            >
              <div className="relative w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
                {/* Floating Coin */}
                <motion.div animate={floatingAnimation} className="absolute inset-0 z-20 flex items-center justify-center">
                  <Image
                    src="/uploads/coin/OwegCoin.webp"
                    alt="Oweg Coin"
                    width={500}
                    height={500}
                    className="object-contain drop-shadow-2xl"
                    priority
                  />
                </motion.div>

                {/* Back glow/elements (optional) */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 z-10 border-2 border-dashed border-emerald-200 rounded-full opacity-50"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-10 z-10 border border-emerald-100 rounded-full opacity-30"
                />
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Benefits Section - Animated Bento Grid */}
      <WhyPartnerSection />

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900 z-0">
          {/* Pattern overlay if needed */}
          <motion.div
            animate={{ opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute inset-0 opacity-10 bg-[url('/uploads/coin/OwegCoin.webp')] bg-repeat opacity-5"
          ></motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto px-4 relative z-10 text-center text-white"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Start Earning?</h2>
          <p className="text-xl text-emerald-100 mb-10">
            Join thousands of successful partners who are building their business with Oweg.
            It takes less than 2 minutes to get started.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-10 py-4 bg-white text-emerald-900 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all shadow-2xl"
            >
              Create Partner Account
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Image
              src="/uploads/coin/Oweg3d-400.png"
              alt="Oweg Logo"
              width={80}
              height={32}
              className="h-8 w-auto opacity-80 grayscale hover:grayscale-0 transition-all"
            />
            <span className="text-sm">© 2025 Oweg Partners. All rights reserved.</span>
          </div>
          <div className="flex gap-8 text-sm">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ============================================================
   "Why Partner With Oweg?" — Animated Bento Grid Section
   ============================================================ */

function WhyPartnerSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])

  return (
    <section
      ref={sectionRef}
      className="relative py-32 overflow-hidden bg-gradient-to-b from-white via-emerald-50/40 to-white"
    >
      {/* Animated background mesh */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-10 w-[500px] h-[500px] bg-gradient-to-br from-emerald-300/30 to-teal-300/30 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10 left-10 w-[600px] h-[600px] bg-gradient-to-br from-teal-300/20 to-emerald-200/30 rounded-full blur-[120px]"
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] [background-size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-emerald-100/70 backdrop-blur text-emerald-700 text-sm font-semibold mb-6 border border-emerald-200/80 shadow-sm shadow-emerald-100"
          >
            <motion.span
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-4 h-4" />
            </motion.span>
            Built for Growth
          </motion.span>

          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Why Partner With{" "}
            <span className="relative inline-block">
              <motion.span
                initial={{ backgroundPosition: "0% 50%" }}
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#059669,#14b8a6,#10b981,#059669)] [background-size:200%_auto]"
              >
                Oweg?
              </motion.span>
              {/* Hand-drawn underline */}
              <motion.svg
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 w-full h-3 text-emerald-500"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
              >
                <motion.path
                  d="M2 8 Q 50 2, 100 6 T 198 5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </motion.svg>
            </span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to grow your earnings — premium products, transparent payouts, and real-time tools.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:auto-rows-[200px]">
          <HeroCommissionCard />
          <AnalyticsCard />
          <WithdrawalsCard />
          <TrustedBrandCard />
          <RewardsCard />
          <SupportCard />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   Reusable card shell with mouse-tracking spotlight + entrance fx
   ---------------------------------------------------------------- */

function FeatureShell({
  children,
  className = "",
  glowColor = "16,185,129",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  glowColor?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(-200)
  const mouseY = useMotionValue(-200)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }
  const handleMouseLeave = () => {
    mouseX.set(-200)
    mouseY.set(-200)
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 80, damping: 18 }}
      whileHover={{ y: -6 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_-15px_rgba(16,185,129,0.25)] hover:border-emerald-200 transition-[box-shadow,border-color,transform] duration-500 ${className}`}
    >
      {/* Gradient border on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, rgba(${glowColor},0.15), transparent 40%)`,
        }}
      />

      {/* Mouse-tracking spotlight */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: useTransform(
            [mouseX, mouseY] as any,
            ([x, y]: any) =>
              `radial-gradient(circle 220px at ${x}px ${y}px, rgba(${glowColor},0.18), transparent 70%)`
          ),
        }}
      />

      {/* Top-right shimmer line */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${glowColor},0.6), transparent)`,
        }}
      />

      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  )
}

/* ----------------------------------------------------------------
   Reusable animated mouse cursor (used across product-demo cards)
   ---------------------------------------------------------------- */

function AnimatedCursor({
  className = "",
  style,
  animate: animateProp,
  transition,
}: {
  className?: string
  style?: React.CSSProperties
  animate?: any
  transition?: any
}) {
  return (
    <motion.div
      className={`absolute pointer-events-none z-30 ${className}`}
      style={style}
      animate={animateProp}
      transition={transition}
    >
      <svg viewBox="0 0 16 16" className="w-4 h-4 drop-shadow-lg">
        <path
          d="M2 1.5 L2 12.5 L5 9.5 L7 14 L9.2 13 L7.2 8.5 L12 8.5 Z"
          fill="white"
          stroke="#0f172a"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  )
}

/* ----------------------------------------------------------------
   Card 1 — Hero "High Commissions" (large 2x2)
   Live sales feed mockup with rolling commission notifications.
   ---------------------------------------------------------------- */

function HeroCommissionCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, 24850, {
      duration: 2.2,
      ease: "easeOut",
      onUpdate: (v) => setCount(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView])

  const sales = [
    { product: "Samsung 253L Fridge", amount: 2500, color: "from-blue-500 to-blue-600" },
    { product: "LG Washing Machine", amount: 1800, color: "from-purple-500 to-purple-600" },
    { product: "Sony Bravia 55″ TV", amount: 3200, color: "from-rose-500 to-rose-600" },
    { product: "IFB Microwave Oven", amount: 950, color: "from-amber-500 to-amber-600" },
  ]

  return (
    <FeatureShell
      className="lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-emerald-50 via-white to-teal-50/60"
      glowColor="16,185,129"
    >
      <div ref={ref} className="flex flex-col h-full">
        {/* Top label */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-200">
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-white"
            />
            LIVE EARNINGS
          </div>
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-[2px]"
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </motion.div>
        </div>

        {/* Big counter */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Earned this month
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-600 to-teal-600 leading-none tabular-nums">
              ₹{count.toLocaleString("en-IN")}
            </span>
            <motion.span
              animate={{ y: [0, -3, 0], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="text-sm font-bold text-emerald-600 flex items-center gap-0.5"
            >
              <TrendingUp className="w-3 h-3" />
              +32%
            </motion.span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mt-3">Industry-Leading Commissions</h3>
          <p className="text-sm text-gray-600 mt-1">
            Up to <span className="font-bold text-emerald-700">30%</span> per sale, paid the moment your customer checks out.
          </p>
        </div>

        {/* Live sales ticker — rolling notifications */}
        <div className="relative flex-1 mt-2 rounded-2xl bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-100/80 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100/60 bg-white/60">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <Bell className="w-3 h-3 text-emerald-600" />
              Recent sales
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">Updating…</div>
          </div>

          <div className="relative h-[110px] overflow-hidden">
            <motion.div
              animate={{ y: [0, -44, -88, -132, 0] }}
              transition={{
                duration: 8,
                times: [0, 0.25, 0.5, 0.75, 1],
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-x-0 top-0"
            >
              {[...sales, sales[0]].map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 h-11 border-b border-emerald-50"
                >
                  <div
                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} shrink-0 flex items-center justify-center shadow-sm`}
                  >
                    <Package className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-gray-900 truncate">
                      {s.product}
                    </div>
                    <div className="text-[9px] text-gray-500">just now</div>
                  </div>
                  <div className="text-xs font-bold text-emerald-600 tabular-nums">
                    +₹{s.amount.toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Top fade */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white to-transparent" />
          </div>
        </div>
      </div>

      {/* Floating coin in corner */}
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [0, 8, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-6 -right-6 w-28 h-28 opacity-95 pointer-events-none"
      >
        <Image
          src="/uploads/coin/OwegCoin.webp"
          alt=""
          width={112}
          height={112}
          className="object-contain drop-shadow-2xl"
        />
      </motion.div>

      {/* "+₹2,500" floating notification that pops out periodically */}
      <motion.div
        animate={{
          opacity: [0, 1, 1, 0],
          y: [20, 0, 0, -20],
          scale: [0.8, 1, 1, 0.9],
        }}
        transition={{ duration: 2, times: [0, 0.2, 0.7, 1], repeat: Infinity, repeatDelay: 6 }}
        className="absolute top-20 right-4 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-lg shadow-emerald-300 pointer-events-none"
      >
        +₹2,500 earned
      </motion.div>
    </FeatureShell>
  )
}

/* ----------------------------------------------------------------
   Card 2 — Real-Time Analytics
   Mini dashboard with cursor hovering data points + tooltip popups.
   ---------------------------------------------------------------- */

function AnalyticsCard() {
  // 5 data points along the sparkline, x:0-120, y values
  const points = [
    { x: 8, y: 38, label: "Mon", value: "₹1,240" },
    { x: 35, y: 28, label: "Tue", value: "₹2,890" },
    { x: 62, y: 32, label: "Wed", value: "₹2,150" },
    { x: 88, y: 18, label: "Thu", value: "₹4,720" },
    { x: 112, y: 10, label: "Fri", value: "₹5,420" },
  ]

  // Cursor visits each point in sequence, total ~6s loop
  const stepCount = points.length
  const tipOpacity = points.flatMap(() => [1, 0.9])

  return (
    <FeatureShell glowColor="59,130,246" delay={0.1}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Live Analytics</h3>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-red-500">
            <motion.span
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-red-500"
            />
            LIVE
          </div>
        </div>

        {/* Mini dashboard chart */}
        <div className="relative flex-1 rounded-lg bg-gradient-to-b from-blue-50/60 to-white border border-blue-100 p-2 overflow-hidden">
          <div className="flex items-baseline justify-between mb-1">
            <div>
              <div className="text-[9px] text-gray-500 font-medium">This week</div>
              <div className="text-base font-bold text-gray-900 tabular-nums">₹16,420</div>
            </div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              +24%
            </div>
          </div>

          <div className="relative h-[70px]">
            <svg viewBox="0 0 120 50" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[12, 24, 36].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="120"
                  y2={y}
                  stroke="rgb(219, 234, 254)"
                  strokeWidth="0.4"
                  strokeDasharray="2 2"
                />
              ))}
              <motion.path
                d="M8,38 L35,28 L62,32 L88,18 L112,10 L120,12 L120,50 L0,50 Z"
                fill="url(#sparkFill2)"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.8 }}
              />
              <motion.path
                d="M8,38 L35,28 L62,32 L88,18 L112,10"
                stroke="rgb(37, 99, 235)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="rgb(37, 99, 235)" />
              ))}
            </svg>

            {/* Animated tooltip that follows the cursor */}
            <motion.div
              className="absolute pointer-events-none"
              animate={{
                left: points.map((p) => `${(p.x / 120) * 100}%`).flatMap((v) => [v, v]),
                top: points.map((p) => `${(p.y / 50) * 100}%`).flatMap((v) => [v, v]),
                opacity: tipOpacity,
              }}
              transition={{
                duration: 6,
                times: Array.from({ length: stepCount * 2 }, (_, i) => i / (stepCount * 2 - 1)),
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ transform: "translate(-50%, calc(-100% - 10px))" }}
            >
              <div className="bg-gray-900 text-white text-[9px] font-bold rounded-md px-1.5 py-0.5 shadow-lg whitespace-nowrap relative">
                <RotatingValue values={points.map((p) => p.value)} duration={6} />
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-gray-900" />
              </div>
            </motion.div>

            {/* The animated cursor moving between points */}
            <motion.div
              className="absolute pointer-events-none z-10"
              animate={{
                left: points.map((p) => `${(p.x / 120) * 100}%`).flatMap((v) => [v, v]),
                top: points.map((p) => `${(p.y / 50) * 100}%`).flatMap((v) => [v, v]),
              }}
              transition={{
                duration: 6,
                times: Array.from({ length: stepCount * 2 }, (_, i) => i / (stepCount * 2 - 1)),
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ transform: "translate(-2px, -2px)" }}
            >
              {/* Pulsing dot underneath */}
              <motion.div
                animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="absolute -inset-1 rounded-full bg-blue-500"
              />
              <div className="relative w-2 h-2 rounded-full bg-blue-600 border-2 border-white shadow" />
              <svg viewBox="0 0 16 16" className="absolute -top-1 left-3 w-3.5 h-3.5 drop-shadow">
                <path
                  d="M2 1.5 L2 12.5 L5 9.5 L7 14 L9.2 13 L7.2 8.5 L12 8.5 Z"
                  fill="white"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </div>
        </div>
      </div>
    </FeatureShell>
  )
}

/* Tiny helper: cycles through text values in sync with the chart cursor */
function RotatingValue({ values, duration }: { values: string[]; duration: number }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const interval = (duration * 1000) / values.length
    const t = setInterval(() => setIdx((i) => (i + 1) % values.length), interval)
    return () => clearInterval(t)
  }, [values.length, duration])
  return <span>{values[idx]}</span>
}

/* ----------------------------------------------------------------
   Card 3 — Easy Withdrawals
   Phone mockup → cursor clicks "Withdraw" → coins fly out → bank.
   Looped scene: idle → cursor enters → click → money flies → success.
   ---------------------------------------------------------------- */

function WithdrawalsCard() {
  // Total loop: 5s. Keyframe map (times in 0..1):
  // 0.00 cursor offstage
  // 0.25 cursor reaches button
  // 0.32 button click (depress)
  // 0.40 button release + start coins flying
  // 0.85 coins land at bank
  // 0.95 success state
  // 1.00 reset

  const cursorAnim = {
    left: ["110%", "55%", "55%", "55%", "110%", "110%"],
    top: ["110%", "55%", "55%", "55%", "110%", "110%"],
  }
  const cursorTimes = [0, 0.25, 0.32, 0.5, 0.7, 1]

  return (
    <FeatureShell glowColor="168,85,247" delay={0.15}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Instant Withdrawals</h3>
        </div>

        {/* Phone-style withdrawal stage */}
        <div className="relative flex-1 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-2.5 overflow-hidden border border-slate-700/50 shadow-inner">
          {/* Status bar */}
          <div className="flex items-center justify-between text-[8px] text-slate-400 mb-1.5 px-0.5">
            <span className="font-bold">Oweg Wallet</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-1 bg-slate-500 rounded-sm" />
              <div className="w-2 h-1 bg-slate-500 rounded-sm" />
              <div className="w-2 h-1 bg-emerald-400 rounded-sm" />
            </div>
          </div>

          {/* Balance card */}
          <div className="rounded-lg bg-gradient-to-br from-purple-600/30 to-purple-800/30 backdrop-blur p-2 mb-2 border border-purple-500/30">
            <div className="text-[8px] text-purple-200 font-medium uppercase tracking-wider">
              Balance
            </div>
            <motion.div
              animate={{ opacity: [1, 1, 1, 0.3, 0.3, 1, 1] }}
              transition={{
                duration: 5,
                times: [0, 0.4, 0.5, 0.6, 0.85, 0.9, 1],
                repeat: Infinity,
              }}
              className="text-white text-sm font-bold tabular-nums"
            >
              ₹12,450
            </motion.div>
          </div>

          {/* Withdraw button (gets clicked) */}
          <motion.div
            animate={{
              scale: [1, 1, 1, 0.95, 1, 1, 1],
              backgroundColor: [
                "rgb(168 85 247)",
                "rgb(168 85 247)",
                "rgb(126 34 206)",
                "rgb(126 34 206)",
                "rgb(168 85 247)",
                "rgb(34 197 94)",
                "rgb(168 85 247)",
              ],
            }}
            transition={{
              duration: 5,
              times: [0, 0.28, 0.32, 0.4, 0.5, 0.85, 1],
              repeat: Infinity,
            }}
            className="relative w-full text-white text-[10px] font-bold rounded-lg py-1.5 shadow-lg shadow-purple-500/40 overflow-hidden"
          >
            <motion.span
              animate={{ opacity: [1, 1, 1, 1, 0, 1, 1] }}
              transition={{
                duration: 5,
                times: [0, 0.5, 0.6, 0.8, 0.85, 0.9, 1],
                repeat: Infinity,
              }}
            >
              Withdraw Now
            </motion.span>
            <motion.span
              className="absolute inset-0 flex items-center justify-center gap-1"
              animate={{ opacity: [0, 0, 0, 0, 1, 1, 0] }}
              transition={{
                duration: 5,
                times: [0, 0.5, 0.6, 0.8, 0.85, 0.95, 1],
                repeat: Infinity,
              }}
            >
              <CheckCircle className="w-3 h-3" />
              Sent!
            </motion.span>

            {/* Click ripple */}
            <motion.span
              className="absolute inset-0 rounded-lg bg-white"
              animate={{ opacity: [0, 0, 0, 0.5, 0, 0, 0], scale: [1, 1, 1, 1.05, 1.2, 1, 1] }}
              transition={{
                duration: 5,
                times: [0, 0.28, 0.3, 0.32, 0.4, 0.5, 1],
                repeat: Infinity,
              }}
            />
          </motion.div>

          {/* Bank destination (bottom right) */}
          <motion.div
            className="absolute bottom-2 right-2 flex flex-col items-center gap-0.5"
            animate={{ scale: [1, 1, 1, 1, 1.2, 1, 1] }}
            transition={{
              duration: 5,
              times: [0, 0.5, 0.6, 0.8, 0.85, 0.95, 1],
              repeat: Infinity,
            }}
          >
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Building2 className="w-5 h-5 text-white" />
              {/* Success flash */}
              <motion.div
                animate={{ opacity: [0, 0, 0, 0, 1, 0, 0] }}
                transition={{
                  duration: 5,
                  times: [0, 0.7, 0.8, 0.84, 0.86, 0.95, 1],
                  repeat: Infinity,
                }}
                className="absolute inset-0 rounded-lg bg-white"
              />
            </div>
            <div className="text-[7px] text-slate-400 font-semibold">Bank</div>
          </motion.div>

          {/* "+₹12,450" floats up at bank when received */}
          <motion.div
            className="absolute right-2 pointer-events-none text-[9px] font-bold text-emerald-400 whitespace-nowrap"
            style={{ bottom: "30%" }}
            animate={{ opacity: [0, 0, 0, 0, 1, 1, 0], y: [0, 0, 0, 0, -8, -18, -22] }}
            transition={{
              duration: 5,
              times: [0, 0.7, 0.8, 0.85, 0.88, 0.95, 1],
              repeat: Infinity,
            }}
          >
            +₹12,450
          </motion.div>

          {/* Flying coins (₹) — start at button center, arc to bank */}
          {[0, 0.04, 0.08].map((d, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none w-3.5 h-3.5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center text-[8px] font-black text-amber-900 shadow-lg shadow-amber-500/50 border border-amber-300"
              animate={{
                left: ["50%", "50%", "50%", "50%", "82%", "82%"],
                top: ["62%", "62%", "62%", "62%", "82%", "82%"],
                opacity: [0, 0, 0, 1, 1, 0],
                scale: [0.5, 0.5, 0.5, 1, 0.8, 0.4],
                rotate: [0, 0, 0, 0, 360, 720],
              }}
              transition={{
                duration: 5,
                times: [0, 0.4, 0.45, 0.5, 0.85, 0.9],
                repeat: Infinity,
                delay: d,
                ease: "easeInOut",
              }}
              style={{ transform: "translate(-50%, -50%)" }}
            >
              ₹
            </motion.div>
          ))}

          {/* Animated cursor */}
          <AnimatedCursor
            animate={cursorAnim}
            transition={{
              duration: 5,
              times: cursorTimes,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ transform: "translate(-50%, -50%)" }}
          />
        </div>
      </div>
    </FeatureShell>
  )
}

/* ----------------------------------------------------------------
   Card 4 — Trusted Brand
   Delivery box arrives → "VERIFIED" stamp slams down → stars + happy customer.
   ---------------------------------------------------------------- */

function TrustedBrandCard() {
  return (
    <FeatureShell glowColor="20,184,166" delay={0.2}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Trusted Brand</h3>
        </div>

        {/* Delivery scene */}
        <div className="relative flex-1 rounded-xl bg-gradient-to-br from-teal-50 via-emerald-50 to-white border border-teal-100 overflow-hidden">
          {/* Conveyor / floor lines */}
          <div className="absolute bottom-3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent opacity-60" />

          {/* Box that "arrives" from left */}
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
            animate={{ x: ["-120%", "0%", "0%", "0%", "0%"], rotate: [0, 0, -3, 3, 0] }}
            transition={{
              duration: 4,
              times: [0, 0.3, 0.45, 0.55, 0.7],
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            <div className="relative w-14 h-12">
              {/* Box body */}
              <div className="absolute inset-x-0 bottom-0 h-9 rounded-md bg-gradient-to-b from-amber-200 to-amber-400 border border-amber-500/40 shadow-md">
                {/* Tape */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1.5 bg-amber-500/60" />
                {/* Logo strip */}
                <div className="absolute inset-x-1 top-1.5 text-[6px] font-black text-amber-900 text-center tracking-wider">
                  OWEG
                </div>
              </div>
              {/* Box top flap */}
              <div className="absolute inset-x-0 top-1 h-3 rounded-t-md bg-gradient-to-b from-amber-300 to-amber-200 border border-amber-500/40" />
            </div>
          </motion.div>

          {/* "VERIFIED" stamp slams down on box */}
          <motion.div
            className="absolute top-3 right-3 origin-center"
            animate={{
              scale: [0, 0, 0, 2.2, 1, 1, 1],
              rotate: [-30, -30, -30, -22, -12, -12, -12],
              opacity: [0, 0, 0, 1, 1, 1, 1],
            }}
            transition={{
              duration: 4,
              times: [0, 0.4, 0.5, 0.55, 0.62, 0.9, 1],
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            <div className="px-1.5 py-0.5 border-2 border-emerald-600 rounded text-emerald-700 text-[8px] font-black tracking-wider bg-white/80 backdrop-blur shadow-md flex items-center gap-0.5">
              <BadgeCheck className="w-2.5 h-2.5" />
              VERIFIED
            </div>
          </motion.div>

          {/* Stars pop in around the box */}
          <div className="absolute top-2.5 left-2.5 flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [0, 0, 0, 0, 1.4, 1, 1, 1],
                  opacity: [0, 0, 0, 0, 1, 1, 1, 1],
                  rotate: [-90, -90, -90, -90, 10, 0, 0, 0],
                }}
                transition={{
                  duration: 4,
                  times: [0, 0.55, 0.6, 0.65 + i * 0.02, 0.7 + i * 0.03, 0.75 + i * 0.03, 0.95, 1],
                  repeat: Infinity,
                }}
              >
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 drop-shadow" />
              </motion.div>
            ))}
          </div>

          {/* Happy customer with thumbs-up reaction (right side) */}
          <motion.div
            className="absolute bottom-3 right-3 flex items-end gap-1"
            animate={{ y: [10, 10, 10, 10, 0], opacity: [0, 0, 0, 0, 1] }}
            transition={{
              duration: 4,
              times: [0, 0.55, 0.65, 0.7, 0.8],
              repeat: Infinity,
            }}
          >
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center shadow-sm"
            >
              <Smile className="w-3.5 h-3.5 text-orange-900" />
            </motion.div>
            <div className="text-[9px]">👍</div>
          </motion.div>

          {/* Sparkles when stamp lands */}
          {[
            { x: "20%", y: "40%" },
            { x: "75%", y: "55%" },
            { x: "55%", y: "30%" },
          ].map((p, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{ left: p.x, top: p.y }}
              animate={{ scale: [0, 0, 1.2, 0], opacity: [0, 0, 1, 0] }}
              transition={{
                duration: 4,
                times: [0, 0.55, 0.6 + i * 0.02, 0.75],
                repeat: Infinity,
              }}
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            </motion.div>
          ))}
        </div>

        {/* Footer trust line */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {["from-emerald-400 to-emerald-600", "from-teal-400 to-teal-600", "from-blue-400 to-blue-600"].map((c, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full bg-gradient-to-br ${c} border border-white`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-700">10K+ partners</span>
          </div>
          <div className="text-[9px] text-emerald-600 font-bold">4.9 ★</div>
        </div>
      </div>
    </FeatureShell>
  )
}

/* ----------------------------------------------------------------
   Card 5 — Rewards & Bonuses
   "Achievement Unlocked" pop-up + confetti burst + trophy reveal.
   ---------------------------------------------------------------- */

function RewardsCard() {
  // Confetti pieces with random trajectories
  const confetti = Array.from({ length: 14 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 140,
    y: -40 - Math.random() * 60,
    rotate: Math.random() * 540 - 270,
    color: ["bg-rose-400", "bg-amber-400", "bg-emerald-400", "bg-purple-400", "bg-blue-400"][i % 5],
    delay: Math.random() * 0.2,
  }))

  return (
    <FeatureShell glowColor="244,63,94" delay={0.25}>
      <div className="flex flex-col h-full relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
            <Gift className="w-4 h-4 text-rose-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Rewards &amp; Bonuses</h3>
        </div>

        {/* Achievement scene */}
        <div className="relative flex-1 rounded-xl bg-gradient-to-br from-rose-50 via-amber-50/50 to-rose-50 border border-rose-100 overflow-hidden">
          {/* Radial glow that pulses on unlock */}
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.4),transparent_60%)]"
            animate={{ opacity: [0, 0, 0, 1, 0.5, 0.7, 0.3] }}
            transition={{
              duration: 4.5,
              times: [0, 0.3, 0.4, 0.5, 0.7, 0.85, 1],
              repeat: Infinity,
            }}
          />

          {/* Trophy */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{
              scale: [0, 0, 0, 1.4, 1, 1.05, 1],
              rotate: [-180, -180, -180, 10, 0, -3, 0],
            }}
            transition={{
              duration: 4.5,
              times: [0, 0.3, 0.4, 0.5, 0.6, 0.85, 1],
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-amber-300/60 blur-xl" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/40 border-2 border-amber-200">
                <Trophy className="w-7 h-7 text-white drop-shadow" />
              </div>
            </div>
          </motion.div>

          {/* "LEVEL UP" banner */}
          <motion.div
            className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[8px] font-black tracking-widest shadow-lg whitespace-nowrap"
            animate={{
              opacity: [0, 0, 0, 0, 1, 1, 1],
              y: [-15, -15, -15, -15, 0, 0, 0],
              scale: [0.8, 0.8, 0.8, 0.8, 1, 1, 1],
            }}
            transition={{
              duration: 4.5,
              times: [0, 0.3, 0.4, 0.5, 0.6, 0.95, 1],
              repeat: Infinity,
            }}
          >
            ★ LEVEL UP ★
          </motion.div>

          {/* "Gold Partner" label below trophy */}
          <motion.div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-amber-700 whitespace-nowrap"
            animate={{ opacity: [0, 0, 0, 0, 0, 1, 1], y: [5, 5, 5, 5, 5, 0, 0] }}
            transition={{
              duration: 4.5,
              times: [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1],
              repeat: Infinity,
            }}
          >
            GOLD PARTNER
          </motion.div>

          {/* Confetti burst from trophy center */}
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              className={`absolute left-1/2 top-1/2 w-1.5 h-2 ${c.color} rounded-sm`}
              animate={{
                x: [0, 0, 0, 0, c.x],
                y: [0, 0, 0, 0, c.y],
                rotate: [0, 0, 0, 0, c.rotate],
                opacity: [0, 0, 0, 0, 1, 1, 0],
                scale: [0, 0, 0, 0, 1, 1, 0.5],
              }}
              transition={{
                duration: 4.5,
                times: [0, 0.3, 0.4, 0.5, 0.55, 0.85, 1],
                repeat: Infinity,
                delay: c.delay,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Sparkles */}
          {[
            { left: "15%", top: "25%", d: 0 },
            { left: "82%", top: "30%", d: 0.3 },
            { left: "78%", top: "70%", d: 0.6 },
            { left: "18%", top: "65%", d: 0.9 },
          ].map((p, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{ left: p.left, top: p.top }}
              animate={{
                scale: [0, 0, 0, 0, 1.3, 0.8, 1.2, 0],
                opacity: [0, 0, 0, 0, 1, 0.6, 1, 0],
                rotate: [0, 0, 0, 0, 0, 90, 180, 270],
              }}
              transition={{
                duration: 4.5,
                times: [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1],
                repeat: Infinity,
                delay: p.d,
              }}
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
            </motion.div>
          ))}
        </div>

        {/* Progress to next tier */}
        <div className="mt-2">
          <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
            <span>Gold</span>
            <span className="text-rose-600">Platinum</span>
          </div>
          <div className="h-1.5 bg-rose-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: "72%" }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 1.2, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-rose-400 to-amber-400 rounded-full relative overflow-hidden"
            >
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </FeatureShell>
  )
}

/* ----------------------------------------------------------------
   Card 6 — Dedicated Support (wide bottom)
   Live chat conversation playing out: customer asks → typing → reply.
   ---------------------------------------------------------------- */

function SupportCard() {
  // Loop ~7s. Sequence:
  // 0.0  - both bubbles hidden
  // 0.1  - customer message slides in
  // 0.4  - typing dots appear (support agent)
  // 0.65 - reply slides in
  // 0.9  - settle, then loop

  return (
    <FeatureShell
      className="lg:col-span-4 bg-gradient-to-br from-orange-50/60 via-white to-amber-50/40"
      glowColor="249,115,22"
      delay={0.3}
    >
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-6 h-full">
        {/* Left: title block */}
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative shrink-0"
          >
            <div className="absolute inset-0 bg-orange-300/40 rounded-2xl blur-xl" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200">
              <Headphones className="w-5 h-5 text-white" />
            </div>
          </motion.div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">24/7 Partner Support</h3>
            <p className="text-xs text-gray-600 max-w-xs">
              A real human team — average reply in under 2 minutes.
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                3 agents online
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">⚡ &lt;2 min reply</div>
            </div>
          </div>
        </div>

        {/* Right: animated chat window */}
        <div className="relative w-full max-w-md ml-auto">
          <div className="rounded-2xl bg-white border border-orange-100 shadow-md overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  AK
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-gray-900">Aisha — Partner Success</div>
                <div className="text-[9px] text-emerald-600 font-semibold">● Online now</div>
              </div>
              <div className="text-[9px] text-gray-400">just now</div>
            </div>

            {/* Chat body */}
            <div className="p-3 space-y-2 min-h-[88px] relative bg-gradient-to-b from-white to-orange-50/30">
              {/* Customer message (right-aligned) */}
              <motion.div
                className="flex justify-end"
                animate={{
                  opacity: [0, 1, 1, 1, 1, 1, 0],
                  x: [20, 0, 0, 0, 0, 0, 20],
                }}
                transition={{
                  duration: 7,
                  times: [0, 0.1, 0.2, 0.4, 0.7, 0.9, 1],
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              >
                <div className="max-w-[75%] bg-gradient-to-br from-orange-500 to-amber-500 text-white text-[11px] rounded-2xl rounded-tr-sm px-3 py-1.5 shadow-sm">
                  Hey, how do I withdraw my earnings?
                </div>
              </motion.div>

              {/* Typing indicator from support agent */}
              <motion.div
                className="flex items-center gap-1.5"
                animate={{ opacity: [0, 0, 0, 1, 1, 0, 0] }}
                transition={{
                  duration: 7,
                  times: [0, 0.25, 0.3, 0.35, 0.55, 0.6, 1],
                  repeat: Infinity,
                }}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">
                  AK
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-2.5 py-1.5 flex items-center gap-1">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -2, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                      className="w-1 h-1 rounded-full bg-gray-500"
                    />
                  ))}
                </div>
              </motion.div>

              {/* Support reply */}
              <motion.div
                className="flex items-end gap-1.5"
                animate={{
                  opacity: [0, 0, 0, 0, 1, 1, 1, 0],
                  x: [-10, -10, -10, -10, 0, 0, 0, -10],
                }}
                transition={{
                  duration: 7,
                  times: [0, 0.4, 0.55, 0.6, 0.65, 0.85, 0.95, 1],
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">
                  AK
                </div>
                <div className="max-w-[78%] bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3 py-1.5 shadow-sm text-[11px] text-gray-800">
                  Tap <span className="font-bold text-orange-600">Withdraw</span> on your wallet — funds hit your bank instantly! 🚀
                </div>
              </motion.div>
            </div>
          </div>

          {/* Floating quick-reply chips below chat */}
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            {["Resolved", "👍 Helpful"].map((label, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1 + i * 0.15 }}
                className="px-2 py-0.5 rounded-full bg-white border border-orange-200 text-[9px] font-semibold text-orange-700 shadow-sm"
              >
                {label}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </FeatureShell>
  )
}
