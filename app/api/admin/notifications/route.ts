
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendPushToAllUsers, sendMotivationalToAll } from "@/lib/push-notifications";

export async function GET() {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const notifications = await sql`
      SELECT un.*, p.name, p.email
      FROM user_notifications un
      LEFT JOIN profiles p ON p.id = un.user_id
      ORDER BY un.created_at DESC
      LIMIT 100
    `;

    // Transform to match expected format
    const transformed = notifications.map((n: Record<string, unknown>) => ({
      ...n,
      profiles: n.name || n.email ? { name: n.name, email: n.email } : null,
    }));

    // Buscar mensagens motivacionais
    const motivationalMessages = await sql`
      SELECT * FROM motivational_messages
      ORDER BY created_at DESC
    `;

    // Buscar historico de push enviados
    const pushHistory = await sql`
      SELECT * FROM admin_notifications
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // Contar usuarios com push ativo
    const pushStats = await sql`
      SELECT COUNT(*) as total FROM profiles WHERE notifications_push = true AND push_subscription IS NOT NULL
    `;

    return NextResponse.json({
      notifications: transformed,
      motivationalMessages,
      pushHistory,
      pushActiveUsers: parseInt(pushStats[0]?.total || "0")
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const session = await getSession();

    const body = await request.json();
    const { user_id, title, message, type, is_global, action } = body;

    // Enviar push motivacional para todos
    if (action === "send_motivational_push") {
      // Verificar se ha usuarios com push ativo primeiro
      const pushStats = await sql`SELECT COUNT(*) as total FROM profiles WHERE notifications_push = true AND push_subscription IS NOT NULL`;
      const totalSubs = parseInt(pushStats[0]?.total || "0");
      
      if (totalSubs === 0) {
        return NextResponse.json({
          success: false,
          error: "Nenhum usuario ativou notificacoes push ainda. Os usuarios precisam ativar em Configuracoes > Notificacoes.",
          sent: 0,
          failed: 0
        });
      }

      const result = await sendMotivationalToAll();
      
      if (session) {
        await sql`
          INSERT INTO admin_notifications (title, body, type, sent_at, sent_count, created_by)
          VALUES ('Mensagem Motivacional', 'Enviada automaticamente', 'motivation', NOW(), ${result.sent}, ${session.userId})
        `;
      }

      return NextResponse.json({
        success: result.sent > 0,
        message: result.sent > 0 
          ? `Mensagem motivacional enviada para ${result.sent} usuarios` 
          : "Nenhuma mensagem foi enviada. Verifique se ha usuarios com push ativo.",
        ...result
      });
    }

    // Enviar push customizado para todos
    if (action === "send_push_all") {
      if (!title || !message) {
        return NextResponse.json({ error: "Titulo e mensagem obrigatorios" }, { status: 400 });
      }

      // Verificar se ha usuarios com push ativo primeiro
      const pushStats2 = await sql`SELECT COUNT(*) as total FROM profiles WHERE notifications_push = true AND push_subscription IS NOT NULL`;
      const totalSubs2 = parseInt(pushStats2[0]?.total || "0");
      
      if (totalSubs2 === 0) {
        return NextResponse.json({
          success: false,
          error: "Nenhum usuario ativou notificacoes push ainda. Os usuarios precisam ativar em Configuracoes > Notificacoes.",
          sent: 0,
          failed: 0
        });
      }

      const result = await sendPushToAllUsers({
        title,
        body: message,
        tag: `admin-broadcast-${Date.now()}`,
        data: {
          type: type || "announcement",
          url: "/dashboard"
        }
      });

      if (session) {
        await sql`
          INSERT INTO admin_notifications (title, body, type, sent_at, sent_count, created_by)
          VALUES (${title}, ${message}, ${type || 'announcement'}, NOW(), ${result.sent}, ${session.userId})
        `;
      }

      return NextResponse.json({
        success: true,
        message: `Push enviado para ${result.sent} usuarios`,
        ...result
      });
    }

    // Adicionar mensagem motivacional
    if (action === "add_motivational") {
      if (!message) {
        return NextResponse.json({ error: "Mensagem obrigatoria" }, { status: 400 });
      }

      await sql`
        INSERT INTO motivational_messages (message, category, is_active)
        VALUES (${message}, 'motivation', true)
      `;

      return NextResponse.json({ success: true, message: "Mensagem adicionada" });
    }

    // Deletar mensagem motivacional
    if (action === "delete_motivational") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
      }

      await sql`DELETE FROM motivational_messages WHERE id = ${id}`;

      return NextResponse.json({ success: true, message: "Mensagem removida" });
    }

    // Toggle mensagem motivacional
    if (action === "toggle_motivational") {
      const { id, is_active } = body;
      if (!id) {
        return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
      }

      await sql`UPDATE motivational_messages SET is_active = ${is_active} WHERE id = ${id}`;

      return NextResponse.json({ success: true });
    }

    // Criar notificacao no sistema (comportamento original)
    if (!title || !message) {
      return NextResponse.json(
        { error: "Título e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    if (is_global) {
      // Busca todos os usuários ativos
      const users = await sql`SELECT id FROM profiles WHERE is_active = true`;

      // Cria notificação para cada usuário
      for (const user of users) {
        await sql`
          INSERT INTO user_notifications (user_id, title, message, type)
          VALUES (${user.id}, ${title}, ${message}, ${type || "info"})
        `;
      }

      // Tambem enviar push se solicitado
      if (body.send_push) {
        await sendPushToAllUsers({
          title,
          body: message,
          tag: `admin-${Date.now()}`,
          data: { type: type || "info", url: "/dashboard" }
        });
      }
    } else {
      // Cria notificação para usuário específico
      await sql`
        INSERT INTO user_notifications (user_id, title, message, type)
        VALUES (${user_id}, ${title}, ${message}, ${type || "info"})
      `;
    }

    // Log de auditoria
    if (session) {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, new_value)
        VALUES (
          ${session.userId},
          'CREATE_NOTIFICATION',
          'notification',
          ${JSON.stringify({ title, message, type, is_global, user_id })}
        )
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await sql`DELETE FROM user_notifications WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
