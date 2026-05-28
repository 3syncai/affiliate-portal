"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import {
    Building2,
    CreditCard,
    FileText,
    Hash,
    Landmark,
    Pencil,
    Loader2,
    MapPin,
    ShieldCheck,
    Upload,
    User as UserIcon,
    X,
    Save,
    ExternalLink,
    AlertCircle,
} from "lucide-react"

const MAX_KYC_FILE_BYTES = 5 * 1024 * 1024

type SubAdminKycBank = {
    pan_card_no: string | null
    pan_card_photo: string | null
    aadhar_card_no: string | null
    aadhar_card_photo: string | null
    account_name: string | null
    bank_name: string | null
    bank_branch: string | null
    ifsc_code: string | null
    account_number: string | null
}

const BANK_FIELDS = [
    "account_name",
    "bank_name",
    "bank_branch",
    "ifsc_code",
    "account_number",
] as const

type BankField = (typeof BANK_FIELDS)[number]
type BankForm = Record<BankField, string>

const BANK_LABELS: Record<BankField, string> = {
    account_name: "Account Holder Name",
    bank_name: "Bank Name",
    bank_branch: "Bank Branch",
    ifsc_code: "IFSC Code",
    account_number: "Account Number",
}

const BANK_ICONS: Record<BankField, React.ComponentType<{ className?: string }>> = {
    account_name: UserIcon,
    bank_name: Landmark,
    bank_branch: MapPin,
    ifsc_code: Hash,
    account_number: CreditCard,
}

interface SubAdminKycBankSectionProps {
    /** Base URL for the role-specific me route, e.g. "/api/state-admin/me". */
    apiBase: string
    /** Accent color used for headers + action buttons. Falls back to neutral slate. */
    themePrimary?: string
}

export default function SubAdminKycBankSection({ apiBase, themePrimary }: SubAdminKycBankSectionProps) {
    const accent = themePrimary || "#0f172a"
    const [data, setData] = useState<SubAdminKycBank | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [form, setForm] = useState<BankForm>({
        account_name: "",
        bank_name: "",
        bank_branch: "",
        ifsc_code: "",
        account_number: "",
    })
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

    // KYC edit mode — separate from bank edit so a user can have one card open
    // at a time without losing the other's draft. PAN/Aadhar numbers are
    // intentionally NOT seeded from localStorage; they come from React state
    // hydrated by the /me fetch (CodeRabbit PR #32 fix keeps them out of
    // localStorage entirely).
    const [isEditingKyc, setIsEditingKyc] = useState(false)
    const [kycForm, setKycForm] = useState<{
        pan_card_no: string
        aadhar_card_no: string
        panFile: File | null
        aadharFile: File | null
    }>({
        pan_card_no: "",
        aadhar_card_no: "",
        panFile: null,
        aadharFile: null,
    })
    const [savingKyc, setSavingKyc] = useState(false)
    const [kycError, setKycError] = useState<string | null>(null)
    const [kycSuccess, setKycSuccess] = useState<string | null>(null)
    // The endpoint URL is derived from the bank `apiBase` so callers don't
    // need to wire a second prop. e.g. "/api/state-admin/me" → "/api/state-admin/kyc".
    const kycEndpoint = apiBase.replace(/\/me$/, "/kyc")

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("affiliate_token") : null
                if (!token) {
                    if (!cancelled) setError("You are not logged in")
                    return
                }
                const res = await fetch(apiBase, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-store",
                })
                const json = await res.json()
                if (!cancelled) {
                    if (!res.ok || !json?.success) {
                        setError(json?.message || "Failed to load profile details")
                    } else {
                        applyUser(json.user)
                    }
                }
            } catch (err: any) {
                if (!cancelled) setError(err?.message || "Failed to load profile details")
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [apiBase])

    function applyUser(user: any) {
        const kyc: SubAdminKycBank = {
            pan_card_no: user?.pan_card_no ?? null,
            pan_card_photo: user?.pan_card_photo ?? null,
            aadhar_card_no: user?.aadhar_card_no ?? null,
            aadhar_card_photo: user?.aadhar_card_photo ?? null,
            account_name: user?.account_name ?? null,
            bank_name: user?.bank_name ?? null,
            bank_branch: user?.bank_branch ?? null,
            ifsc_code: user?.ifsc_code ?? null,
            account_number: user?.account_number ?? null,
        }
        setData(kyc)
        setForm({
            account_name: kyc.account_name || "",
            bank_name: kyc.bank_name || "",
            bank_branch: kyc.bank_branch || "",
            ifsc_code: kyc.ifsc_code || "",
            account_number: kyc.account_number || "",
        })
        syncLocalStorageUser(user)
    }

    function syncLocalStorageUser(freshUser: any) {
        if (typeof window === "undefined" || !freshUser) return
        try {
            const stored = localStorage.getItem("affiliate_user")
            if (!stored) return
            const parsed = JSON.parse(stored)
            // Persist ONLY bank fields. PAN and Aadhar identifiers are
            // sensitive PII and must not leak into localStorage where any
            // injected script can read them. The PAN/Aadhar values rendered
            // by this component come straight from the freshly-fetched
            // /me response and stay in React state for the page lifetime.
            // If a prior cached copy snuck in, scrub it on next sync.
            const {
                pan_card_no: _droppedPan,
                aadhar_card_no: _droppedAadhar,
                ...sanitizedExisting
            } = parsed || {}
            const merged = {
                ...sanitizedExisting,
                account_name: freshUser.account_name ?? sanitizedExisting.account_name ?? null,
                bank_name: freshUser.bank_name ?? sanitizedExisting.bank_name ?? null,
                bank_branch: freshUser.bank_branch ?? sanitizedExisting.bank_branch ?? null,
                ifsc_code: freshUser.ifsc_code ?? sanitizedExisting.ifsc_code ?? null,
                account_number: freshUser.account_number ?? sanitizedExisting.account_number ?? null,
            }
            localStorage.setItem("affiliate_user", JSON.stringify(merged))
        } catch {
            // Non-fatal if localStorage is corrupted; profile view still works.
        }
    }

    function startEdit() {
        if (!data) return
        setForm({
            account_name: data.account_name || "",
            bank_name: data.bank_name || "",
            bank_branch: data.bank_branch || "",
            ifsc_code: data.ifsc_code || "",
            account_number: data.account_number || "",
        })
        setSaveError(null)
        setSaveSuccess(null)
        setIsEditing(true)
    }

    function cancelEdit() {
        setIsEditing(false)
        setSaveError(null)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!data) return
        for (const field of BANK_FIELDS) {
            if (!form[field].trim()) {
                setSaveError(`${BANK_LABELS[field]} is required`)
                return
            }
        }
        setSaving(true)
        setSaveError(null)
        setSaveSuccess(null)
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("affiliate_token") : null
            if (!token) {
                setSaveError("You are not logged in")
                return
            }
            const payload: BankForm = {
                account_name: form.account_name.trim(),
                bank_name: form.bank_name.trim(),
                bank_branch: form.bank_branch.trim(),
                ifsc_code: form.ifsc_code.trim().toUpperCase(),
                account_number: form.account_number.trim(),
            }
            const res = await fetch(apiBase, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (!res.ok || !json?.success) {
                setSaveError(json?.message || "Failed to update bank details")
                return
            }
            applyUser(json.user)
            setIsEditing(false)
            setSaveSuccess("Bank details updated successfully")
        } catch (err: any) {
            setSaveError(err?.message || "Failed to update bank details")
        } finally {
            setSaving(false)
        }
    }

    function startEditKyc() {
        if (!data) return
        setKycForm({
            pan_card_no: data.pan_card_no || "",
            aadhar_card_no: data.aadhar_card_no || "",
            panFile: null,
            aadharFile: null,
        })
        setKycError(null)
        setKycSuccess(null)
        setIsEditingKyc(true)
    }

    function cancelEditKyc() {
        setIsEditingKyc(false)
        setKycError(null)
    }

    function handleKycFileChange(
        which: "panFile" | "aadharFile"
    ): (e: ChangeEvent<HTMLInputElement>) => void {
        return (e) => {
            const file = e.target.files?.[0] || null
            if (file && file.size > MAX_KYC_FILE_BYTES) {
                setKycError("Each document must be 5 MB or smaller.")
                setKycForm((prev) => ({ ...prev, [which]: null }))
                // Reset the file input so picking the same oversized file again triggers onChange.
                e.target.value = ""
                return
            }
            setKycError(null)
            setKycForm((prev) => ({ ...prev, [which]: file }))
        }
    }

    async function handleSaveKyc(e: React.FormEvent) {
        e.preventDefault()
        if (!data) return

        const panNo = kycForm.pan_card_no.trim().toUpperCase()
        const aadharNo = kycForm.aadhar_card_no.trim()
        if (!panNo) {
            setKycError("PAN card number is required")
            return
        }
        if (!aadharNo) {
            setKycError("Aadhar card number is required")
            return
        }

        setSavingKyc(true)
        setKycError(null)
        setKycSuccess(null)
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("affiliate_token") : null
            if (!token) {
                setKycError("You are not logged in")
                return
            }

            const formData = new FormData()
            formData.append("pan_card_no", panNo)
            formData.append("aadhar_card_no", aadharNo)
            if (kycForm.panFile) formData.append("pan_card_photo", kycForm.panFile)
            if (kycForm.aadharFile) formData.append("aadhar_card_photo", kycForm.aadharFile)

            const res = await fetch(kycEndpoint, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            })
            const json = await res.json()
            if (!res.ok || !json?.success) {
                setKycError(json?.message || "Failed to update KYC details")
                return
            }
            // applyUser refreshes both PAN/Aadhar React state and re-scrubs
            // them from localStorage via syncLocalStorageUser.
            applyUser(json.user)
            setIsEditingKyc(false)
            setKycSuccess("KYC details updated successfully")
        } catch (err: any) {
            setKycError(err?.message || "Failed to update KYC details")
        } finally {
            setSavingKyc(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading your KYC and bank details...
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>{error}</div>
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="space-y-6">
            {/* Bank Card */}
            <section className="rounded-lg border border-gray-200 bg-white">
                <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                            style={{ background: accent }}
                        >
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Bank Details</h3>
                            <p className="text-xs text-gray-500">
                                Used for commission payouts. You can update these anytime.
                            </p>
                        </div>
                    </div>
                    {!isEditing ? (
                        <button
                            onClick={startEdit}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    ) : (
                        <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                        </button>
                    )}
                </header>

                {saveSuccess && !isEditing && (
                    <div className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {saveSuccess}
                    </div>
                )}

                {!isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                        {BANK_FIELDS.map((field) => (
                            <ReadOnlyField
                                key={field}
                                label={BANK_LABELS[field]}
                                value={data[field]}
                                Icon={BANK_ICONS[field]}
                            />
                        ))}
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {BANK_FIELDS.map((field) => {
                                const Icon = BANK_ICONS[field]
                                return (
                                    <div key={field}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            {BANK_LABELS[field]}
                                        </label>
                                        <div className="relative">
                                            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={form[field]}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, [field]: e.target.value }))
                                                }
                                                disabled={saving}
                                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:bg-gray-50"
                                                style={{
                                                    // @ts-expect-error CSS var for ring color
                                                    "--tw-ring-color": accent,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {saveError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{saveError}</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
                                style={{ background: accent }}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                )}
            </section>

            {/* KYC Card */}
            <section className="rounded-lg border border-gray-200 bg-white">
                <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                            style={{ background: accent }}
                        >
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">KYC Documents</h3>
                            <p className="text-xs text-gray-500">
                                {isEditingKyc
                                    ? "Update your PAN and Aadhar. Leave a file picker empty to keep the current photo."
                                    : "Update your PAN and Aadhar numbers, or replace either photo."}
                            </p>
                        </div>
                    </div>
                    {!isEditingKyc ? (
                        <button
                            onClick={startEditKyc}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    ) : (
                        <button
                            onClick={cancelEditKyc}
                            disabled={savingKyc}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                        </button>
                    )}
                </header>

                {kycSuccess && !isEditingKyc && (
                    <div className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {kycSuccess}
                    </div>
                )}

                {!isEditingKyc ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                        <DocumentBlock
                            label="PAN Card"
                            number={data.pan_card_no}
                            photoUrl={data.pan_card_photo}
                        />
                        <DocumentBlock
                            label="Aadhar Card"
                            number={data.aadhar_card_no}
                            photoUrl={data.aadhar_card_photo}
                        />
                    </div>
                ) : (
                    <form onSubmit={handleSaveKyc} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <KycEditBlock
                                label="PAN Card"
                                numberLabel="PAN Number"
                                numberPlaceholder="ABCDE1234F"
                                numberValue={kycForm.pan_card_no}
                                onNumberChange={(v) =>
                                    setKycForm((prev) => ({ ...prev, pan_card_no: v.toUpperCase() }))
                                }
                                currentPhotoUrl={data.pan_card_photo}
                                pickedFile={kycForm.panFile}
                                onFilePick={handleKycFileChange("panFile")}
                                onClearFile={() =>
                                    setKycForm((prev) => ({ ...prev, panFile: null }))
                                }
                                disabled={savingKyc}
                                accent={accent}
                            />
                            <KycEditBlock
                                label="Aadhar Card"
                                numberLabel="Aadhar Number"
                                numberPlaceholder="1234 5678 9012"
                                numberValue={kycForm.aadhar_card_no}
                                onNumberChange={(v) =>
                                    setKycForm((prev) => ({ ...prev, aadhar_card_no: v }))
                                }
                                currentPhotoUrl={data.aadhar_card_photo}
                                pickedFile={kycForm.aadharFile}
                                onFilePick={handleKycFileChange("aadharFile")}
                                onClearFile={() =>
                                    setKycForm((prev) => ({ ...prev, aadharFile: null }))
                                }
                                disabled={savingKyc}
                                accent={accent}
                            />
                        </div>

                        {kycError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{kycError}</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={cancelEditKyc}
                                disabled={savingKyc}
                                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingKyc}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
                                style={{ background: accent }}
                            >
                                {savingKyc ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {savingKyc ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    )
}

function ReadOnlyField({
    label,
    value,
    Icon,
}: {
    label: string
    value: string | null
    Icon: React.ComponentType<{ className?: string }>
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{value || <span className="text-gray-400">Not provided</span>}</span>
            </div>
        </div>
    )
}

type KycEditBlockProps = {
    label: string
    numberLabel: string
    numberPlaceholder: string
    numberValue: string
    onNumberChange: (value: string) => void
    currentPhotoUrl: string | null
    pickedFile: File | null
    onFilePick: (e: ChangeEvent<HTMLInputElement>) => void
    onClearFile: () => void
    disabled: boolean
    accent: string
}

function KycEditBlock({
    label,
    numberLabel,
    numberPlaceholder,
    numberValue,
    onNumberChange,
    currentPhotoUrl,
    pickedFile,
    onFilePick,
    onClearFile,
    disabled,
    accent,
}: KycEditBlockProps) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    {numberLabel} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={numberValue}
                    onChange={(e) => onNumberChange(e.target.value)}
                    placeholder={numberPlaceholder}
                    disabled={disabled}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:bg-gray-100"
                    style={{
                        // @ts-expect-error CSS var for ring color
                        "--tw-ring-color": accent,
                    }}
                />
            </div>

            <div>
                <div className="text-xs font-medium text-gray-600 mb-1">Current document</div>
                {currentPhotoUrl ? (
                    <div className="flex items-end gap-3">
                        <a
                            href={currentPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block shrink-0"
                            aria-label={`View current ${label} in a new tab`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={currentPhotoUrl}
                                alt={`${label} current preview`}
                                className="h-20 w-auto rounded-md border border-gray-200 bg-white object-contain"
                            />
                        </a>
                        <a
                            href={currentPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 pb-1"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
                        </a>
                    </div>
                ) : (
                    <span className="text-xs text-gray-400">No document on file</span>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    Replace photo (optional, JPG/PNG/PDF up to 5 MB)
                </label>
                <label className="flex items-center justify-between gap-3 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 bg-white transition-colors">
                    <span className="flex items-center gap-2 text-xs text-gray-600 truncate">
                        <Upload className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span className="truncate">
                            {pickedFile ? pickedFile.name : "Click to upload a new photo"}
                        </span>
                    </span>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={onFilePick}
                        disabled={disabled}
                        className="hidden"
                    />
                </label>
                {pickedFile && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-emerald-700">
                        <span className="truncate">
                            Selected: {pickedFile.name} ({(pickedFile.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                            type="button"
                            onClick={onClearFile}
                            disabled={disabled}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function DocumentBlock({
    label,
    number,
    photoUrl,
}: {
    label: string
    number: string | null
    photoUrl: string | null
}) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
            </div>

            <div className="space-y-3">
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">
                        Number
                    </div>
                    <div className="text-sm font-mono text-gray-900">
                        {number || <span className="text-gray-400 font-sans">Not provided</span>}
                    </div>
                </div>

                <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                        Document
                    </div>
                    {photoUrl ? (
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                            <a
                                href={photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block shrink-0"
                                aria-label={`View ${label} in a new tab`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photoUrl}
                                    alt={`${label} preview`}
                                    className="h-24 w-auto rounded-md border border-gray-200 bg-white object-contain"
                                />
                            </a>
                            <a
                                href={photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View document
                            </a>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400">Not provided</span>
                    )}
                </div>
            </div>
        </div>
    )
}
