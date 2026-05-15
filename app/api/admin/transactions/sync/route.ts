
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createMisticPayClient } from "@/lib/acquirers/misticpay";

export const dynamic = "force-dynamic";

/**
 * Sincroniza transações pendentes com a adquirente
 * GET /api/admin/transactions/sync
 */
export async function GET() {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    // Buscar transações pendentes
    const pendingTx = await sql`
      SELECT t.*, p.balance as user_balance
      FROM transactions t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.status = 'pending' 
        AND t.type = 'pix_in'
        AND t.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY t.created_at DESC
      LIMIT 50
    `;

    if (pendingTx.length === 0) {
      return NextResponse.json({ 
        message: "Nenhuma transação pendente", 
        synced: 0 
      });
    }

    const misticPay = await createMisticPayClient();
    
    if (!misticPay) {
      return NextResponse.json({ error: "Cliente MisticPay não disponível" }, { status: 500 });
    }

    let synced = 0;
    let failed = 0;
    const results: Array<{ id: string; status: string; action: string }> = [];

    for (const tx of pendingTx) {
      try {
    // SEGURANCA: Verificar se e admin
    
    

        const checkId = tx.acquirer_transaction_id || tx.external_id;
        
        if (!checkId) {
          results.push({ id: tx.id, status: "skipped", action: "No acquirer ID" });
          continue;
        }

        const checkResult = await misticPay.checkTransaction(checkId);

        if (checkResult.success && checkResult.data) {
          const acquirerStatus = String(checkResult.data.status).toUpperCase();
          
          if (acquirerStatus === "COMPLETO" || acquirerStatus === "COMPLETED") {
            // Atualizar para completed
            await sql`
              UPDATE transactions 
              SET status = 'completed', paid_at = NOW(), updated_at = NOW()
              WHERE id = ${tx.id}
            `;

            // Creditar saldo
            const netAmount = Number(tx.net_amount) || Number(tx.amount);
            const currentBalance = Number(tx.user_balance) || 0;
            const newBalance = currentBalance + netAmount;

            await sql`
              UPDATE profiles 
              SET balance = ${newBalance}, updated_at = NOW() 
              WHERE id = ${tx.user_id}
            `;

            // Log de auditoria
            await sql`
              INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (
                gen_random_uuid(), 
                ${tx.user_id}, 
                'PIX_SYNCED', 
                'transaction', 
                ${tx.id},
                ${JSON.stringify({ amount: Number(tx.amount), net_amount: netAmount, new_balance: newBalance })}::jsonb, 
                NOW()
              )
            `;

            // Notificação
            await sql`
              INSERT INTO user_notifications (id, user_id, title, message, type, created_at)
              VALUES (
                gen_random_uuid(), 
                ${tx.user_id}, 
                'PIX Confirmado!', 
                ${`Seu PIX de R$ ${netAmount.toFixed(2)} foi confirmado. Saldo: R$ ${newBalance.toFixed(2)}`}, 
                'success', 
                NOW()
              )
            `;

            synced++;
            results.push({ id: tx.id, status: "completed", action: "Synced and credited" });
          } else if (acquirerStatus === "FALHA" || acquirerStatus === "FAILED" || acquirerStatus === "CANCELADO") {
            await sql`
              UPDATE transactions 
              SET status = 'failed', updated_at = NOW()
              WHERE id = ${tx.id}
            `;
            
            failed++;
            results.push({ id: tx.id, status: "failed", action: "Marked as failed" });
          } else {
            results.push({ id: tx.id, status: acquirerStatus, action: "Still pending" });
          }
        } else {
          results.push({ id: tx.id, status: "error", action: checkResult.error || "Check failed" });
        }
      } catch (err) {
        results.push({ id: tx.id, status: "error", action: String(err) });
      }
    }

    return NextResponse.json({
      total: pendingTx.length,
      synced,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error syncing transactions:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * Confirma manualmente uma transação (para admin/testes)
 * POST /api/admin/transactions/sync
 */
export async function POST(request: Request) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const { transactionId, action } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId é obrigatório" }, { status: 400 });
    }

    // Buscar transação
    const txResult = await sql`
      SELECT t.*, p.balance as user_balance
      FROM transactions t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.id = ${transactionId}
    `;

    if (txResult.length === 0) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    }

    const tx = txResult[0];

    if (tx.status === "completed") {
      return NextResponse.json({ error: "Transação já está completada" }, { status: 400 });
    }

    if (action === "complete" || action === "confirm") {
      // Atualizar status
      await sql`
        UPDATE transactions 
        SET status = 'completed', paid_at = NOW(), updated_at = NOW()
        WHERE id = ${transactionId}
      `;

      // Creditar saldo
      const netAmount = Number(tx.net_amount) || Number(tx.amount);
      const currentBalance = Number(tx.user_balance) || 0;
      const newBalance = currentBalance + netAmount;

      await sql`
        UPDATE profiles 
        SET balance = ${newBalance}, updated_at = NOW() 
        WHERE id = ${tx.user_id}
      `;

      // Log
      await sql`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES (
          gen_random_uuid(), 
          ${tx.user_id}, 
          'MANUAL_CONFIRM', 
          'transaction', 
          ${transactionId},
          ${JSON.stringify({ balance: currentBalance })}::jsonb,
          ${JSON.stringify({ balance: newBalance, amount: Number(tx.amount), net_amount: netAmount })}::jsonb, 
          NOW()
        )
      `;

      // Notificação
      await sql`
        INSERT INTO user_notifications (id, user_id, title, message, type, created_at)
        VALUES (
          gen_random_uuid(), 
          ${tx.user_id}, 
          'PIX Confirmado!', 
          ${`Seu PIX de R$ ${netAmount.toFixed(2)} foi confirmado. Novo saldo: R$ ${newBalance.toFixed(2)}`}, 
          'success', 
          NOW()
        )
      `;

      return NextResponse.json({
        success: true,
        transactionId,
        newStatus: "completed",
        creditedAmount: netAmount,
        newBalance,
      });
    }

    if (action === "fail" || action === "cancel") {
      await sql`
        UPDATE transactions 
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${transactionId}
      `;

      return NextResponse.json({
        success: true,
        transactionId,
        newStatus: "failed",
      });
    }

    return NextResponse.json({ error: "Ação inválida. Use: complete, confirm, fail, cancel" }, { status: 400 });
  } catch (error) {
    console.error("Error confirming transaction:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
