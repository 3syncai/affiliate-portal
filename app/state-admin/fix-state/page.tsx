"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function FixStatePage() {
    const router = useRouter()

    useEffect(() => {
        // Fix the state value in localStorage
        const storedUser = localStorage.getItem("affiliate_user")
        if (storedUser) {
            const parsed = JSON.parse(storedUser)

            // Fix common misspellings
            if (parsed.state && parsed.state.toLowerCase() === 'maharastra') {
                parsed.state = 'Maharashtra'
                localStorage.setItem("affiliate_user", JSON.stringify(parsed))
                alert('✅ Fixed! Your state has been updated to "Maharashtra". Redirecting...')
                router.push('/state-admin/dashboard')
            } else {
                alert('State is already correct: ' + parsed.state)
                router.push('/state-admin/dashboard')
            }
        }
    }, [router])

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Fixing state value...</h1>
                <p className="text-gray-600">Please wait...</p>
            </div>
        </div>
    )
}
