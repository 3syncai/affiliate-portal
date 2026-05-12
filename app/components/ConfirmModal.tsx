"use client"

import { useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"

type ConfirmModalProps = {
    open: boolean
    title?: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: "danger" | "default"
    onConfirm: () => void
    onCancel: () => void
}

export default function ConfirmModal({
    open,
    title = "Are you sure?",
    message,
    confirmLabel = "Yes",
    cancelLabel = "No",
    tone = "danger",
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    // Lock body scroll while modal is open and close on Escape
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel()
        }
        document.addEventListener("keydown", onKey)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = prevOverflow
        }
    }, [open, onCancel])

    if (!open) return null

    const confirmClasses =
        tone === "danger"
            ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-300"
            : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300"

    const iconClasses =
        tone === "danger" ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50"

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        >
            {/* Backdrop */}
            <button
                aria-label="Close"
                onClick={onCancel}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
            />

            {/* Panel */}
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <button
                    onClick={onCancel}
                    aria-label="Close dialog"
                    className="absolute top-3 right-3 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconClasses}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1 pr-6">
                            <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900">
                                {title}
                            </h3>
                            {message && (
                                <p className="mt-1 text-sm text-gray-600">{message}</p>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            autoFocus
                            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 ${confirmClasses}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
