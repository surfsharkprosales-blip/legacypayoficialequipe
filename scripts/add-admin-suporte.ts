/**
 * Script para adicionar usuario admin de suporte
 * 
 * Email: suporte@123.com
 * Senha: Padrão123
 * Role: ceo (acesso total)
 * 
 * Executar com: npx tsx scripts/add-admin-suporte.ts
 */

import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

async function addAdminSupporte() {
  console.log("[Admin] Adicionando usuario admin de suporte...");

  const email = "suporte@123.com";
  const password = "Padrão123";
  const name = "Suporte Admin";
  const role = "ceo";

  try {
    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Verificar se o usuario ja existe em profiles
    const existingProfile = await sql`
      SELECT id FROM profiles WHERE email = ${email}
    `;

    let userId: string;

    if (existingProfile.length > 0) {
      userId = existingProfile[0].id;
      console.log("[Admin] Usuario ja existe em profiles, atualizando senha...");
      
      await sql`
        UPDATE profiles SET
          password_hash = ${passwordHash},
          is_admin = true,
          is_active = true,
          updated_at = NOW()
        WHERE email = ${email}
      `;
    } else {
      console.log("[Admin] Criando novo usuario em profiles...");
      
      const newProfile = await sql`
        INSERT INTO profiles (
          email,
          name,
          password_hash,
          is_admin,
          is_active,
          kyc_status,
          created_at,
          updated_at
        ) VALUES (
          ${email},
          ${name},
          ${passwordHash},
          true,
          true,
          'approved',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      
      userId = newProfile[0].id;
      console.log("[Admin] Profile criado com ID:", userId);
    }

    // Verificar se ja existe em admin_team
    const existingTeam = await sql`
      SELECT id FROM admin_team WHERE user_id = ${userId}
    `;

    if (existingTeam.length > 0) {
      console.log("[Admin] Usuario ja existe em admin_team, atualizando...");
      
      await sql`
        UPDATE admin_team SET
          role = ${role},
          is_active = true,
          permissions = ${JSON.stringify({
            dashboard: true,
            users: true,
            transactions: true,
            withdrawals: true,
            settings: true,
            team: true,
            logs: true,
            reports: true,
            acquirers: true,
            kyc: true,
            tickets: true,
            financial: true,
            all: true
          })},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    } else {
      console.log("[Admin] Adicionando usuario em admin_team...");
      
      await sql`
        INSERT INTO admin_team (
          user_id,
          role,
          permissions,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${role},
          ${JSON.stringify({
            dashboard: true,
            users: true,
            transactions: true,
            withdrawals: true,
            settings: true,
            team: true,
            logs: true,
            reports: true,
            acquirers: true,
            kyc: true,
            tickets: true,
            financial: true,
            all: true
          })},
          true,
          NOW(),
          NOW()
        )
      `;
    }

    console.log("\n========================================");
    console.log("[Admin] Usuario admin criado com sucesso!");
    console.log("========================================");
    console.log("Email:", email);
    console.log("Senha:", password);
    console.log("Role:", role);
    console.log("Acesso:", "/lp-x7k9m2-internal/login");
    console.log("========================================\n");

  } catch (error) {
    console.error("[Admin] Erro ao adicionar usuario:", error);
    throw error;
  }
}

// Executar
addAdminSupporte()
  .then(() => {
    console.log("[Script] Concluido com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Script] Falhou:", error);
    process.exit(1);
  });
