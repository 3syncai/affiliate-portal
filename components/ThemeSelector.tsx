"use client"

import { useTheme, themes, ThemeName } from '@/contexts/ThemeContext'
import { Check, Palette } from 'lucide-react'

export default function ThemeSelector() {
    const { themeName, setTheme } = useTheme()

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Choose Theme</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {themes.map((theme) => (
                    <button
                        key={theme.name}
                        onClick={() => setTheme(theme.name as ThemeName)}
                        className={`relative p-4 rounded-xl border-2 transition-all ${themeName === theme.name
                                ? 'border-gray-900 shadow-lg scale-[1.02]'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow'
                            }`}
                    >
                        {/* Color preview */}
                        <div className="flex gap-1 mb-3">
                            <div
                                className="w-8 h-8 rounded-lg shadow-inner"
                                style={{ backgroundColor: theme.sidebar }}
                            />
                            <div
                                className="w-8 h-8 rounded-lg shadow-inner"
                                style={{ backgroundColor: theme.primary }}
                            />
                            <div
                                className="w-8 h-8 rounded-lg shadow-inner"
                                style={{ backgroundColor: theme.accent }}
                            />
                        </div>

                        {/* Label */}
                        <p className="text-sm font-medium text-gray-700 text-left">
                            {theme.label}
                        </p>

                        {/* Selected indicator */}
                        {themeName === theme.name && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
