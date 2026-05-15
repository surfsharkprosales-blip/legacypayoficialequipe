
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Buscar transações com dados do usuário
    const transactions = await sql`
      SELECT t.*, p.name as user_name, p.email as user_email
      FROM transactions t
      LEFT JOIN profiles p ON t.user_id = p.id
      ORDER BY t.created_at DESC
    `;

    // Buscar saques com dados do usuário
    const withdrawals = await sql`
      SELECT w.*, p.name as user_name, p.email as user_email
      FROM withdrawals w
      LEFT JOIN profiles p ON w.user_id = p.id
      ORDER BY w.created_at DESC
    `;

    // Combinar transações
    const allTransactions = [
      ...transactions.map((tx: Record<string, unknown>) => ({
        id: tx.id,
        user_id: tx.user_id,
        user_name: tx.user_name || "N/A",
        user_email: tx.user_email || "N/A",
        type: tx.type || "pix_in",
        amount: Number(tx.amount) || 0,
        fee: Number(tx.fee) || 0,
        net_amount: Number(tx.net_amount) || 0,
        status: String(tx.status),
        description: tx.description || "Transação PIX",
        created_at: tx.created_at,
        payer_name: tx.payer_name,
        external_id: tx.external_id,
      })),
      ...withdrawals.map((wd: Record<string, unknown>) => ({
        id: wd.id,
        user_id: wd.user_id,
        user_name: wd.user_name || "N/A",
        user_email: wd.user_email || "N/A",
        type: "withdrawal",
        amount: Number(wd.amount) || 0,
        fee: Number(wd.fee) || 0,
        net_amount: Number(wd.net_amount) || 0,
        status: String(wd.status),
        description: wd.description || "Saque PIX",
        created_at: wd.created_at,
        payer_name: wd.recipient_name,
        external_id: wd.pix_key,
      })),
    ].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

    // Calcular estatísticas
    const completedTx = allTransactions.filter((tx) => tx.status === "completed");
    // Volume apenas de depositos (pix_in, deposit) - saques NAO contam no volume
    const depositTx = completedTx.filter((tx) => tx.type === "pix_in" || tx.type === "deposit");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTx = completedTx.filter((tx) => new Date(tx.created_at as string) >= today);
    const todayDepositTx = todayTx.filter((tx) => tx.type === "pix_in" || tx.type === "deposit");
    const uniqueUsers = new Set(allTransactions.map((tx) => tx.user_id));

    const stats = {
      total_transactions: allTransactions.length,
      total_volume: depositTx.reduce((acc, tx) => acc + tx.amount, 0), // Apenas depositos
      total_fees_collected: completedTx.reduce((acc, tx) => acc + tx.fee, 0),
      pending_count: allTransactions.filter((tx) => tx.status === "pending").length,
      completed_count: completedTx.length,
      cancelled_count: allTransactions.filter((tx) => tx.status === "cancelled" || tx.status === "failed").length,
      users_count: uniqueUsers.size,
      today_volume: todayDepositTx.reduce((acc, tx) => acc + tx.amount, 0), // Apenas depositos
      today_fees: todayTx.reduce((acc, tx) => acc + tx.fee, 0),
    };

    return NextResponse.json(
      { transactions: allTransactions, stats },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error("Error in admin reports API:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
