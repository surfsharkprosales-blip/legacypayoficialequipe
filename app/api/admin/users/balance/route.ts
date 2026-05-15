import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { notifyAdminDeposit } from "@/lib/notifications";


export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    
    const body = await request.json();
    const { userId, operation, amount, newBalance, reason } = body;

    if (!userId || !operation || amount === undefined || newBalance === undefined) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      );
    }

    // Buscar saldo atual do usuário
    const userResult = await sql`
      SELECT id, email, name, balance FROM profiles WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    const user = userResult[0];
    const oldBalance = Number(user.balance) || 0;

    // Atualizar saldo
    await sql`
      UPDATE profiles 
      SET balance = ${newBalance}, updated_at = NOW() 
      WHERE id = ${userId}
    `;

    // Registrar log de auditoria
    const logId = crypto.randomUUID();
    try {
      await sql`
        INSERT INTO audit_logs (
          id, 
          user_id, 
          action, 
          entity_type, 
          entity_id, 
          old_value, 
          new_value, 
          created_at
        )
        VALUES (
          ${logId},
          ${userId},
          ${operation === 'add' ? 'BALANCE_CREDIT' : 'BALANCE_DEBIT'},
          'profile',
          ${userId},
          ${JSON.stringify({ 
            balance: oldBalance,
            email: user.email,
            name: user.name
          })},
          ${JSON.stringify({ 
            balance: newBalance, 
            amount: amount,
            operation: operation,
            reason: reason || (operation === 'add' ? 'Crédito manual pelo admin' : 'Débito manual pelo admin'),
            changed_at: new Date().toISOString()
          })},
          NOW()
        )
      `;
    } catch (logError) {
      console.error("Error creating audit log:", logError);
    }

    // Criar notificação e enviar push para o usuário
    try {
      if (operation === 'add') {
        // Enviar notificacao com push para credito
        await notifyAdminDeposit(userId, Number(amount));
      } else {
        // Para debito, criar notificacao simples
        const notificationId = crypto.randomUUID();
        await sql`
          INSERT INTO user_notifications (id, user_id, title, message, type, created_at)
          VALUES (
            ${notificationId},
            ${userId},
            'Debito em sua conta',
            ${`Foi debitado R$ ${Number(amount).toFixed(2)} da sua conta. ${reason ? `Motivo: ${reason}` : ''}`},
            'warning',
            NOW()
          )
        `;
      }
    } catch (notifError) {
      console.error("Error creating notification:", notifError);
    }

    return NextResponse.json({ 
      success: true,
      oldBalance: Number(oldBalance),
      newBalance: Number(newBalance),
      auditLogId: logId
    });
  } catch (error) {
    console.error("Error updating user balance:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar saldo" },
      { status: 500 }
    );
  }
}

// GET para buscar historico de alteracoes de saldo de um usuario
export async function GET(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId é obrigatório" },
        { status: 400 }
      );
    }

    const logs = await sql`
      SELECT * FROM audit_logs 
      WHERE entity_id = ${userId} 
        AND action IN ('BALANCE_CREDIT', 'BALANCE_DEBIT')
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching balance history:", error);
    return NextResponse.json(
      { error: "Erro ao buscar histórico" },
      { status: 500 }
    );
  }
}
