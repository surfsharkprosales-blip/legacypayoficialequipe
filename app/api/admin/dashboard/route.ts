
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verificar se e admin
    
    
    // Buscar estatísticas em paralelo
    const [
      totalUsersResult,
      pendingKYCResult,
      approvedKYCResult,
      volumeResult,
      feesResult,
      transactionsCountResult,
      recentUsersResult,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM profiles`,
      sql`SELECT COUNT(*) as count FROM profiles WHERE kyc_status = 'pending'`,
      sql`SELECT COUNT(*) as count FROM profiles WHERE kyc_status = 'approved'`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'completed' AND type IN ('pix_in', 'deposit')`,
      sql`SELECT COALESCE(SUM(fee), 0) as total FROM transactions WHERE status = 'completed'`,
      sql`SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'`,
      sql`SELECT id, email, name, kyc_status, created_at, balance 
          FROM profiles 
          ORDER BY created_at DESC 
          LIMIT 10`,
    ]);

    const totalVolume = Number(volumeResult[0]?.total) || 0;
    const totalFees = Number(feesResult[0]?.total) || 0;
    const totalTransactions = Number(transactionsCountResult[0]?.count) || 0;

    return NextResponse.json({
      stats: {
        totalUsers: Number(totalUsersResult[0]?.count) || 0,
        pendingKYC: Number(pendingKYCResult[0]?.count) || 0,
        approvedKYC: Number(approvedKYCResult[0]?.count) || 0,
        totalRevenue: totalVolume,
        totalFees,
        totalTransactions,
        averageFeePercentage: totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0,
      },
      recentUsers: recentUsersResult || [],
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (error) {
    console.error("Error in admin dashboard API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
