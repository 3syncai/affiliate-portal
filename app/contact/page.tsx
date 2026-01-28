"use client"

import { motion } from "framer-motion"
import { Mail, Phone, MapPin, ArrowLeft, Send } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <Link href="/" className="flex-shrink-0 flex items-center cursor-pointer">
                            <Image
                                src="/uploads/coin/Oweg3d-400.png"
                                alt="Oweg Logo"
                                width={120}
                                height={48}
                                className="h-12 w-auto"
                            />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="text-gray-600 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                        {/* Contact Info */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <h1 className="text-4xl font-bold text-gray-900 mb-6">Get in Touch</h1>
                            <p className="text-xl text-gray-600 mb-12 leading-relaxed">
                                Have questions about the Oweg Partner Program? We're here to help you succeed.
                                Reach out to us through any of the channels below.
                            </p>

                            <div className="space-y-8">
                                {/* Email */}
                                <div className="flex items-start gap-4 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 transition-all hover:shadow-lg hover:border-emerald-200">
                                    <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Us</h3>
                                        <p className="text-gray-600 mb-2">For general inquiries and support</p>
                                        <a href="mailto:3syncai@gmail.com" className="text-xl font-bold text-emerald-600 hover:text-emerald-700">
                                            3syncai@gmail.com
                                        </a>
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="flex items-start gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100 transition-all hover:shadow-lg hover:border-blue-200">
                                    <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                                        <Phone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Call Us</h3>
                                        <p className="text-gray-600 mb-2">Monday to Saturday, 9am to 6pm</p>
                                        <div className="flex flex-col gap-1">
                                            <a href="tel:9372163068" className="text-xl font-bold text-blue-600 hover:text-blue-700">
                                                +91 93721 63068
                                            </a>
                                            <a href="tel:8976625762" className="text-xl font-bold text-blue-600 hover:text-blue-700">
                                                +91 89766 25762
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Office (Placeholder) */}
                                <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:shadow-lg hover:border-gray-200">
                                    <div className="bg-gray-100 p-3 rounded-xl text-gray-600">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Office Location</h3>
                                        <p className="text-gray-600">
                                            Mumbai, Maharashtra, India
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Contact Form / Illustration */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="bg-white rounded-3xl border border-gray-200 shadow-xl p-8 lg:p-12 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full blur-[80px] opacity-50 -z-10"></div>

                            <h3 className="text-2xl font-bold text-gray-900 mb-8">Send us a Message</h3>

                            <form className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input type="email" className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" placeholder="john@example.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                                    <textarea rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" placeholder="How can we help you?"></textarea>
                                </div>
                                <button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                    Send Message
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </div>
            </main>

            <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <span className="text-sm">© 2025 Oweg Partners. All rights reserved.</span>
                </div>
            </footer>
        </div>
    )
}
