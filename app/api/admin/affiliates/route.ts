
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    // Check if admin
    const adminCheck = await sql`
      SELECT is_admin FROM profiles WHERE id = ${session.userId}
    `;
    if (!adminCheck[0]?.is_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Get all affiliates with their stats
    const affiliatesStats = await sql`
      SELECT 
        p.id,
        p.name,
        p.email,
        p.referral_code,
        p.created_at,
        COUNT(DISTINCT ref.id) as total_referrals,
        COALESCE(SUM(ac.amount), 0) as total_commissions,
        COALESCE(SUM(CASE WHEN ac.status = 'pending' THEN ac.amount ELSE 0 END), 0) as pending_commissions,
        COALESCE(SUM(CASE WHEN ac.status = 'paid' THEN ac.amount ELSE 0 END), 0) as paid_commissions
      FROM profiles p
      LEFT JOIN profiles ref ON ref.referred_by = p.id
      LEFT JOIN affiliate_commissions ac ON ac.affiliate_id = p.id
      GROUP BY p.id, p.name, p.email, p.referral_code, p.created_at
      HAVING COUNT(DISTINCT ref.id) > 0 OR SUM(ac.amount) > 0
      ORDER BY total_commissions DESC
    `;

    // Get overall stats
    const overallStats = await sql`
      SELECT 
        COUNT(DISTINCT affiliate_id) as total_affiliates,
        COUNT(*) as total_commissions,
        COALESCE(SUM(amount), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_total
      FROM affiliate_commissions
    `;

    // Get recent commissions for all users
    const recentCommissions = await sql`
      SELECT 
        ac.id,
        ac.amount,
        ac.status,
        ac.created_at,
        aff.name as affiliate_name,
        aff.email as affiliate_email,
        ref.name as referred_user_name,
        t.amount as transaction_amount
      FROM affiliate_commissions ac
      LEFT JOIN profiles aff ON aff.id = ac.affiliate_id
      LEFT JOIN profiles ref ON ref.id = ac.referred_user_id
      LEFT JOIN transactions t ON t.id = ac.transaction_id
      ORDER BY ac.created_at DESC
      LIMIT 50
    `;

    // Get top affiliates
    const topAffiliates = await sql`
      SELECT 
        p.id,
        p.name,
        p.email,
        COUNT(DISTINCT ref.id) as total_referrals,
        COALESCE(SUM(ac.amount), 0) as total_earned
      FROM profiles p
      LEFT JOIN profiles ref ON ref.referred_by = p.id
      LEFT JOIN affiliate_commissions ac ON ac.affiliate_id = p.id
      GROUP BY p.id, p.name, p.email
      HAVING COUNT(DISTINCT ref.id) > 0
      ORDER BY total_earned DESC
      LIMIT 10
    `;

    return NextResponse.json({
      affiliates: affiliatesStats,
      stats: overallStats[0] || {
        total_affiliates: 0,
        total_commissions: 0,
        total_paid: 0,
        pending_total: 0
      },
      recentCommissions,
      topAffiliates
    });
  } catch (error) {
    console.error("Erro ao buscar afiliados admin:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// Pay pending commissions
export async function POST(request: Request) {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    // Check if admin
    const adminCheck = await sql`
      SELECT is_admin FROM profiles WHERE id = ${session.userId}
    `;
    if (!adminCheck[0]?.is_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { affiliateId, action } = await request.json();

    if (action === "pay_all") {
      // Pay all pending commissions for an affiliate
      const pendingCommissions = await sql`
        SELECT SUM(amount) as total FROM affiliate_commissions 
        WHERE affiliate_id = ${affiliateId} AND status = 'pending'
      `;

      const totalToPay = parseFloat(pendingCommissions[0]?.total || 0);

      if (totalToPay > 0) {
        // Mark commissions as paid
        await sql`
          UPDATE affiliate_commissions 
          SET status = 'paid', paid_at = NOW() 
          WHERE affiliate_id = ${affiliateId} AND status = 'pending'
        `;

        // Add to affiliate balance
        await sql`
          UPDATE profiles 
          SET balance = balance + ${totalToPay} 
          WHERE id = ${affiliateId}
        `;

        return NextResponse.json({
          success: true,
          message: `R$ ${totalToPay.toFixed(2)} pagos com sucesso`,
          amount: totalToPay
        });
      }

      return NextResponse.json({ error: "Nenhuma comissao pendente" }, { status: 400 });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (error) {
    console.error("Erro ao pagar comissoes:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
