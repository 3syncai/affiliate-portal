import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireDebugAuth } from "@/lib/debug-controller-auth"
import {
    AFFILIATE_TABLES,
    getAffiliateTableDef,
    isAllowedAffiliateTable,
    TRUNCATE_ALL_CONFIRM,
    TRUNCATE_ORDER,
} from "@/lib/affiliate-db-tables"
import { addDebugLog } from "@/lib/debug-monitor"

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    const previewTable = req.nextUrl.searchParams.get("preview")
    const previewLimit = Math.min(
        parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10,
        50
    )

    if (previewTable) {
        if (!isAllowedAffiliateTable(previewTable)) {
            return NextResponse.json(
                { success: false, message: "Table not allowed" },
                { status: 403 }
            )
        }

        try {
            const countResult = await pool.query(
                `SELECT COUNT(*)::int AS count FROM ${previewTable}`
            )
            const rowsResult = await pool.query(
                `SELECT * FROM ${previewTable} ORDER BY 1 DESC LIMIT $1`,
                [previewLimit]
            )
            const columnsResult = await pool.query(
                `SELECT column_name, data_type
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1
                 ORDER BY ordinal_position`,
                [previewTable]
            )

            return NextResponse.json({
                success: true,
                table: previewTable,
                count: countResult.rows[0]?.count ?? 0,
                columns: columnsResult.rows,
                rows: rowsResult.rows,
            })
        } catch (err) {
            return NextResponse.json(
                {
                    success: false,
                    message: err instanceof Error ? err.message : String(err),
                },
                { status: 500 }
            )
        }
    }

    const tables = []
    for (const def of AFFILIATE_TABLES) {
        try {
            const result = await pool.query(
                `SELECT COUNT(*)::int AS count FROM ${def.table}`
            )
            tables.push({
                ...def,
                count: result.rows[0]?.count ?? 0,
                exists: true,
            })
        } catch (err) {
            tables.push({
                ...def,
                count: null,
                exists: false,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    const totalRows = tables.reduce(
        (sum, t) => sum + (typeof t.count === "number" ? t.count : 0),
        0
    )

    return NextResponse.json({
        success: true,
        tables,
        totalRows,
        tableCount: tables.filter((t) => t.exists).length,
    })
}

export async function DELETE(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    let body: { table?: string; action?: string; confirmText?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        )
    }

    const confirmText =
        typeof body.confirmText === "string" ? body.confirmText.trim() : ""

    // Bulk truncate all affiliate tables
    if (body.action === "truncate_all") {
        if (confirmText !== TRUNCATE_ALL_CONFIRM) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Type exactly "${TRUNCATE_ALL_CONFIRM}" to confirm`,
                },
                { status: 400 }
            )
        }

        const results: { table: string; ok: boolean; error?: string }[] = []

        for (const table of TRUNCATE_ORDER) {
            if (!isAllowedAffiliateTable(table)) continue
            try {
                await pool.query(
                    `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`
                )
                results.push({ table, ok: true })
            } catch (err) {
                results.push({
                    table,
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        }

        addDebugLog("warn", "All affiliate tables truncated via debug controller", {
            source: "debug-controller/tables",
            meta: {
                results: results.filter((r) => !r.ok),
                truncated: results.filter((r) => r.ok).length,
            },
        })

        return NextResponse.json({
            success: true,
            message: "Bulk truncate completed",
            results,
        })
    }

    // Single table truncate
    const table = typeof body.table === "string" ? body.table.trim() : ""
    if (!table || !isAllowedAffiliateTable(table)) {
        return NextResponse.json(
            { success: false, message: "Invalid or disallowed table" },
            { status: 400 }
        )
    }

    const def = getAffiliateTableDef(table)
    const expectedConfirm = table

    if (confirmText !== expectedConfirm) {
        return NextResponse.json(
            {
                success: false,
                message: `Type exactly "${expectedConfirm}" to confirm deletion`,
            },
            { status: 400 }
        )
    }

    try {
        const countBefore = await pool.query(
            `SELECT COUNT(*)::int AS count FROM ${table}`
        )
        await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)

        addDebugLog("warn", `Table truncated: ${table}`, {
            source: "debug-controller/tables",
            meta: {
                table,
                rowsDeleted: countBefore.rows[0]?.count ?? 0,
                protected: def?.protected ?? false,
            },
        })

        return NextResponse.json({
            success: true,
            message: `Table "${table}" truncated`,
            rowsDeleted: countBefore.rows[0]?.count ?? 0,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addDebugLog("error", `Failed to truncate ${table}: ${message}`, {
            source: "debug-controller/tables",
        })
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        )
    }
}
