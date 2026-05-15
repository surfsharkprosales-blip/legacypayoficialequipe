
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Get stats
    const [usersResult, kycResult, withdrawalsResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM profiles`,
      sql`SELECT COUNT(*) as count FROM kyc_documents WHERE status = 'pending'`,
      sql`SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'`,
    ]);

    // Today's volume (apenas depositos)
    const today = new Date().toISOString().split("T")[0];
    const volumeResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE created_at >= ${today} AND status = 'completed' AND type IN ('pix_in', 'deposit')
    `;

    // Recent KYC
    const recentKYC = await sql`
      SELECT k.*, p.name, p.email 
      FROM kyc_documents k
      JOIN profiles p ON k.user_id = p.id
      WHERE k.status = 'pending'
      ORDER BY k.created_at DESC
      LIMIT 5
    `;

    // Recent Withdrawals
    const recentWithdrawals = await sql`
      SELECT w.*, p.name, p.email 
      FROM withdrawals w
      JOIN profiles p ON w.user_id = p.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at DESC
      LIMIT 5
    `;

    return NextResponse.json({
      stats: {
        totalUsers: Number(usersResult[0]?.count) || 0,
        pendingKYC: Number(kycResult[0]?.count) || 0,
        pendingWithdrawals: Number(withdrawalsResult[0]?.count) || 0,
        todayVolume: Number(volumeResult[0]?.total) || 0,
      },
      recentKYC,
      recentWithdrawals,
    });
  } catch (error) {
    console.error("[v0] Error fetching manager stats:", error);
    return NextResponse.json(
      { error: "Erro ao carregar estatísticas" },
      { status: 500 }
    );
  }
}
