"use client"

import { useTheme, themes, ThemeName } from '@/contexts/ThemeContext'
import { Check, Palette, Sparkles } from 'lucide-react'

const descriptions: Record<ThemeName, string> = {
    blue: 'Calm and trustworthy',
    emerald: 'Fresh and growth-focused',
    violet: 'Premium and creative',
    rose: 'Warm and energetic',
    amber: 'Bold and optimistic',
    slate: 'Sleek and professional',
    dark: 'Easy on the eyes at night',
}

export default function ThemeSelector() {
    const { themeName, setTheme, theme } = useTheme()

    return (
        <div className="space-y-6">
            {/* Header + active theme summary - rendered with the live theme so
                the section itself blends with whatever is currently selected. */}
            <div
                className="rounded-2xl border p-5 flex items-center justify-between gap-4 transition-colors"
                style={{
                    backgroundColor: theme.cardBg,
                    borderColor: `${theme.primary}33`,
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                        style={{
                            background: `linear-gradient(135deg, ${theme.sidebar}, ${theme.primary})`,
                        }}
                    >
                        <Palette className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: theme.sidebar }}>
                            Choose Theme
                        </h3>
                        <p className="text-xs text-gray-500">
                            Currently active:{' '}
                            <span className="font-medium" style={{ color: theme.primary }}>
                                {theme.label}
                            </span>
                        </p>
                    </div>
                </div>

                <div
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                        backgroundColor: theme.primaryLight,
                        color: theme.sidebar,
                    }}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Live preview
                </div>
            </div>

            {/* Theme grid - each card is a tiny mock of the app layout so the
                preview matches what the user will actually see. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {themes.map((t) => {
                    const isActive = themeName === t.name
                    return (
                        <button
                            key={t.name}
                            onClick={() => setTheme(t.name as ThemeName)}
                            aria-pressed={isActive}
                            aria-label={`Apply ${t.label} theme`}
                            className={`group relative rounded-2xl border-2 p-1.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                                isActive
                                    ? 'shadow-xl scale-[1.02]'
                                    : 'border-transparent hover:shadow-md hover:-translate-y-0.5'
                            }`}
                            style={{
                                borderColor: isActive ? t.primary : '#e5e7eb',
                                backgroundColor: t.cardBg,
                            }}
                        >
                            {/* Mini-app preview */}
                            <div
                                className="rounded-xl overflow-hidden border"
                                style={{
                                    backgroundColor: t.background,
                                    borderColor: `${t.primary}22`,
                                }}
                            >
                                <div className="flex h-24">
                                    {/* Mini sidebar */}
                                    <div
                                        className="w-1/4 flex flex-col items-center justify-start gap-1.5 py-2"
                                        style={{
                                            background: `linear-gradient(to bottom, ${t.sidebar}, ${t.sidebar}dd)`,
                                        }}
                                    >
                                        <div className="w-5 h-1 rounded-full bg-white/60" />
                                        <div className="w-5 h-1 rounded-full bg-white/30" />
                                        <div className="w-5 h-1 rounded-full bg-white/30" />
                                        <div className="w-5 h-1 rounded-full bg-white/30" />
                                    </div>

                                    {/* Mini content area */}
                                    <div className="flex-1 p-2 flex flex-col gap-1.5">
                                        {/* Top header bar */}
                                        <div className="flex items-center justify-between">
                                            <div
                                                className="h-1.5 w-10 rounded-full"
                                                style={{ backgroundColor: t.sidebar }}
                                            />
                                            <div
                                                className="h-3 w-3 rounded-full"
                                                style={{ backgroundColor: t.accent }}
                                            />
                                        </div>

                                        {/* Mini cards row */}
                                        <div className="flex gap-1">
                                            <div
                                                className="flex-1 rounded h-6 flex items-end p-1"
                                                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.primary}1a` }}
                                            >
                                                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: t.primary }} />
                                            </div>
                                            <div
                                                className="flex-1 rounded h-6 flex items-end p-1"
                                                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.primary}1a` }}
                                            >
                                                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: t.accent }} />
                                            </div>
                                        </div>

                                        {/* Mini button */}
                                        <div
                                            className="self-start mt-auto h-2.5 w-10 rounded-full"
                                            style={{ backgroundColor: t.primary }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card footer with label + swatches */}
                            <div className="px-2 pt-3 pb-1.5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {t.label}
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                        {descriptions[t.name as ThemeName]}
                                    </p>
                                </div>
                                <div className="flex -space-x-1.5 flex-shrink-0">
                                    <span
                                        className="w-4 h-4 rounded-full ring-2 ring-white"
                                        style={{ backgroundColor: t.sidebar }}
                                    />
                                    <span
                                        className="w-4 h-4 rounded-full ring-2 ring-white"
                                        style={{ backgroundColor: t.primary }}
                                    />
                                    <span
                                        className="w-4 h-4 rounded-full ring-2 ring-white"
                                        style={{ backgroundColor: t.accent }}
                                    />
                                </div>
                            </div>

                            {/* Selected indicator */}
                            {isActive && (
                                <div
                                    className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-md ring-2 ring-white animate-in fade-in zoom-in duration-200"
                                    style={{ backgroundColor: t.primary }}
                                >
                                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
