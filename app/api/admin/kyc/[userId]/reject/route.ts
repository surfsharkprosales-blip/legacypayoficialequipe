import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

import { logKYCStatusUpdate, logAdminAction } from "@/lib/discord-webhook";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Verificar se e admin (fora do try/catch)
  
  
  
  try {

    const { userId } = await params;
    const body = await request.json();
    const { reason } = body;

    // Verificar se usuario existe
    const userCheck = await sql`
      SELECT id, name, email FROM profiles WHERE id = ${userId}
    `;

    if (userCheck.length === 0) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
    }

    // Atualizar status KYC para rejeitado
    await sql`
      UPDATE profiles 
      SET kyc_status = 'rejected', updated_at = NOW()
      WHERE id = ${userId}
    `;

    // Atualizar documentos para rejeitado
    await sql`
      UPDATE kyc_documents
      SET status = 'rejected', rejection_reason = ${reason || 'Documentos invalidos'}
      WHERE user_id = ${userId} AND status = 'pending'
    `;

    // Registrar log de auditoria
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, created_at)
      VALUES (
        ${admin.userId},
        'KYC_REJECTED',
        'kyc',
        ${userId},
        ${JSON.stringify({ reason, rejectedBy: admin.userId })},
        NOW()
      )
    `;
    
    // Log para Discord
    logKYCStatusUpdate({
      userId: userId,
      userName: userCheck[0].name as string,
      userEmail: userCheck[0].email as string,
      oldStatus: "pending",
      newStatus: "rejected",
      adminName: admin.name || "Admin",
      reason: reason || "Documentos invalidos",
    });
    
    logAdminAction({
      adminName: admin.name || "Admin",
      adminEmail: admin.email || "",
      action: "KYC Rejeitado",
      target: `${userCheck[0].name} (${userCheck[0].email})`,
      details: reason || "Documentos invalidos",
    });

    return NextResponse.json({ 
      success: true, 
      message: "KYC rejeitado" 
    });
  } catch (error) {
    console.error("Erro ao rejeitar KYC:", error);
    return NextResponse.json(
      { error: "Erro ao rejeitar KYC" },
      { status: 500 }
    );
  }
}
