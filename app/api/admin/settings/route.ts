
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    // Verificar se e admin
    
    
    const result = await sql`
      SELECT key, value FROM system_settings
    `
    
    const settings: Record<string, string> = {}
    result.forEach((row: { key: string; value: string }) => {
      settings[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
    })
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar se e admin
    
    
    const body = await request.json()
    const { settings } = body

    for (const [key, value] of Object.entries(settings)) {
      const description = getSettingDescription(key)
      await sql`
        INSERT INTO system_settings (key, value, description, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}, ${description}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    // Taxas PIX In (Deposito)
    pix_percentage_fee: "Taxa percentual PIX In - Rota Black",
    pix_fixed_fee: "Taxa fixa PIX In - Rota Black",
    white_pix_percentage_fee: "Taxa percentual PIX In - Rota White",
    white_pix_fixed_fee: "Taxa fixa PIX In - Rota White",
    // Taxas PIX Out (Saque)
    withdrawal_fee: "Taxa padrao de saque",
    withdrawal_fee_white: "Taxa de saque - Rota White",
    withdrawal_fee_black: "Taxa de saque - Rota Black",
    // Limites
    min_deposit: "Valor minimo para deposito",
    max_deposit: "Valor maximo para deposito por transacao",
    min_withdrawal: "Valor minimo para saque",
    max_withdrawal: "Valor maximo para saque por transacao",
    daily_withdrawal_limit: "Limite diario de saque",
    auto_withdraw_limit: "Saques ate este valor sao automaticos",
  }
  return descriptions[key] || ""
}
