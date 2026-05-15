
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é admin
    const profileResult = await sql`
      SELECT is_admin FROM profiles WHERE id = ${user.id}
    `;
    
    if (!profileResult[0]?.is_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");
    const integration = searchParams.get("integration");
    const limit = parseInt(searchParams.get("limit") || "50");

    let errors;
    
    if (resolved === "true") {
      errors = await sql`
        SELECT ie.*, p.name as user_name, p.email as user_email
        FROM integration_errors ie
        LEFT JOIN profiles p ON ie.user_id = p.id
        WHERE ie.resolved = true
        ${integration ? sql`AND ie.integration_name = ${integration}` : sql``}
        ORDER BY ie.created_at DESC
        LIMIT ${limit}
      `;
    } else if (resolved === "false") {
      errors = await sql`
        SELECT ie.*, p.name as user_name, p.email as user_email
        FROM integration_errors ie
        LEFT JOIN profiles p ON ie.user_id = p.id
        WHERE ie.resolved = false
        ${integration ? sql`AND ie.integration_name = ${integration}` : sql``}
        ORDER BY ie.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      errors = await sql`
        SELECT ie.*, p.name as user_name, p.email as user_email
        FROM integration_errors ie
        LEFT JOIN profiles p ON ie.user_id = p.id
        ${integration ? sql`WHERE ie.integration_name = ${integration}` : sql``}
        ORDER BY ie.created_at DESC
        LIMIT ${limit}
      `;
    }

    // Contar erros não resolvidos para badge
    const unresolvedCount = await sql`
      SELECT COUNT(*) as count FROM integration_errors WHERE resolved = false
    `;

    return NextResponse.json({
      errors,
      unresolvedCount: parseInt(unresolvedCount[0]?.count || "0"),
    });
  } catch (error) {
    console.error("[v0] Error fetching integration errors:", error);
    return NextResponse.json(
      { error: "Erro ao buscar erros de integração" },
      { status: 500 }
    );
  }
}

// Marcar erro como resolvido
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é admin
    const profileResult = await sql`
      SELECT is_admin FROM profiles WHERE id = ${user.id}
    `;
    
    if (!profileResult[0]?.is_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { errorId, resolved } = body;

    if (!errorId) {
      return NextResponse.json({ error: "ID do erro é obrigatório" }, { status: 400 });
    }

    await sql`
      UPDATE integration_errors
      SET resolved = ${resolved !== false}, resolved_at = NOW(), resolved_by = ${user.id}
      WHERE id = ${errorId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Error updating integration error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar erro de integração" },
      { status: 500 }
    );
  }
}
