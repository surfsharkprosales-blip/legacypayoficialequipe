
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET - Lista todas as premiações e premiações de usuários
export async function GET() {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Busca todas as premiações dos usuários com informações do perfil
    const userRewards = await sql`
      SELECT 
        r.*,
        p.name as user_name,
        p.email as user_email,
        p.balance as user_balance
      FROM rewards r
      LEFT JOIN profiles p ON p.id = r.user_id
      ORDER BY r.created_at DESC
    `;

    // Transforma para incluir profiles como objeto
    const transformed = userRewards.map((r: Record<string, unknown>) => ({
      ...r,
      profiles: {
        name: r.user_name,
        email: r.user_email,
        balance: r.user_balance,
      },
    }));

    return NextResponse.json({ rewards: transformed });
  } catch (error) {
    console.error("[Admin Rewards] Error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar premiações" },
      { status: 500 }
    );
  }
}

// POST - Cria uma nova premiação para um usuário específico
export async function POST(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, type, amount, status = "pending" } = body;

    if (!user_id || !type || !amount) {
      return NextResponse.json(
        { error: "user_id, type e amount são obrigatórios" },
        { status: 400 }
      );
    }

    // Cria a premiação
    const result = await sql`
      INSERT INTO rewards (user_id, type, amount, status)
      VALUES (${user_id}, ${type}, ${amount}, ${status})
      RETURNING *
    `;

    // Cria notificação para o usuário
    await sql`
      INSERT INTO user_notifications (user_id, title, message, type)
      VALUES (
        ${user_id},
        'Nova Premiação Disponível!',
        ${'Parabéns! Você desbloqueou uma premiação: ' + type + ' no valor de R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })},
        'success'
      )
    `;

    // Log de auditoria
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
      VALUES (
        ${session.userId},
        'CREATE_REWARD',
        'reward',
        ${result[0].id},
        ${JSON.stringify({ user_id, type, amount, status })}
      )
    `;

    return NextResponse.json({ success: true, reward: result[0] });
  } catch (error) {
    console.error("[Admin Rewards] Error creating:", error);
    return NextResponse.json(
      { error: "Erro ao criar premiação" },
      { status: 500 }
    );
  }
}

// PUT - Atualiza status de uma premiação
export async function PUT(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id e status são obrigatórios" },
        { status: 400 }
      );
    }

    // Busca a premiação atual
    const current = await sql`SELECT * FROM rewards WHERE id = ${id}`;
    if (current.length === 0) {
      return NextResponse.json(
        { error: "Premiação não encontrada" },
        { status: 404 }
      );
    }

    // Atualiza o status
    const creditedAt = status === "credited" ? new Date().toISOString() : null;

    await sql`
      UPDATE rewards 
      SET status = ${status}, credited_at = ${creditedAt}
      WHERE id = ${id}
    `;

    // Se creditado, notifica o usuário
    if (status === "credited") {
      await sql`
        INSERT INTO user_notifications (user_id, title, message, type)
        VALUES (
          ${current[0].user_id},
          'Premiação Creditada!',
          ${'Sua premiação de R$ ' + Number(current[0].amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' foi creditada com sucesso!'},
          'success'
        )
      `;
    }

    // Log de auditoria
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
      VALUES (
        ${session.userId},
        'UPDATE_REWARD_STATUS',
        'reward',
        ${id},
        ${JSON.stringify(current[0])},
        ${JSON.stringify({ status, credited_at: creditedAt })}
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Rewards] Error updating:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar premiação" },
      { status: 500 }
    );
  }
}

// DELETE - Remove uma premiação
export async function DELETE(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    // Busca antes de deletar para log
    const current = await sql`SELECT * FROM rewards WHERE id = ${id}`;

    await sql`DELETE FROM rewards WHERE id = ${id}`;

    // Log de auditoria
    if (current.length > 0) {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value)
        VALUES (
          ${session.userId},
          'DELETE_REWARD',
          'reward',
          ${id},
          ${JSON.stringify(current[0])}
        )
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Rewards] Error deleting:", error);
    return NextResponse.json(
      { error: "Erro ao deletar premiação" },
      { status: 500 }
    );
  }
}
