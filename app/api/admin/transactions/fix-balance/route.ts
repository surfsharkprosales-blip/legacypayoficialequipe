import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";


export const dynamic = 'force-dynamic';

/**
 * Endpoint para corrigir saldos de transacoes que foram confirmadas
 * mas nao tiveram o saldo creditado corretamente.
 * 
 * POST /api/admin/transactions/fix-balance
 * Body: { transactionId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    
    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: "ID da transação é obrigatório" }, { status: 400 });
    }

    // Buscar a transação
    const txResult = await sql`
      SELECT t.*, p.balance as current_balance, p.email as user_email, p.name as user_name
      FROM transactions t
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE t.id = ${transactionId}
    `;

    if (txResult.length === 0) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    }

    const transaction = txResult[0];

    // Verificar se a transacao esta confirmada
    if (transaction.status !== "completed" && transaction.status !== "paid") {
      return NextResponse.json({ 
        error: "Transação não está confirmada", 
        status: transaction.status 
      }, { status: 400 });
    }

    // Verificar se o saldo ja foi creditado
    const existingCredit = await sql`
      SELECT id, new_value, created_at FROM audit_logs 
      WHERE entity_id = ${transaction.id}
        AND action IN ('PAYMENT_CONFIRMED', 'transaction_manual_confirm')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const wasAlreadyCredited = existingCredit.length > 0;

    // Calcular valores
    const netAmount = Number(transaction.net_amount) || Number(transaction.amount);
    const currentBalance = Number(transaction.current_balance) || 0;
    const newBalance = currentBalance + netAmount;

    // Atualizar saldo do usuario
    await sql`
      UPDATE profiles 
      SET balance = ${newBalance}, updated_at = NOW() 
      WHERE id = ${transaction.user_id}
    `;

    console.log(`[Fix Balance] Saldo corrigido para usuario ${transaction.user_id}. Transacao: ${transaction.id}. Anterior: R$ ${currentBalance.toFixed(2)}, Creditado: R$ ${netAmount.toFixed(2)}, Novo: R$ ${newBalance.toFixed(2)}`);

    // Registrar no audit log
    await sql`
      INSERT INTO audit_logs (id, user_id, action, entity_id, entity_type, description, old_value, new_value, metadata, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${transaction.user_id},
        'BALANCE_FIX',
        ${transaction.id},
        'transaction',
        ${`Correção de saldo para transação ${transaction.id}. Valor: R$ ${netAmount.toFixed(2)}`},
        ${currentBalance.toString()},
        ${newBalance.toString()},
        ${JSON.stringify({ 
          transaction_id: transaction.id, 
          amount: Number(transaction.amount),
          net_amount: netAmount,
          previous_balance: currentBalance,
          new_balance: newBalance,
          was_already_credited: wasAlreadyCredited,
          previous_credit_log: existingCredit[0] || null
        })},
        NOW()
      )
    `;

    // Criar notificacao para o usuario
    await sql`
      INSERT INTO user_notifications (id, user_id, title, message, type, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${transaction.user_id},
        'Saldo Atualizado',
        ${`Seu saldo foi atualizado. Creditado R$ ${netAmount.toFixed(2)} referente ao PIX.`},
        'success',
        NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      message: "Saldo corrigido com sucesso",
      transaction: {
        id: transaction.id,
        status: transaction.status,
        amount: Number(transaction.amount),
        netAmount,
      },
      user: {
        id: transaction.user_id,
        email: transaction.user_email,
        name: transaction.user_name,
        previousBalance: currentBalance,
        creditedAmount: netAmount,
        newBalance,
      },
      wasAlreadyCredited,
    });
  } catch (error) {
    console.error("Error fixing balance:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao corrigir saldo" },
      { status: 500 }
    );
  }
}
