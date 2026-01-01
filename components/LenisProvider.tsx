"use client"

import { useEffect, useRef, createContext, useContext } from "react"
import Lenis from "lenis"

type LenisContextType = {
    lenis: Lenis | null
}

const LenisContext = createContext<LenisContextType>({ lenis: null })

export const useLenis = () => useContext(LenisContext)

interface LenisProviderProps {
    children: React.ReactNode
}

export default function LenisProvider({ children }: LenisProviderProps) {
    const lenisRef = useRef<Lenis | null>(null)

    useEffect(() => {
        // Initialize Lenis
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            touchMultiplier: 2,
        })

        lenisRef.current = lenis

        // Animation frame loop
        function raf(time: number) {
            lenis.raf(time)
            requestAnimationFrame(raf)
        }

        requestAnimationFrame(raf)

        // Cleanup
        return () => {
            lenis.destroy()
            lenisRef.current = null
        }
    }, [])

    return (
        <LenisContext.Provider value={{ lenis: lenisRef.current }}>
            {children}
        </LenisContext.Provider>
    )
}
