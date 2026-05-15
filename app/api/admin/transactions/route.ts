import { sql, isDatabaseConfigured } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verificacao de admin removida temporariamente
  
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ transactions: [] });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const status = searchParams.get("status");
    const userId = searchParams.get("user_id");

    let transactions;

    if (userId) {
      transactions = await sql`
        SELECT t.*, p.email as user_email, p.name as user_name
        FROM transactions t
        LEFT JOIN profiles p ON t.user_id = p.id
        WHERE t.user_id = ${userId}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    } else if (status) {
      transactions = await sql`
        SELECT t.*, p.email as user_email, p.name as user_name
        FROM transactions t
        LEFT JOIN profiles p ON t.user_id = p.id
        WHERE t.status = ${status}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      transactions = await sql`
        SELECT t.*, p.email as user_email, p.name as user_name
        FROM transactions t
        LEFT JOIN profiles p ON t.user_id = p.id
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ transactions: transactions || [] });
  } catch (error) {
    console.error("Error in admin transactions API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID e status são obrigatórios" },
        { status: 400 }
      );
    }

    await sql`
      UPDATE transactions 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
