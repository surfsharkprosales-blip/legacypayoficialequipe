
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// POST /api/admin/run-migration - Executa migracoes pendentes
export async function POST(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    
    
    const { migration } = await request.json();
    
    if (migration === "acquirer-limits") {
      // Adicionar colunas max_withdrawal e daily_limit na tabela acquirers
      await sql`ALTER TABLE acquirers ADD COLUMN IF NOT EXISTS max_withdrawal DECIMAL(12, 2) DEFAULT 10000`;
      await sql`ALTER TABLE acquirers ADD COLUMN IF NOT EXISTS daily_limit DECIMAL(12, 2) DEFAULT 10000`;
      
      // Atualizar valores padrão para adquirentes existentes
      await sql`UPDATE acquirers SET max_withdrawal = 10000 WHERE max_withdrawal IS NULL`;
      await sql`UPDATE acquirers SET daily_limit = 10000 WHERE daily_limit IS NULL`;
      
      const acquirers = await sql`SELECT name, code, max_withdrawal, daily_limit FROM acquirers`;
      
      return NextResponse.json({
        success: true,
        message: "Colunas de limites adicionadas com sucesso",
        acquirers: acquirers.map(a => ({
          name: a.name,
          code: a.code,
          max_withdrawal: Number(a.max_withdrawal),
          daily_limit: Number(a.daily_limit)
        }))
      });
    }

    if (migration === "withdrawal-fee") {
      // 1. Adicionar coluna withdrawal_fee na tabela profiles (se não existir)
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_fee DECIMAL(10, 2) DEFAULT NULL`;
      
      // 2. Atualizar taxa de saque da MisticPay (rota white) para R$ 2,00
      await sql`UPDATE acquirers SET withdrawal_fee = 2.00 WHERE code = 'misticpay'`;
      
      // 3. Atualizar taxa de saque da Medusa (rota black) para R$ 5,00
      await sql`UPDATE acquirers SET withdrawal_fee = 5.00 WHERE code = 'medusa'`;
      
      // 4. Verificar adquirentes atualizadas
      const acquirers = await sql`SELECT name, code, withdrawal_fee FROM acquirers`;
      
      return NextResponse.json({
        success: true,
        message: "Migração de taxa de saque executada com sucesso",
        acquirers: acquirers.map(a => ({
          name: a.name,
          code: a.code,
          withdrawal_fee: Number(a.withdrawal_fee)
        }))
      });
    }

    if (migration === "fixed-fee") {
      // 1. Adicionar coluna fixed_fee na tabela profiles (se não existir)
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fixed_fee DECIMAL(10, 2) DEFAULT NULL`;
      
      return NextResponse.json({
        success: true,
        message: "Coluna fixed_fee adicionada com sucesso na tabela profiles"
      });
    }

    if (migration === "all-fees") {
      // Executar todas as migrações de taxas
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_fee DECIMAL(10, 2) DEFAULT NULL`;
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fixed_fee DECIMAL(10, 2) DEFAULT NULL`;
      
      await sql`UPDATE acquirers SET withdrawal_fee = 2.00 WHERE code = 'misticpay'`;
      await sql`UPDATE acquirers SET withdrawal_fee = 5.00 WHERE code = 'medusa'`;
      
      const acquirers = await sql`SELECT name, code, withdrawal_fee FROM acquirers`;
      
      return NextResponse.json({
        success: true,
        message: "Todas as migrações de taxas executadas com sucesso",
        acquirers: acquirers.map(a => ({
          name: a.name,
          code: a.code,
          withdrawal_fee: Number(a.withdrawal_fee)
        }))
      });
    }
    
    if (migration === "add-venopag") {
      // Primeiro garantir que as colunas de limite existem
      await sql`ALTER TABLE acquirers ADD COLUMN IF NOT EXISTS max_withdrawal DECIMAL(12, 2) DEFAULT 10000`;
      await sql`ALTER TABLE acquirers ADD COLUMN IF NOT EXISTS daily_limit DECIMAL(12, 2) DEFAULT 10000`;
      
      // Verificar se ja existe
      const existing = await sql`SELECT id FROM acquirers WHERE code = 'venopag'`;
      
      if (existing.length > 0) {
        // Atualizar
        await sql`
          UPDATE acquirers SET
            name = 'Venopag',
            api_url = 'https://venopag.com',
            api_key = 'np_56f1e77f0183e5f933312005',
            api_secret = 'npsec_238d95c8e8b5463b229652f7468bc138b91f0b82644211fd',
            is_active = true,
            fee_percentage = 3.0,
            withdrawal_fee = 4.0,
            min_deposit = 1.00,
            min_withdrawal = 10.00,
            max_withdrawal = 10000.00,
            daily_limit = 10000.00,
            route_type = 'white',
            health_status = 'online',
            updated_at = NOW()
          WHERE code = 'venopag'
        `;
        
        return NextResponse.json({
          success: true,
          message: "Venopag atualizada com sucesso! Taxa deposito: 3%, Taxa saque: 4%, Limite diario: R$10.000, Limite por saque: R$10.000"
        });
      }
      
      // Criar nova
      const maxP = await sql`SELECT COALESCE(MAX(priority), 0) as mp FROM acquirers`;
      const nextPriority = (maxP[0]?.mp || 0) + 1;
      
      await sql`
        INSERT INTO acquirers (id, name, code, api_url, api_key, api_secret, is_active, priority, fee_percentage, withdrawal_fee, min_deposit, min_withdrawal, max_withdrawal, daily_limit, route_type, health_status, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          'Venopag',
          'venopag',
          'https://venopag.com',
          'np_56f1e77f0183e5f933312005',
          'npsec_238d95c8e8b5463b229652f7468bc138b91f0b82644211fd',
          true,
          ${nextPriority},
          3.0,
          4.0,
          1.00,
          10.00,
          10000.00,
          10000.00,
          'white',
          'online',
          NOW(),
          NOW()
        )
      `;
      
      const acquirers = await sql`SELECT name, code, route_type, fee_percentage, withdrawal_fee, max_withdrawal, daily_limit, is_active FROM acquirers ORDER BY priority`;
      
      return NextResponse.json({
        success: true,
        message: "Venopag adicionada com sucesso! Taxa deposito: 3%, Taxa saque: 4%, Limite diario: R$10.000, Limite por saque: R$10.000",
        acquirers
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: "Migração não reconhecida",
      available: ["acquirer-limits", "withdrawal-fee", "fixed-fee", "all-fees", "add-venopag"]
    }, { status: 400 });
    
  } catch (error) {
    console.error("[Admin Migration] Erro:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erro ao executar migração" },
      { status: 500 }
    );
  }
}
