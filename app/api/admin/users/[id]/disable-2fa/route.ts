import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";


const sql = neon(process.env.DATABASE_URL!);

// DELETE - Desativar 2FA de usuario (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    

    const { id } = await params;

    // Verificar se usuario existe
    const user = await sql`SELECT id, email, name FROM profiles WHERE id = ${id}`;
    if (user.length === 0) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
    }

    // Verificar se tem 2FA ativado
    const twoFA = await sql`SELECT id FROM two_factor_auth WHERE user_id = ${id}`;
    if (twoFA.length === 0) {
      return NextResponse.json({ error: "Usuario nao tem 2FA ativado" }, { status: 400 });
    }

    // Desativar 2FA
    await sql`DELETE FROM two_factor_auth WHERE user_id = ${id}`;

    // Registrar acao no audit log
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, created_at)
      VALUES (${admin.userId}, 'ADMIN_DISABLE_2FA', 'user', ${id}, ${JSON.stringify({ 
        targetUser: user[0].email,
        adminName: admin.name 
      })}, NOW())
    `;

    return NextResponse.json({ 
      success: true, 
      message: `2FA desativado para ${user[0].name || user[0].email}` 
    });
  } catch (error) {
    console.error("[Admin] Erro ao desativar 2FA:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
