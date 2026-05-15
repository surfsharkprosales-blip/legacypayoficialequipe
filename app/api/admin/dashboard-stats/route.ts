import { NextResponse } from "next/server";
import { sql, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      totalVolume: 0,
      totalFees: 0,
      totalUsers: 0,
      totalTransactions: 0,
      pendingKyc: 0,
      pendingWithdrawals: 0,
      openTickets: 0,
      recentTransactions: [],
    });
  }

  try {
    // Buscar estatisticas em paralelo
    const [
      volumeResult,
      usersResult,
      transactionsResult,
      pendingKycResult,
      pendingWithdrawalsResult,
      openTicketsResult,
      recentTransactionsResult,
    ] = await Promise.all([
      // Volume total e taxas
      sql`SELECT 
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_fees
      FROM transactions 
      WHERE status = 'completed'`,
      
      // Total de usuarios
      sql`SELECT COUNT(*) as count FROM profiles WHERE is_active = true`,
      
      // Total de transacoes hoje
      sql`SELECT COUNT(*) as count FROM transactions 
        WHERE DATE(created_at) = CURRENT_DATE`,
      
      // KYC pendentes
      sql`SELECT COUNT(*) as count FROM profiles 
        WHERE kyc_status = 'pending' OR kyc_status = 'submitted'`,
      
      // Saques pendentes
      sql`SELECT COUNT(*) as count FROM withdrawals 
        WHERE status = 'pending'`,
      
      // Tickets abertos
      sql`SELECT COUNT(*) as count FROM support_tickets 
        WHERE status = 'open' OR status = 'in_progress'`,
      
      // Transacoes recentes
      sql`SELECT 
        t.id, t.type, t.amount, t.status, t.created_at,
        p.email as user_email
      FROM transactions t
      LEFT JOIN profiles p ON t.user_id = p.id
      ORDER BY t.created_at DESC
      LIMIT 5`,
    ]);

    return NextResponse.json({
      totalVolume: Number(volumeResult[0]?.total_volume) || 0,
      totalFees: Number(volumeResult[0]?.total_fees) || 0,
      totalUsers: Number(usersResult[0]?.count) || 0,
      totalTransactions: Number(transactionsResult[0]?.count) || 0,
      pendingKyc: Number(pendingKycResult[0]?.count) || 0,
      pendingWithdrawals: Number(pendingWithdrawalsResult[0]?.count) || 0,
      openTickets: Number(openTicketsResult[0]?.count) || 0,
      recentTransactions: recentTransactionsResult || [],
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({
      totalVolume: 0,
      totalFees: 0,
      totalUsers: 0,
      totalTransactions: 0,
      pendingKyc: 0,
      pendingWithdrawals: 0,
      openTickets: 0,
      recentTransactions: [],
    });
  }
}
