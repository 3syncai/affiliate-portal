"use client"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CheckCircle, TrendingUp, Users, Wallet, ShieldCheck, Gift, BarChart3 } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

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

  // Staggered container for benefits
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
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

      {/* Benefits Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Partner With Oweg?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We provide everything you need to succeed, from top-tier products to a powerful dashboard.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <BenefitCard
              variants={itemVariants}
              icon={<TrendingUp className="w-8 h-8 text-emerald-600" />}
              title="High Commissions"
              description="Earn industry-leading commission rates on every product sold through your unique referral link."
            />
            <BenefitCard
              variants={itemVariants}
              icon={<BarChart3 className="w-8 h-8 text-blue-600" />}
              title="Real-Time Analytics"
              description="Track clicks, conversions, and earnings in real-time with our advanced partner dashboard."
            />
            <BenefitCard
              variants={itemVariants}
              icon={<Wallet className="w-8 h-8 text-purple-600" />}
              title="Easy Withdrawals"
              description="Withdraw your earnings seamlessly to your bank account with our transparent payout system."
            />
            <BenefitCard
              variants={itemVariants}
              icon={<ShieldCheck className="w-8 h-8 text-teal-600" />}
              title="Trusted Brand"
              description="Promote high-quality, warrantied home appliances that customers love and trust."
            />
            <BenefitCard
              variants={itemVariants}
              icon={<Users className="w-8 h-8 text-orange-600" />}
              title="Dedicated Support"
              description="Get help whenever you need it from our dedicated partner success team."
            />
            <BenefitCard
              variants={itemVariants}
              icon={<Gift className="w-8 h-8 text-rose-600" />}
              title="Rewards & Bonuses"
              description="Unlock performance bonuses and exclusive rewards as you hit sales milestones."
            />
          </motion.div>
        </div>
      </section>

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

function BenefitCard({ icon, title, description, variants }: { icon: React.ReactNode, title: string, description: string, variants?: any }) {
  return (
    <motion.div
      variants={variants}
      whileHover={{ y: -5 }}
      className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
    >
      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">
        {description}
      </p>
    </motion.div>
  )
}
