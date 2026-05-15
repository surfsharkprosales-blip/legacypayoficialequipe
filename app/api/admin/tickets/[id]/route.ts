import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

import { logTicketClosed, logTicketAdminReply } from "@/lib/discord-webhook";

const sql = neon(process.env.DATABASE_URL!);

export const dynamic = "force-dynamic";

// GET - Obter ticket com mensagens (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    

    const { id } = await params;

    // Buscar ticket
    const ticket = await sql`
      SELECT 
        t.*,
        p.name as user_name,
        p.email as user_email,
        p.phone as user_phone,
        p.avatar_url as user_avatar,
        p.created_at as user_since,
        a.name as admin_name,
        a.avatar_url as admin_avatar
      FROM support_tickets t
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN profiles a ON t.assigned_admin_id = a.id
      WHERE t.id = ${id}
    `;

    if (ticket.length === 0) {
      return NextResponse.json({ error: "Ticket nao encontrado" }, { status: 404 });
    }

    // Buscar mensagens
    const messages = await sql`
      SELECT 
        m.*,
        p.name as sender_name,
        p.avatar_url as sender_avatar,
        p.is_admin as sender_is_admin
      FROM ticket_messages m
      LEFT JOIN profiles p ON m.sender_id = p.id
      WHERE m.ticket_id = ${id}
      ORDER BY m.created_at ASC
    `;

    // Marcar mensagens do usuario como lidas
    await sql`
      UPDATE ticket_messages 
      SET is_read = true 
      WHERE ticket_id = ${id} AND sender_type = 'user' AND is_read = false
    `;

    // Lista de admins
    const admins = await sql`
      SELECT id, name, email, avatar_url FROM profiles WHERE is_admin = true ORDER BY name
    `;

    // Buscar info do admin atual
    const currentAdminInfo = await sql`
      SELECT name, avatar_url FROM profiles WHERE id = ${admin.userId}
    `;

    return NextResponse.json({ 
      ticket: ticket[0], 
      messages, 
      admins,
      currentAdmin: currentAdminInfo[0] || { name: admin.name }
    });
  } catch (error) {
    console.error("[Admin Tickets] Erro ao buscar ticket:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Enviar resposta (admin)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    

    const { id } = await params;
    const body = await request.json();
    const { message, attachmentUrl, attachmentType } = body;

    if (!message && !attachmentUrl) {
      return NextResponse.json({ error: "Mensagem ou anexo obrigatorio" }, { status: 400 });
    }

    // Verificar se ticket existe
    const ticket = await sql`SELECT * FROM support_tickets WHERE id = ${id}`;
    if (ticket.length === 0) {
      return NextResponse.json({ error: "Ticket nao encontrado" }, { status: 404 });
    }

    // Buscar info do admin
    const adminInfo = await sql`
      SELECT id, name, avatar_url FROM profiles WHERE id = ${admin.userId}
    `;
    const adminId = adminInfo.length > 0 ? adminInfo[0].id : admin.userId;

    // Auto-atribuir se nao tiver admin
    if (!ticket[0].assigned_admin_id) {
      await sql`
        UPDATE support_tickets 
        SET assigned_admin_id = ${adminId}, status = 'in_progress', updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Criar mensagem
    const newMessage = await sql`
      INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, attachment_url, attachment_type)
      VALUES (${id}, ${adminId}, 'admin', ${message || ''}, ${attachmentUrl || null}, ${attachmentType || null})
      RETURNING *
    `;

    // Atualizar last_message_at
    await sql`
      UPDATE support_tickets SET last_message_at = NOW(), updated_at = NOW() WHERE id = ${id}
    `;

    // Buscar info do usuario do ticket
    const userInfo = await sql`
      SELECT p.name FROM support_tickets t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.id = ${id}
    `;

    // Enviar notificacao para Discord
    logTicketAdminReply({
      ticketId: id,
      subject: ticket[0].subject,
      userName: userInfo[0]?.name || "Usuario",
      adminName: adminInfo[0]?.name || admin.name || "Admin",
      message: message || "Anexo enviado",
    });

    return NextResponse.json({ 
      success: true, 
      message: { 
        ...newMessage[0], 
        sender_name: adminInfo[0]?.name || admin.name,
        sender_avatar: adminInfo[0]?.avatar_url,
        sender_is_admin: true
      } 
    });
  } catch (error) {
    console.error("[Admin Tickets] Erro ao enviar resposta:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH - Atualizar ticket (status, prioridade, atribuicao)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    

    const { id } = await params;
    const body = await request.json();
    const { status, priority, assignedAdminId } = body;

    // Buscar dados do ticket antes de atualizar
    const ticketInfo = await sql`
      SELECT t.subject, p.name as user_name, p.email as user_email
      FROM support_tickets t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.id = ${id}
    `;

    // Buscar nome do admin
    const adminInfo = await sql`
      SELECT name FROM profiles WHERE id = ${admin.userId}
    `;
    const adminName = adminInfo[0]?.name || admin.name || "Admin";
    
    // Executar updates
    if (status && status === 'closed') {
      await sql`
        UPDATE support_tickets 
        SET status = ${status}, closed_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
      `;
    } else if (status && status === 'resolved') {
      await sql`
        UPDATE support_tickets 
        SET status = ${status}, closed_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
      `;
    } else if (status) {
      await sql`
        UPDATE support_tickets 
        SET status = ${status}, closed_at = NULL, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    
    if (priority) {
      await sql`
        UPDATE support_tickets SET priority = ${priority}, updated_at = NOW() WHERE id = ${id}
      `;
    }
    
    if (assignedAdminId !== undefined) {
      await sql`
        UPDATE support_tickets SET assigned_admin_id = ${assignedAdminId}, updated_at = NOW() WHERE id = ${id}
      `;
    }

    // Enviar notificacao Discord quando fechar/resolver
    if (status === 'closed' || status === 'resolved') {
      if (ticketInfo.length > 0) {
        logTicketClosed({
          ticketId: id,
          subject: ticketInfo[0].subject,
          status: status,
          userName: ticketInfo[0].user_name,
          userEmail: ticketInfo[0].user_email,
          closedBy: "admin",
          adminName: adminName,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Tickets] Erro ao atualizar ticket:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
