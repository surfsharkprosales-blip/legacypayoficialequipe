import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

import { put, list, del } from "@vercel/blob";

// Listar backups existentes
export async function GET() {
  
  

  try {
    // Listar backups do Vercel Blob
    const { blobs } = await list({ prefix: "backups/" });

    const backups = blobs.map((blob) => ({
      id: blob.pathname,
      name: blob.pathname.replace("backups/", ""),
      size: blob.size,
      created_at: blob.uploadedAt,
      url: blob.url,
    }));

    // Ordenar por data (mais recentes primeiro)
    backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Buscar configuracao de backup
    const config = await sql`
      SELECT * FROM system_settings WHERE key = 'backup_config'
    `;

    const backupConfig = config.length > 0 
      ? JSON.parse(config[0].value as string)
      : {
          auto_backup_enabled: false,
          backup_frequency: "daily",
          retention_days: 30,
          last_backup: null,
        };

    return NextResponse.json({ 
      backups,
      config: backupConfig,
    });
  } catch (error) {
    console.error("Error listing backups:", error);
    return NextResponse.json(
      { error: "Erro ao listar backups" },
      { status: 500 }
    );
  }
}

// Criar backup manual
export async function POST(request: NextRequest) {
  
  

  try {
    const { action } = await request.json();

    if (action === "create") {
      // Exportar dados das tabelas principais
      const profiles = await sql`SELECT * FROM profiles`;
      const transactions = await sql`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10000`;
      const withdrawals = await sql`SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 5000`;
      const acquirers = await sql`SELECT * FROM acquirers`;
      const systemSettings = await sql`SELECT * FROM system_settings`;

      const backupData = {
        version: "1.0",
        created_at: new Date().toISOString(),
        tables: {
          profiles: {
            count: profiles.length,
            data: profiles,
          },
          transactions: {
            count: transactions.length,
            data: transactions,
          },
          withdrawals: {
            count: withdrawals.length,
            data: withdrawals,
          },
          acquirers: {
            count: acquirers.length,
            data: acquirers,
          },
          system_settings: {
            count: systemSettings.length,
            data: systemSettings,
          },
        },
        metadata: {
          total_users: profiles.length,
          total_transactions: transactions.length,
          total_withdrawals: withdrawals.length,
        },
      };

      // Gerar nome do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backups/backup_${timestamp}.json`;

      // Upload para Vercel Blob
      const backupJson = JSON.stringify(backupData, null, 2);
      const blob = await put(filename, backupJson, {
        access: "public",
        addRandomSuffix: false,
      });

      // Atualizar last_backup
      await sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('backup_config', ${JSON.stringify({
          auto_backup_enabled: false,
          backup_frequency: "daily",
          retention_days: 30,
          last_backup: new Date().toISOString(),
        })}, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = jsonb_set(
            COALESCE(system_settings.value::jsonb, '{}'::jsonb),
            '{last_backup}',
            ${JSON.stringify(new Date().toISOString())}::jsonb
          ),
          updated_at = NOW()
      `;

      return NextResponse.json({
        success: true,
        backup: {
          name: filename,
          url: blob.url,
          size: backupJson.length,
          created_at: new Date().toISOString(),
        },
      });
    }

    if (action === "update_config") {
      const { config } = await request.json();

      await sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('backup_config', ${JSON.stringify(config)}, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET value = ${JSON.stringify(config)}, updated_at = NOW()
      `;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (error) {
    console.error("Error creating backup:", error);
    return NextResponse.json(
      { error: "Erro ao criar backup" },
      { status: 500 }
    );
  }
}

// Deletar backup
export async function DELETE(request: NextRequest) {
  
  

  try {
    const { pathname } = await request.json();

    await del(pathname);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting backup:", error);
    return NextResponse.json(
      { error: "Erro ao deletar backup" },
      { status: 500 }
    );
  }
}
