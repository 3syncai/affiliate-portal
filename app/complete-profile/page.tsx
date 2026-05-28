"use client"

import { useState, useEffect, FormEvent, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    Landmark,
    FileText,
    Upload,
    LogOut,
    Loader2,
} from "lucide-react"

type SubAdminRole = "state" | "asm" | "branch"

type RoleConfig = {
    label: string
    apiPath: string
    dashboard: string
}

const ROLE_CONFIG: Record<SubAdminRole, RoleConfig> = {
    state: {
        label: "State Admin",
        apiPath: "/api/state-admin/complete-profile",
        dashboard: "/state-admin/dashboard",
    },
    asm: {
        label: "Branch Head",
        apiPath: "/api/asm/complete-profile",
        dashboard: "/asm/dashboard",
    },
    branch: {
        label: "Area Sales Manager",
        apiPath: "/api/branch/complete-profile",
        dashboard: "/branch/dashboard",
    },
}

const isSubAdminRole = (value: unknown): value is SubAdminRole =>
    value === "state" || value === "asm" || value === "branch"

export default function CompleteProfilePage() {
    const router = useRouter()

    const [role, setRole] = useState<SubAdminRole | null>(null)
    const [user, setUser] = useState<any>(null)
    const [loadingAuth, setLoadingAuth] = useState(true)

    const [panCardNo, setPanCardNo] = useState("")
    const [aadharCardNo, setAadharCardNo] = useState("")
    const [accountName, setAccountName] = useState("")
    const [bankName, setBankName] = useState("")
    const [bankBranch, setBankBranch] = useState("")
    const [ifscCode, setIfscCode] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [panFile, setPanFile] = useState<File | null>(null)
    const [aadharFile, setAadharFile] = useState<File | null>(null)

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
            if (parsed?.profile_completed) {
                // Already done — bounce to the role dashboard so this page
                // can't be opened by accident from the URL bar.
                router.replace(ROLE_CONFIG[storedRole].dashboard)
                return
            }
            setRole(storedRole)
            setUser(parsed)
            if (parsed?.account_name) setAccountName(parsed.account_name)
        } catch (err) {
            console.error("Failed to parse stored user:", err)
            router.replace("/login")
            return
        } finally {
            setLoadingAuth(false)
        }
    }, [router])

    const handleFile = (setter: (f: File | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        if (file && file.size > 5 * 1024 * 1024) {
            setError("Each document must be 5 MB or smaller.")
            setter(null)
            return
        }
        setError("")
        setter(file)
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        if (!role || !user?.id) {
            setError("Session expired. Please log in again.")
            return
        }
        if (!panFile || !aadharFile) {
            setError("Please attach both PAN and Aadhar card photos.")
            return
        }

        const token =
            typeof window !== "undefined"
                ? localStorage.getItem("affiliate_token")
                : null
        if (!token) {
            setError("Session expired. Please log in again.")
            return
        }

        const formData = new FormData()
        formData.append("pan_card_no", panCardNo.trim())
        formData.append("aadhar_card_no", aadharCardNo.trim())
        formData.append("account_name", accountName.trim())
        formData.append("bank_name", bankName.trim())
        formData.append("bank_branch", bankBranch.trim())
        formData.append("ifsc_code", ifscCode.trim().toUpperCase())
        formData.append("account_number", accountNumber.trim())
        formData.append("pan_card_photo", panFile)
        formData.append("aadhar_card_photo", aadharFile)

        setSubmitting(true)
        try {
            // The userId is no longer trusted from the request body; the server
            // derives it from the verified JWT in the Authorization header.
            const res = await axios.post(ROLE_CONFIG[role].apiPath, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`,
                },
            })
            if (!res.data?.success) {
                throw new Error(res.data?.message || "Failed to save profile")
            }

            // Persist updated user so layout guards stop redirecting here.
            const updatedUser = { ...user, ...res.data.user, profile_completed: true }
            localStorage.setItem("affiliate_user", JSON.stringify(updatedUser))

            setSuccess("Profile completed. Redirecting to your dashboard...")
            setTimeout(() => {
                window.location.href = ROLE_CONFIG[role].dashboard
            }, 900)
        } catch (err: any) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                "Something went wrong. Please try again."
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm mb-3">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            One-time verification
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                            Complete your profile
                        </h1>
                        <p className="text-slate-600 mt-2 max-w-xl">
                            Welcome, <span className="font-semibold text-slate-900">{user?.first_name} {user?.last_name}</span>.
                            Before you can access your <span className="font-semibold">{ROLE_CONFIG[role].label}</span> dashboard,
                            please share your bank details and KYC documents.
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

                {/* Alerts */}
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

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Bank section */}
                    <section className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
                        <header className="border-b border-slate-200 pb-4 mb-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Landmark className="w-5 h-5 text-emerald-600" />
                                Bank details
                            </h2>
                            <p className="text-sm text-slate-600 mt-1">
                                Used to pay out your commissions. Bank transfer only.
                            </p>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field
                                label="Account holder name"
                                value={accountName}
                                onChange={setAccountName}
                                placeholder="As per bank records"
                                required
                            />
                            <Field
                                label="Account number"
                                value={accountNumber}
                                onChange={setAccountNumber}
                                placeholder="e.g. 12345678901234"
                                inputMode="numeric"
                                required
                            />
                            <Field
                                label="Bank name"
                                value={bankName}
                                onChange={setBankName}
                                placeholder="e.g. HDFC Bank"
                                required
                            />
                            <Field
                                label="Branch"
                                value={bankBranch}
                                onChange={setBankBranch}
                                placeholder="e.g. Mumbai - Andheri West"
                                required
                            />
                            <Field
                                label="IFSC code"
                                value={ifscCode}
                                onChange={(v) => setIfscCode(v.toUpperCase())}
                                placeholder="e.g. HDFC0001234"
                                required
                            />
                        </div>
                    </section>

                    {/* KYC section */}
                    <section className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
                        <header className="border-b border-slate-200 pb-4 mb-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-600" />
                                KYC documents
                            </h2>
                            <p className="text-sm text-slate-600 mt-1">
                                Upload a clear photo of each document. Accepted: JPG, PNG, PDF up to 5 MB.
                            </p>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Field
                                    label="PAN card number"
                                    value={panCardNo}
                                    onChange={(v) => setPanCardNo(v.toUpperCase())}
                                    placeholder="e.g. ABCDE1234F"
                                    required
                                />
                                <FileInput
                                    label="PAN card photo"
                                    file={panFile}
                                    onChange={handleFile(setPanFile)}
                                />
                            </div>

                            <div className="space-y-4">
                                <Field
                                    label="Aadhar card number"
                                    value={aadharCardNo}
                                    onChange={setAadharCardNo}
                                    placeholder="e.g. 1234 5678 9012"
                                    inputMode="numeric"
                                    required
                                />
                                <FileInput
                                    label="Aadhar card photo"
                                    file={aadharFile}
                                    onChange={handleFile(setAadharFile)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Submit */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-slate-500 max-w-md">
                            By submitting you confirm that the information provided is accurate.
                            Your bank details remain editable from the profile page, but PAN and
                            Aadhar cannot be changed once submitted.
                        </p>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Submit and continue</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

type FieldProps = {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    required?: boolean
    inputMode?: "text" | "numeric"
}

function Field({ label, value, onChange, placeholder, required, inputMode }: FieldProps) {
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type="text"
                inputMode={inputMode}
                required={required}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400 text-slate-900"
            />
        </div>
    )
}

type FileInputProps = {
    label: string
    file: File | null
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

function FileInput({ label, file, onChange }: FileInputProps) {
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
                {label} <span className="text-red-500">*</span>
            </label>
            <label className="flex items-center justify-between gap-3 w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
                <span className="flex items-center gap-2 text-sm text-slate-600 truncate">
                    <Upload className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="truncate">{file ? file.name : "Click to upload (JPG, PNG, PDF)"}</span>
                </span>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    onChange={onChange}
                    className="hidden"
                    required
                />
            </label>
            {file && (
                <p className="mt-1 text-xs text-emerald-700">
                    Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </p>
            )}
        </div>
    )
}
