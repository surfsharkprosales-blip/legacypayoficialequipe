import { NextResponse } from 'next/server'
import { sql, isDatabaseConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic';

// Formatar valor em BRL
const formatBRL = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatar tempo relativo
const formatRelativeTime = (date: string) => {
  const now = new Date();
  const transactionDate = new Date(date);
  const diffMs = now.getTime() - transactionDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return "Ontem";
  return `${diffDays} dias atrás`;
};

export async function GET() {
  // Verificacao de admin removida temporariamente
  
  // Verificar se banco de dados esta configurado
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      stats: {
        totalRevenue: "R$ 0,00",
        totalFees: "R$ 0,00",
        totalFeesRaw: 0,
        totalVolumeRaw: 0,
        totalUsers: 0,
        totalTransactions: 0,
        completedTransactions: 0,
        activeToday: 0,
      },
      recentTransactions: [],
      recentUsers: [],
    });
  }
  
  try {
    const [
      totalUsersResult,
      pendingKYCResult,
      revenueResult,
      feesResult,
      transactionsCountResult,
      completedTransactionsResult,
      activeTodayResult,
      recentTransactions,
      recentUsers,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM profiles`,
      sql`SELECT COUNT(*) as count FROM profiles WHERE kyc_status = 'pending'`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'completed' AND type IN ('pix_in', 'deposit')`,
      sql`SELECT COALESCE(SUM(fee), 0) as total FROM transactions WHERE status = 'completed'`,
      sql`SELECT COUNT(*) as count FROM transactions`,
      sql`SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'`,
      sql`SELECT COUNT(DISTINCT user_id) as count FROM transactions WHERE created_at >= CURRENT_DATE`,
      sql`
        SELECT 
          t.id,
          t.user_id,
          t.type,
          t.amount,
          t.fee,
          t.net_amount,
          t.status,
          t.payer_name,
          t.created_at,
          p.name as user_name,
          p.email as user_email
        FROM transactions t
        LEFT JOIN profiles p ON t.user_id = p.id
        ORDER BY t.created_at DESC
        LIMIT 10
      `,
      sql`
        SELECT id, name, email, kyc_status, created_at
        FROM profiles
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ])

    const totalFees = Number(feesResult[0]?.total) || 0;
    const totalVolume = Number(revenueResult[0]?.total) || 0;
    const completedTxCount = Number(completedTransactionsResult[0]?.count) || 0;

    return NextResponse.json({
      stats: {
        totalRevenue: formatBRL(totalVolume),
        totalFees: formatBRL(totalFees),
        totalFeesRaw: totalFees,
        totalVolumeRaw: totalVolume,
        totalUsers: Number(totalUsersResult[0]?.count || 0),
        totalTransactions: Number(transactionsCountResult[0]?.count || 0),
        completedTransactions: completedTxCount,
        activeToday: Number(activeTodayResult[0]?.count || 0),
        averageFeePercentage: totalVolume > 0 ? ((totalFees / totalVolume) * 100).toFixed(2) : "0.00",
        growthRevenue: "+0%",
        growthUsers: "+0%",
        growthTransactions: "+0%"
      },
      recentTransactions: recentTransactions.map((tx: { id: string; user_name: string | null; payer_name: string | null; user_email: string | null; amount: string; type: string; status: string; created_at: string }) => ({
        id: tx.id,
        user: tx.user_name || tx.payer_name || "Usuário",
        email: tx.user_email || "N/A",
        amount: formatBRL(Number(tx.amount)),
        type: tx.type === 'pix_in' || tx.type === 'deposit' ? 'deposit' : 'withdrawal',
        status: tx.status,
        time: formatRelativeTime(tx.created_at)
      })),
      recentUsers: recentUsers.map((user: { id: string; name: string | null; email: string; kyc_status: string; created_at: string }) => ({
        id: user.id,
        name: user.name || "Sem nome",
        email: user.email,
        status: user.kyc_status === 'approved' ? 'active' : 'pending_kyc',
        joined: formatRelativeTime(user.created_at)
      })),
      // Legacy fields for compatibility
      totalUsers: Number(totalUsersResult[0]?.count || 0),
      pendingKYC: Number(pendingKYCResult[0]?.count || 0),
      todayNotes: 0,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ 
      stats: {
        totalRevenue: "R$ 0,00",
        totalUsers: 0,
        totalTransactions: 0,
        activeToday: 0,
        growthRevenue: "+0%",
        growthUsers: "+0%",
        growthTransactions: "+0%"
      },
      recentTransactions: [],
      recentUsers: [],
      totalUsers: 0, 
      pendingKYC: 0, 
      todayNotes: 0 
    })
  }
}
