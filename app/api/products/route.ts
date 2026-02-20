import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");

        if (!authHeader) {
            return NextResponse.json(
                { success: false, message: "No authorization header found" },
                { status: 401 }
            );
        }

        // Forward request completely server-side to bypass CORS
        // Browser -> Next.js Server (Same Origin, No CORS) -> External Backend (Server-to-Server, No CORS)
        const response = await fetch(`${BACKEND_URL}/affiliate/user/products`, {
            method: "GET",
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to fetch products from backend",
                    backend_status: response.status,
                    backend_error: errorData
                },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Product proxy error:", err);
        return NextResponse.json(
            {
                success: false,
                message: "Internal Proxy Error",
                error: err.message
            },
            { status: 500 }
        );
    }
}
