import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";


const sql = neon(process.env.DATABASE_URL!);

export const dynamic = "force-dynamic";

// GET - Listar todos os tickets (admin)
export async function GET(request: NextRequest) {
  try {
    // Verificar se e admin usando o sistema correto
    
    

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const assignedTo = searchParams.get("assignedTo");

    // Buscar todos os tickets
    let tickets = await sql`
      SELECT 
        t.*,
        p.name as user_name,
        p.email as user_email,
        p.avatar_url as user_avatar,
        a.name as admin_name,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND is_read = false AND sender_type = 'user') as unread_count
      FROM support_tickets t
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN profiles a ON t.assigned_admin_id = a.id
      ORDER BY 
        CASE WHEN t.status = 'open' THEN 0 
             WHEN t.status = 'in_progress' THEN 1 
             ELSE 2 END,
        CASE WHEN t.priority = 'urgent' THEN 0 
             WHEN t.priority = 'high' THEN 1 
             WHEN t.priority = 'normal' THEN 2 
             ELSE 3 END,
        t.last_message_at DESC NULLS LAST
    `;

    // Filtrar no servidor
    if (status && status !== 'all') {
      tickets = tickets.filter((t: { status: string }) => t.status === status);
    }
    if (category && category !== 'all') {
      tickets = tickets.filter((t: { category: string }) => t.category === category);
    }
    if (assignedTo === 'me') {
      tickets = tickets.filter((t: { assigned_admin_id: string | null }) => t.assigned_admin_id === admin.userId);
    } else if (assignedTo === 'unassigned') {
      tickets = tickets.filter((t: { assigned_admin_id: string | null }) => !t.assigned_admin_id);
    }

    // Stats
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
        COUNT(*) FILTER (WHERE assigned_admin_id IS NULL AND status != 'closed') as unassigned_count
      FROM support_tickets
    `;

    // Lista de admins para atribuicao
    const admins = await sql`
      SELECT id, name, email, avatar_url FROM profiles WHERE is_admin = true ORDER BY name
    `;

    return NextResponse.json({ 
      tickets, 
      stats: stats[0],
      admins 
    });
  } catch (error) {
    console.error("[Admin Tickets] Erro ao buscar tickets:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
