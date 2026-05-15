
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let withdrawals;
    
    if (status && status !== "all") {
      withdrawals = await sql`
        SELECT w.*, p.email as user_email, p.name as user_name, p.balance as user_balance
        FROM withdrawals w
        LEFT JOIN profiles p ON w.user_id = p.id
        WHERE w.status = ${status}
        ORDER BY w.created_at DESC
      `;
    } else {
      withdrawals = await sql`
        SELECT w.*, p.email as user_email, p.name as user_name, p.balance as user_balance
        FROM withdrawals w
        LEFT JOIN profiles p ON w.user_id = p.id
        ORDER BY w.created_at DESC
      `;
    }

    // Calcular estatísticas
    const stats = {
      pending: withdrawals.filter((w: { status: string }) => w.status === "pending").length,
      processing: withdrawals.filter((w: { status: string }) => w.status === "processing").length,
      completed: withdrawals.filter((w: { status: string }) => w.status === "completed" || w.status === "paid").length,
      rejected: withdrawals.filter((w: { status: string }) => w.status === "rejected").length,
      totalPending: withdrawals.filter((w: { status: string }) => w.status === "pending").reduce((sum: number, w: { amount: number }) => sum + (w.amount || 0), 0),
      totalCompleted: withdrawals.filter((w: { status: string }) => w.status === "completed" || w.status === "paid").reduce((sum: number, w: { amount: number }) => sum + (w.amount || 0), 0),
    };

    return NextResponse.json({
      withdrawals: withdrawals || [],
      stats,
    });
  } catch (error) {
    console.error("[v0] Error in withdrawals API:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
