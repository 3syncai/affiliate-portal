"use client"

import { ThemeProvider } from "@/contexts/ThemeContext"
import LenisProvider from "@/components/LenisProvider"
import RightClickGuard from "@/components/RightClickGuard"
import ClientErrorReporter from "@/components/ClientErrorReporter"
import { ReactNode } from "react"

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <LenisProvider>
                <RightClickGuard />
                <ClientErrorReporter />
                {children}
            </LenisProvider>
        </ThemeProvider>
    )
}
