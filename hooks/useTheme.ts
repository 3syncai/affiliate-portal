import { useState, useEffect } from 'react'
import axios from 'axios'

export type ThemeColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'slate'

export interface ThemeColors {
    name: ThemeColor
    primary: string
    primaryHover: string
    secondary: string
    secondaryText: string
    text: string
    ring: string
    border: string
    gradientFrom: string
    gradientTo: string
    lightBg: string
    lightText: string
}

const themeConfig: Record<ThemeColor, ThemeColors> = {
    blue: {
        name: 'blue',
        primary: 'bg-blue-600',
        primaryHover: 'hover:bg-blue-700',
        secondary: 'bg-blue-100',
        secondaryText: 'text-blue-700',
        text: 'text-blue-600',
        ring: 'focus:ring-blue-500',
        border: 'focus:border-blue-500',
        gradientFrom: 'from-blue-600',
        gradientTo: 'to-blue-700',
        lightBg: 'bg-blue-50',
        lightText: 'text-blue-100'
    },
    emerald: {
        name: 'emerald',
        primary: 'bg-emerald-600',
        primaryHover: 'hover:bg-emerald-700',
        secondary: 'bg-emerald-100',
        secondaryText: 'text-emerald-700',
        text: 'text-emerald-600',
        ring: 'focus:ring-emerald-500',
        border: 'focus:border-emerald-500',
        gradientFrom: 'from-emerald-600',
        gradientTo: 'to-emerald-700',
        lightBg: 'bg-emerald-50',
        lightText: 'text-emerald-100'
    },
    violet: {
        name: 'violet',
        primary: 'bg-violet-600',
        primaryHover: 'hover:bg-violet-700',
        secondary: 'bg-violet-100',
        secondaryText: 'text-violet-700',
        text: 'text-violet-600',
        ring: 'focus:ring-violet-500',
        border: 'focus:border-violet-500',
        gradientFrom: 'from-violet-600',
        gradientTo: 'to-violet-700',
        lightBg: 'bg-violet-50',
        lightText: 'text-violet-100'
    },
    rose: {
        name: 'rose',
        primary: 'bg-rose-600',
        primaryHover: 'hover:bg-rose-700',
        secondary: 'bg-rose-100',
        secondaryText: 'text-rose-700',
        text: 'text-rose-600',
        ring: 'focus:ring-rose-500',
        border: 'focus:border-rose-500',
        gradientFrom: 'from-rose-600',
        gradientTo: 'to-rose-700',
        lightBg: 'bg-rose-50',
        lightText: 'text-rose-100'
    },
    amber: {
        name: 'amber',
        primary: 'bg-amber-600',
        primaryHover: 'hover:bg-amber-700',
        secondary: 'bg-amber-100',
        secondaryText: 'text-amber-700',
        text: 'text-amber-600',
        ring: 'focus:ring-amber-500',
        border: 'focus:border-amber-500',
        gradientFrom: 'from-amber-600',
        gradientTo: 'to-amber-700',
        lightBg: 'bg-amber-50',
        lightText: 'text-amber-100'
    },
    slate: {
        name: 'slate',
        primary: 'bg-slate-600',
        primaryHover: 'hover:bg-slate-700',
        secondary: 'bg-slate-100',
        secondaryText: 'text-slate-700',
        text: 'text-slate-600',
        ring: 'focus:ring-slate-500',
        border: 'focus:border-slate-500',
        gradientFrom: 'from-slate-600',
        gradientTo: 'to-slate-700',
        lightBg: 'bg-slate-50',
        lightText: 'text-slate-100'
    }
}

export function useTheme() {
    const [theme, setTheme] = useState<ThemeColor>('violet')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTheme = async () => {
            try {
                const userData = localStorage.getItem('affiliate_user')
                if (!userData) {
                    setLoading(false)
                    return
                }

                const user = JSON.parse(userData)
                // Determine role from user data structure or assume state/branch based on properties
                // This logic might need refinement based on exact storage structure
                let role = 'affiliate'
                if (user.role) role = user.role
                else if (window.location.pathname.includes('state-admin')) role = 'state'
                else if (window.location.pathname.includes('branch-admin')) role = 'branch'
                else if (window.location.pathname.includes('asm')) role = 'asm'

                const response = await axios.get(`/api/user/theme?userId=${user.id}&userRole=${role}`)
                if (response.data.success) {
                    setTheme(response.data.theme as ThemeColor)
                }
            } catch (error) {
                console.error('Failed to fetch theme:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchTheme()
    }, [])

    const colors = themeConfig[theme] || themeConfig.violet

    return { theme, colors, loading }
}
