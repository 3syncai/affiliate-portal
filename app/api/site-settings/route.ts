import { NextResponse } from "next/server"
import { isRightClickEnabled } from "@/lib/site-settings"

export async function GET() {
    try {
        const enabled = await isRightClickEnabled()
        return NextResponse.json(
            { success: true, rightClickEnabled: enabled },
            {
                headers: {
                    "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
                },
            }
        )
    } catch (error) {
        console.error("site-settings error:", error)
        return NextResponse.json({
            success: true,
            rightClickEnabled: true,
        })
    }
}
