
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const acquirers = await sql`
      SELECT * FROM acquirers ORDER BY priority ASC
    `;

    return NextResponse.json({ acquirers });
  } catch (error) {
    console.error("[v0] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, action, data } = body;

    if (action === "toggle") {
      const acquirerResult = await sql`
        SELECT is_active FROM acquirers WHERE id = ${id}
      `;

      const isActive = acquirerResult[0]?.is_active;

      await sql`
        UPDATE acquirers SET is_active = ${!isActive}, updated_at = NOW() WHERE id = ${id}
      `;

      return NextResponse.json({ success: true });
    }

    if (action === "update") {
      await sql`
        UPDATE acquirers 
        SET name = COALESCE(${data.name}, name),
            api_url = COALESCE(${data.api_url}, api_url),
            api_key = COALESCE(${data.api_key}, api_key),
            api_secret = COALESCE(${data.api_secret}, api_secret),
            fee_percentage = COALESCE(${data.fee_percentage}, fee_percentage),
            fixed_fee = COALESCE(${data.fixed_fee}, fixed_fee),
            fee_is_percentage = COALESCE(${data.fee_is_percentage}, fee_is_percentage),
            withdrawal_fee = COALESCE(${data.withdrawal_fee}, withdrawal_fee),
            withdrawal_fee_is_percentage = COALESCE(${data.withdrawal_fee_is_percentage}, withdrawal_fee_is_percentage),
            min_deposit = COALESCE(${data.min_deposit}, min_deposit),
            min_withdrawal = COALESCE(${data.min_withdrawal}, min_withdrawal),
            max_withdrawal = COALESCE(${data.max_withdrawal}, max_withdrawal),
            daily_limit = COALESCE(${data.daily_limit}, daily_limit),
            route_type = COALESCE(${data.route_type}, route_type),
            updated_at = NOW()
        WHERE id = ${id}
      `;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("[v0] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = crypto.randomUUID();

    // Gerar código a partir do nome se não fornecido
    const code = body.code || body.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    const result = await sql`
      INSERT INTO acquirers (id, name, code, api_url, api_key, api_secret, fee_percentage, fixed_fee, fee_is_percentage, withdrawal_fee, withdrawal_fee_is_percentage, min_deposit, min_withdrawal, max_withdrawal, daily_limit, route_type, is_active, created_at, updated_at)
      VALUES (
        ${id},
        ${body.name},
        ${code},
        ${body.api_url},
        ${body.api_key},
        ${body.api_secret},
        ${body.fee_percentage || 0},
        ${body.fixed_fee || 0},
        ${body.fee_is_percentage ?? true},
        ${body.withdrawal_fee || 0},
        ${body.withdrawal_fee_is_percentage ?? false},
        ${body.min_deposit || 1},
        ${body.min_withdrawal || 10},
        ${body.max_withdrawal || 10000},
        ${body.daily_limit || 10000},
        ${body.route_type || 'white'},
        ${body.is_active ?? true},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    // Log de auditoria
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, new_value)
      VALUES ('CREATE_ACQUIRER', 'acquirer', ${id}, ${JSON.stringify({ name: body.name, code })})
    `;

    return NextResponse.json({ success: true, acquirer: result[0] });
  } catch (error) {
    console.error("[v0] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    // Buscar adquirente antes de deletar para log
    const acquirerResult = await sql`SELECT * FROM acquirers WHERE id = ${id}`;
    const acquirer = acquirerResult[0];

    if (!acquirer) {
      return NextResponse.json({ error: "Adquirente não encontrado" }, { status: 404 });
    }

    await sql`DELETE FROM acquirers WHERE id = ${id}`;

    // Log de auditoria
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, old_value)
      VALUES ('DELETE_ACQUIRER', 'acquirer', ${id}, ${JSON.stringify({ name: acquirer.name, code: acquirer.code })})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
