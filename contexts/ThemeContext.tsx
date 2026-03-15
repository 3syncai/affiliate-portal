"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

export type ThemeName = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'slate'

type Theme = {
    name: ThemeName
    label: string
    primary: string
    primaryHover: string
    primaryLight: string
    sidebar: string
    sidebarText: string
    accent: string
    background: string
    cardBg: string
}

export const themes: Theme[] = [
    {
        name: 'blue',
        label: 'Ocean Blue',
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        primaryLight: '#dbeafe',
        sidebar: '#1e40af',
        sidebarText: '#ffffff',
        accent: '#0ea5e9',
        background: '#f0f5ff',
        cardBg: '#ffffff'
    },
    {
        name: 'emerald',
        label: 'Forest Green',
        primary: '#10b981',
        primaryHover: '#059669',
        primaryLight: '#d1fae5',
        sidebar: '#065f46',
        sidebarText: '#ffffff',
        accent: '#14b8a6',
        background: '#ecfdf5',
        cardBg: '#f0fdf4'
    },
    {
        name: 'violet',
        label: 'Royal Purple',
        primary: '#8b5cf6',
        primaryHover: '#7c3aed',
        primaryLight: '#ede9fe',
        sidebar: '#5b21b6',
        sidebarText: '#ffffff',
        accent: '#a855f7',
        background: '#f5f3ff',
        cardBg: '#faf5ff'
    },
    {
        name: 'rose',
        label: 'Coral Rose',
        primary: '#f43f5e',
        primaryHover: '#e11d48',
        primaryLight: '#ffe4e6',
        sidebar: '#9f1239',
        sidebarText: '#ffffff',
        accent: '#fb7185',
        background: '#fff1f2',
        cardBg: '#fff5f5'
    },
    {
        name: 'amber',
        label: 'Golden Amber',
        primary: '#f59e0b',
        primaryHover: '#d97706',
        primaryLight: '#fef3c7',
        sidebar: '#92400e',
        sidebarText: '#ffffff',
        accent: '#fbbf24',
        background: '#fffbeb',
        cardBg: '#fefce8'
    },
    {
        name: 'slate',
        label: 'Professional Dark',
        primary: '#475569',
        primaryHover: '#334155',
        primaryLight: '#f1f5f9',
        sidebar: '#1e293b',
        sidebarText: '#ffffff',
        accent: '#64748b',
        background: '#f8fafc',
        cardBg: '#ffffff'
    }
]

type ThemeContextType = {
    theme: Theme
    themeName: ThemeName
    setTheme: (name: ThemeName) => void
    isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Get default theme based on user role
    const getDefaultTheme = (role: string): ThemeName => {
        switch (role) {
            case 'asm': return 'blue'
            case 'state': return 'emerald'
            case 'branch': return 'amber'
            default: return 'blue'
        }
    }

    // Initialize theme from localStorage immediately to prevent flash
    const getInitialTheme = (): ThemeName => {
        if (typeof window === 'undefined') return 'blue'

        try {
            const userRole = localStorage.getItem('affiliate_role')
            const userData = localStorage.getItem('affiliate_user')
            const defaultTheme = getDefaultTheme(userRole || '')

            if (userData && userRole) {
                const user = JSON.parse(userData)
                const userSpecificKey = `app_theme_${user.id}_${userRole}`
                const savedTheme = localStorage.getItem(userSpecificKey) as ThemeName

                if (savedTheme && themes.find(t => t.name === savedTheme)) {
                    return savedTheme
                }
            }

            return defaultTheme
        } catch (error) {
            console.error('Error loading initial theme:', error)
            return 'blue'
        }
    }

    const [themeName, setThemeName] = useState<ThemeName>(getInitialTheme)
    const [mounted, setMounted] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Fetch theme from database on mount
    useEffect(() => {
        setMounted(true)

        const fetchTheme = async () => {
            try {
                const userRole = localStorage.getItem('affiliate_role')
                const userData = localStorage.getItem('affiliate_user')

                // Clean up old non-user-specific theme key
                const oldTheme = localStorage.getItem('app_theme')
                if (oldTheme) {
                    localStorage.removeItem('app_theme')
                }

                // Fetch from database for cross-device sync
                if (userData && userRole) {
                    const user = JSON.parse(userData)
                    const userSpecificKey = `app_theme_${user.id}_${userRole}`
                    const response = await fetch(`/api/user/theme?userId=${user.id}&userRole=${userRole}`)

                    if (response.ok) {
                        const data = await response.json()

                        if (data.success && data.theme) {
                            // Update theme if different from what we loaded initially
                            if (data.theme !== themeName) {
                                setThemeName(data.theme)
                                localStorage.setItem(userSpecificKey, data.theme)
                            }
                        } else {
                            // No theme in DB, save current theme to DB
                            const defaultTheme = getDefaultTheme(userRole)
                            await fetch('/api/user/theme', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userId: user.id,
                                    userRole: userRole,
                                    theme: defaultTheme
                                })
                            })
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching theme:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchTheme()
    }, [])

    // Apply theme CSS variables
    useEffect(() => {
        if (!mounted) return

        const theme = themes.find(t => t.name === themeName) || themes[0]

        document.documentElement.style.setProperty('--theme-primary', theme.primary)
        document.documentElement.style.setProperty('--theme-primary-hover', theme.primaryHover)
        document.documentElement.style.setProperty('--theme-primary-light', theme.primaryLight)
        document.documentElement.style.setProperty('--theme-sidebar', theme.sidebar)
        document.documentElement.style.setProperty('--theme-sidebar-text', theme.sidebarText)
        document.documentElement.style.setProperty('--theme-accent', theme.accent)
        document.documentElement.style.setProperty('--theme-background', theme.background)
        document.documentElement.style.setProperty('--theme-card-bg', theme.cardBg)

        // Save to user-specific localStorage key
        const userData = localStorage.getItem('affiliate_user')
        const userRole = localStorage.getItem('affiliate_role')
        if (userData && userRole) {
            const user = JSON.parse(userData)
            const userSpecificKey = `app_theme_${user.id}_${userRole}`
            localStorage.setItem(userSpecificKey, themeName)
        }
    }, [themeName, mounted])

    // Save theme to database
    const saveThemeToDatabase = useCallback(async (newTheme: ThemeName) => {
        try {
            const userData = localStorage.getItem('affiliate_user')
            const userRole = localStorage.getItem('affiliate_role')

            if (userData && userRole) {
                const user = JSON.parse(userData)
                await fetch('/api/user/theme', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        userRole: userRole,
                        theme: newTheme
                    })
                })
            }
        } catch (error) {
            console.error('Error saving theme to database:', error)
        }
    }, [])

    const setTheme = useCallback((name: ThemeName) => {
        setThemeName(name)
        saveThemeToDatabase(name)
    }, [saveThemeToDatabase])

    const theme = themes.find(t => t.name === themeName) || themes[0]

    return (
        <ThemeContext.Provider value={{ theme, themeName, setTheme, isLoading }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
