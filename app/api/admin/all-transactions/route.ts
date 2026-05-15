
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const transactions = await sql`
      SELECT t.*, p.email as user_email, p.name as user_name
      FROM transactions t
      LEFT JOIN profiles p ON t.user_id = p.id
      ORDER BY t.created_at DESC
      LIMIT 500
    `;

    return NextResponse.json(
      { transactions: transactions || [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}
