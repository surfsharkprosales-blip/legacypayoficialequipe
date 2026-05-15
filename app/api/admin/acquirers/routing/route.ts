import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";


// Buscar configuracao de roteamento
export async function GET() {
  
  

  try {
    const config = await sql`
      SELECT * FROM system_settings WHERE key = 'routing_config'
    `;

    if (config.length === 0) {
      // Retornar config padrao
      return NextResponse.json({
        auto_routing: true,
        routing_mode: "lowest_fee",
        fallback_enabled: true,
        fallback_threshold: 30,
        health_check_interval: 60,
      });
    }

    return NextResponse.json(JSON.parse(config[0].value as string));
  } catch (error) {
    console.error("Error fetching routing config:", error);
    return NextResponse.json(
      { error: "Erro ao buscar configuracao" },
      { status: 500 }
    );
  }
}

// Salvar configuracao de roteamento
export async function POST(request: NextRequest) {
  
  

  try {
    const config = await request.json();

    // Validar config
    const validModes = ["lowest_fee", "highest_success", "round_robin", "priority"];
    if (!validModes.includes(config.routing_mode)) {
      return NextResponse.json(
        { error: "Modo de roteamento invalido" },
        { status: 400 }
      );
    }

    // Salvar ou atualizar
    await sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('routing_config', ${JSON.stringify(config)}, NOW())
      ON CONFLICT (key) 
      DO UPDATE SET value = ${JSON.stringify(config)}, updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving routing config:", error);
    return NextResponse.json(
      { error: "Erro ao salvar configuracao" },
      { status: 500 }
    );
  }
}
