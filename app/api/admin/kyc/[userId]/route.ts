
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const { userId } = await params;

    // Buscar documentos do usuario
    const documents = await sql`
      SELECT id, user_id, document_type, document_url, status, created_at
      FROM kyc_documents
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Erro ao buscar documentos KYC:", error);
    return NextResponse.json(
      { error: "Erro ao buscar documentos" },
      { status: 500 }
    );
  }
}
