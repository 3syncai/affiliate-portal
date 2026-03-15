"use client"

import { ThemeProvider } from "@/contexts/ThemeContext"
import LenisProvider from "@/components/LenisProvider"
import { ReactNode } from "react"

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <LenisProvider>
                {children}
            </LenisProvider>
        </ThemeProvider>
    )
}
