"use client"

import { useEffect, useState, createContext, useContext } from "react"
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
    const [lenis, setLenis] = useState<Lenis | null>(null)

    useEffect(() => {
        // Initialize Lenis
        const instance = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            touchMultiplier: 2,
        })

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLenis(instance)

        // Animation frame loop
        let rafId: number
        function raf(time: number) {
            instance.raf(time)
            rafId = requestAnimationFrame(raf)
        }

        rafId = requestAnimationFrame(raf)

        // Cleanup
        return () => {
            instance.destroy()
            setLenis(null)
            cancelAnimationFrame(rafId)
        }
    }, [])

    return (
        <LenisContext.Provider value={{ lenis }}>
            {children}
        </LenisContext.Provider>
    )
}
