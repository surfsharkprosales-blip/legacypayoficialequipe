
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

// Cache para URLs do Blob (evita múltiplas chamadas ao list)
let blobUrlCache: Map<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minuto

async function getBlobUrlMap(): Promise<Map<string, string>> {
  const now = Date.now();
  
  // Retorna cache se ainda válido
  if (blobUrlCache && (now - cacheTimestamp) < CACHE_TTL) {
    return blobUrlCache;
  }

  try {
    const urlMap = new Map<string, string>();
    let cursor: string | undefined;
    
    // Lista todos os blobs na pasta kyc
    do {
      const response = await list({ prefix: "kyc/", cursor, limit: 1000 });
      for (const blob of response.blobs) {
        // Mapeia pathname para URL completa
        urlMap.set(blob.pathname, blob.url);
      }
      cursor = response.cursor;
    } while (cursor);

    blobUrlCache = urlMap;
    cacheTimestamp = now;
    return urlMap;
  } catch (error) {
    console.error("[Admin KYC] Error listing blobs:", error);
    return new Map();
  }
}

export async function GET() {
  try {
    // Verificar se e admin
    
    
    
    // Buscar todos os usuarios
    const profiles = await sql`
      SELECT id, email, name, kyc_status, created_at
      FROM profiles
      ORDER BY created_at DESC
    `;

    // Buscar todos os documentos KYC
    const documents = await sql`
      SELECT * FROM kyc_documents ORDER BY created_at DESC
    `;

    // Obter mapa de URLs do Blob
    const blobUrlMap = await getBlobUrlMap();

    // Agrupar documentos por usuário e adicionar URLs de visualização
    const usersWithDocs = profiles.map((profile: { id: string; email: string; name: string; kyc_status: string; created_at: string }) => {
      const userDocs = documents.filter((doc: { user_id: string }) => doc.user_id === profile.id) || [];
      
      return {
        ...profile,
        documents: userDocs.map((doc: { file_url: string; [key: string]: unknown }) => {
          let viewUrl = doc.file_url;
          
          // Se já é URL completa, usar diretamente
          if (doc.file_url && doc.file_url.startsWith('http')) {
            viewUrl = doc.file_url;
          } else if (doc.file_url) {
            // Buscar URL completa no mapa do Blob
            const blobUrl = blobUrlMap.get(doc.file_url);
            if (blobUrl) {
              viewUrl = blobUrl;
            } else {
              // Fallback: tentar construir URL manualmente (pode não funcionar para blobs privados)
              viewUrl = `/api/kyc/file?pathname=${encodeURIComponent(doc.file_url)}`;
            }
          }
          
          return {
            ...doc,
            viewUrl,
          };
        }),
      };
    });

    return NextResponse.json({ users: usersWithDocs });
  } catch (error) {
    console.error("[v0] API Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, action, rejectionReason } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: "userId e action são obrigatórios" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Atualizar documentos do usuário
    await sql`
      UPDATE kyc_documents
      SET status = ${newStatus},
          rejection_reason = ${action === "reject" ? rejectionReason : null},
          reviewed_at = NOW()
      WHERE user_id = ${userId}
    `;

    // Atualizar perfil do usuário
    await sql`
      UPDATE profiles
      SET kyc_status = ${newStatus}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    // Criar notificação para o usuário
    const notificationTitle = action === "approve" ? "KYC Aprovado!" : "KYC Rejeitado";
    const notificationMessage = action === "approve"
      ? "Parabéns! Sua verificação de identidade foi aprovada. Você já pode usar todas as funcionalidades da plataforma."
      : `Sua verificação foi rejeitada. Motivo: ${rejectionReason}. Por favor, envie novos documentos.`;
    const notificationType = action === "approve" ? "success" : "error";

    await sql`
      INSERT INTO user_notifications (id, user_id, title, message, type, created_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${notificationTitle}, ${notificationMessage}, ${notificationType}, NOW())
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] API Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
