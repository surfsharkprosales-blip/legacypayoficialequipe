
import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const action = searchParams.get("action");
    const limit = parseInt(searchParams.get("limit") || "500");

    let logs;

    if (userId) {
      logs = await sql`
        SELECT al.*, p.name as user_name, p.email as user_email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE al.user_id = ${userId}
        ORDER BY al.created_at DESC
        LIMIT ${limit}
      `;
    } else if (action) {
      logs = await sql`
        SELECT al.*, p.name as user_name, p.email as user_email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE al.action = ${action}
        ORDER BY al.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      logs = await sql`
        SELECT al.*, p.name as user_name, p.email as user_email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        ORDER BY al.created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error("[v0] Error in admin logs API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
