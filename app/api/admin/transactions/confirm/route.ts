import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { notifyPixPaid } from "@/lib/notifications";


export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    
    const { transactionId, forceReprocess } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: "ID da transação é obrigatório" }, { status: 400 });
    }

    // Buscar a transação
    const txResult = await sql`
      SELECT * FROM transactions WHERE id = ${transactionId}
    `;

    if (txResult.length === 0) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    }

    const transaction = txResult[0];

    // Se forceReprocess=true, permite reprocessar mesmo transacoes ja completadas
    // Isso e util quando o saldo nao foi creditado corretamente
    if ((transaction.status === "completed" || transaction.status === "paid") && !forceReprocess) {
      return NextResponse.json({ 
        error: "Transação já está completada. Use forceReprocess=true para reprocessar.", 
        status: transaction.status 
      }, { status: 400 });
    }

    // Se for reprocessamento, verificar se o saldo ja foi creditado consultando audit_logs
    const netAmount = Number(transaction.net_amount) || Number(transaction.amount);
    let alreadyCredited = false;
    
    if (forceReprocess) {
      const existingCredit = await sql`
        SELECT id FROM audit_logs 
        WHERE entity_id = ${transaction.id}
          AND action IN ('PAYMENT_CONFIRMED', 'transaction_manual_confirm')
        LIMIT 1
      `;
      alreadyCredited = existingCredit.length > 0;
      
      if (alreadyCredited) {
        console.log(`[Admin Confirm] Transacao ${transaction.id} ja teve saldo creditado anteriormente. Creditando novamente por forceReprocess.`);
      }
    }

    // Atualizar status da transação
    const paidAt = new Date().toISOString();
    await sql`
      UPDATE transactions 
      SET status = 'completed', paid_at = COALESCE(paid_at, ${paidAt}), updated_at = NOW()
      WHERE id = ${transaction.id}
    `;

    // Atualizar saldo do usuário
    const profileResult = await sql`SELECT balance FROM profiles WHERE id = ${transaction.user_id}`;
    const currentBalance = Number(profileResult[0]?.balance) || 0;
    const newBalance = currentBalance + netAmount;

    await sql`UPDATE profiles SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${transaction.user_id}`;

    console.log(`[Admin Confirm] Saldo creditado: R$ ${netAmount.toFixed(2)} para usuario ${transaction.user_id}. Saldo anterior: R$ ${currentBalance.toFixed(2)}, Novo saldo: R$ ${newBalance.toFixed(2)}`);

    // Enviar notificacao com push para o usuario
    try {
      const grossAmount = Number(transaction.amount) || netAmount;
      await notifyPixPaid(transaction.user_id, grossAmount, netAmount);
      console.log(`[Admin Confirm] Push notification enviado para usuario ${transaction.user_id}`);
    } catch (notifError) {
      console.error("[Admin Confirm] Error sending notification:", notifError);
    }

    // Log de auditoria
    try {
      await sql`
        INSERT INTO audit_logs (id, user_id, action, entity_id, entity_type, description, old_value, new_value, metadata, created_at)
        VALUES (
          ${crypto.randomUUID()},
          ${transaction.user_id},
          'transaction_manual_confirm',
          ${transaction.id},
          'transaction',
          ${`Transação ${transaction.id} ${forceReprocess ? 'reprocessada' : 'confirmada'}. Valor líquido: R$ ${netAmount.toFixed(2)}`},
          ${currentBalance.toString()},
          ${newBalance.toString()},
          ${JSON.stringify({ 
            transaction_id: transaction.id, 
            amount: Number(transaction.amount),
            net_amount: netAmount,
            previous_balance: currentBalance,
            new_balance: newBalance,
            force_reprocess: forceReprocess || false,
            already_credited_before: alreadyCredited
          })},
          NOW()
        )
      `;
    } catch (logError) {
      console.error("Error creating audit log:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "Transação confirmada com sucesso",
      transaction: {
        id: transaction.id,
        status: "completed",
        amount: Number(transaction.amount),
        netAmount,
        paidAt,
      },
      user: {
        id: transaction.user_id,
        previousBalance: currentBalance,
        newBalance,
      },
    });
  } catch (error) {
    console.error("Error confirming transaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao confirmar transação" },
      { status: 500 }
    );
  }
}
