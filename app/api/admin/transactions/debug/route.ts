import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";


export const dynamic = 'force-dynamic';

/**
 * Endpoint de debug para verificar o estado de uma transacao
 * e do saldo do usuario associado
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");
    const userEmail = searchParams.get("email");

    if (!transactionId && !userEmail) {
      return NextResponse.json({ 
        error: "Informe transactionId ou email para buscar" 
      }, { status: 400 });
    }

    let transaction = null;
    let user = null;
    let auditLogs = [];
    let recentTransactions = [];

    // Buscar transacao
    if (transactionId) {
      const txResult = await sql`
        SELECT t.*, 
               p.email as user_email, 
               p.name as user_name,
               p.balance as user_balance
        FROM transactions t
        LEFT JOIN profiles p ON t.user_id = p.id
        WHERE t.id = ${transactionId}
           OR t.external_id = ${transactionId}
           OR t.acquirer_transaction_id = ${transactionId}
      `;
      transaction = txResult[0] || null;
    }

    // Buscar usuario por email
    if (userEmail) {
      const userResult = await sql`
        SELECT id, email, name, balance, created_at, updated_at
        FROM profiles
        WHERE email ILIKE ${userEmail}
      `;
      user = userResult[0] || null;

      if (user) {
        // Buscar transacoes recentes do usuario
        const txsResult = await sql`
          SELECT id, external_id, amount, fee, net_amount, status, type, created_at, paid_at
          FROM transactions
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT 10
        `;
        recentTransactions = txsResult;

        // Buscar audit logs recentes do usuario
        const logsResult = await sql`
          SELECT id, action, entity_type, description, metadata, created_at
          FROM audit_logs
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT 10
        `;
        auditLogs = logsResult;
      }
    } else if (transaction?.user_id) {
      // Se tem transacao, buscar usuario dela
      const userResult = await sql`
        SELECT id, email, name, balance, created_at, updated_at
        FROM profiles
        WHERE id = ${transaction.user_id}
      `;
      user = userResult[0] || null;

      if (user) {
        // Buscar audit logs da transacao
        const logsResult = await sql`
          SELECT id, action, entity_type, description, metadata, created_at
          FROM audit_logs
          WHERE entity_id = ${transactionId}
             OR (user_id = ${user.id} AND action IN ('transaction_manual_confirm', 'PAYMENT_CONFIRMED'))
          ORDER BY created_at DESC
          LIMIT 10
        `;
        auditLogs = logsResult;
      }
    }

    return NextResponse.json({
      transaction: transaction ? {
        id: transaction.id,
        external_id: transaction.external_id,
        acquirer_transaction_id: transaction.acquirer_transaction_id,
        amount: Number(transaction.amount),
        fee: Number(transaction.fee),
        net_amount: Number(transaction.net_amount),
        status: transaction.status,
        type: transaction.type,
        created_at: transaction.created_at,
        paid_at: transaction.paid_at,
        payer_name: transaction.payer_name,
        payer_document: transaction.payer_document,
      } : null,
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: Number(user.balance),
        created_at: user.created_at,
        updated_at: user.updated_at,
      } : null,
      recentTransactions: recentTransactions.map(tx => ({
        id: tx.id,
        external_id: tx.external_id,
        amount: Number(tx.amount),
        fee: Number(tx.fee),
        net_amount: Number(tx.net_amount),
        status: tx.status,
        type: tx.type,
        created_at: tx.created_at,
        paid_at: tx.paid_at,
      })),
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        entity_type: log.entity_type,
        description: log.description,
        metadata: log.metadata,
        created_at: log.created_at,
      })),
      debug: {
        transactionFound: !!transaction,
        userFound: !!user,
        balanceConsistent: transaction && user 
          ? `Transacao de R$ ${Number(transaction.net_amount).toFixed(2)} - Saldo atual: R$ ${Number(user.balance).toFixed(2)}`
          : null,
      }
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar dados" },
      { status: 500 }
    );
  }
}
