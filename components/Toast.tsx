"use client";

import { useState, useEffect } from "react";
import { CheckCircle, X, DollarSign, Bell } from "lucide-react";

interface ToastProps {
    message: string;
    type?: "success" | "error" | "info" | "payment";
    duration?: number;
    onClose?: () => void;
    amount?: number;
}

export function Toast({ message, type = "success", duration = 5000, onClose, amount }: ToastProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => {
                setIsVisible(false);
                onClose?.();
            }, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!isVisible) return null;

    const icons = {
        success: <CheckCircle className="w-6 h-6 text-emerald-500" />,
        error: <X className="w-6 h-6 text-red-500" />,
        info: <Bell className="w-6 h-6 text-blue-500" />,
        payment: <DollarSign className="w-6 h-6 text-emerald-500" />,
    };

    const backgrounds = {
        success: "bg-emerald-50 border-emerald-200",
        error: "bg-red-50 border-red-200",
        info: "bg-blue-50 border-blue-200",
        payment: "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300",
    };

    return (
        <div
            className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300 ${backgrounds[type]
                } ${isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}
        >
            <div className="flex-shrink-0">
                {type === "payment" ? (
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                        <DollarSign className="w-5 h-5 text-white" />
                    </div>
                ) : (
                    icons[type]
                )}
            </div>
            <div className="flex-1">
                <p className="font-medium text-gray-900">{message}</p>
                {amount && (
                    <p className="text-lg font-bold text-emerald-600">₹{amount.toFixed(2)}</p>
                )}
            </div>
            <button
                onClick={() => {
                    setIsExiting(true);
                    setTimeout(() => {
                        setIsVisible(false);
                        onClose?.();
                    }, 300);
                }}
                className="flex-shrink-0 p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
                <X className="w-4 h-4 text-gray-500" />
            </button>
        </div>
    );
}

// Toast container for multiple toasts
interface ToastContainerProps {
    toasts: Array<{
        id: string;
        message: string;
        type?: "success" | "error" | "info" | "payment";
        amount?: number;
    }>;
    onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-2">
            {toasts.map((toast, index) => (
                <div
                    key={toast.id}
                    style={{ transform: `translateY(${index * 10}px)` }}
                >
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        amount={toast.amount}
                        onClose={() => onRemove(toast.id)}
                    />
                </div>
            ))}
        </div>
    );
}
