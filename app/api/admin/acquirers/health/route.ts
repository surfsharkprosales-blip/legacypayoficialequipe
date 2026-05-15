import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";


export async function POST(request: NextRequest) {
  
  

  try {
    const { acquirerId } = await request.json();

    // Buscar adquirente
    const acquirer = await sql`
      SELECT * FROM acquirers WHERE id = ${acquirerId}
    `;

    if (acquirer.length === 0) {
      return NextResponse.json({ error: "Adquirente nao encontrado" }, { status: 404 });
    }

    const acq = acquirer[0];
    let healthStatus: "online" | "degraded" | "offline" = "offline";
    let responseTime = 0;

    try {
      const startTime = Date.now();
      
      // Fazer requisicao de teste para a API do adquirente
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const response = await fetch(acq.api_url, {
        method: "HEAD",
        signal: controller.signal,
      }).catch(() => null);
      
      clearTimeout(timeout);
      responseTime = Date.now() - startTime;

      if (response && response.ok) {
        healthStatus = responseTime < 1000 ? "online" : "degraded";
      } else if (response) {
        healthStatus = "degraded";
      }
    } catch {
      healthStatus = "offline";
    }

    // Atualizar status no banco
    await sql`
      UPDATE acquirers 
      SET 
        health_status = ${healthStatus},
        last_health_check = NOW(),
        avg_response_time = ${responseTime}
      WHERE id = ${acquirerId}
    `;

    return NextResponse.json({
      success: true,
      health_status: healthStatus,
      response_time: responseTime,
    });
  } catch (error) {
    console.error("Error checking health:", error);
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    );
  }
}

// GET para verificar todos os adquirentes
export async function GET() {
  
  

  try {
    const acquirers = await sql`
      SELECT id, name, api_url FROM acquirers WHERE is_active = true
    `;

    const results = [];

    for (const acq of acquirers) {
      let healthStatus: "online" | "degraded" | "offline" = "offline";
      let responseTime = 0;

      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(acq.api_url, {
          method: "HEAD",
          signal: controller.signal,
        }).catch(() => null);
        
        clearTimeout(timeout);
        responseTime = Date.now() - startTime;

        if (response && response.ok) {
          healthStatus = responseTime < 1000 ? "online" : "degraded";
        } else if (response) {
          healthStatus = "degraded";
        }
      } catch {
        healthStatus = "offline";
      }

      await sql`
        UPDATE acquirers 
        SET 
          health_status = ${healthStatus},
          last_health_check = NOW(),
          avg_response_time = ${responseTime}
        WHERE id = ${acq.id}
      `;

      results.push({
        id: acq.id,
        name: acq.name,
        health_status: healthStatus,
        response_time: responseTime,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Error checking all health:", error);
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    );
  }
}
