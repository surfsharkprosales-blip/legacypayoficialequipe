
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Listar membros da equipe
export async function GET() {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const result = await sql`
      SELECT id, name, email, role, permissions, is_active, last_login, created_at
      FROM team_members
      ORDER BY 
        CASE role 
          WHEN 'ceo' THEN 1 
          WHEN 'manager' THEN 2 
          WHEN 'finance' THEN 3 
          WHEN 'support' THEN 4 
        END,
        created_at DESC
    `
    return NextResponse.json({ members: result || [] })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  }
}

// Criar novo membro da equipe
export async function POST(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const body = await request.json()
    const { name, email, password, role, permissions, requestedBy } = body

    // Verificar se quem está criando tem permissão (can_manage_team = true)
    if (requestedBy) {
      const requester = await sql`
        SELECT can_manage_team FROM team_members WHERE id = ${requestedBy} OR email = ${requestedBy}
      `
      if (requester.length === 0 || !requester[0].can_manage_team) {
        return NextResponse.json(
          { error: 'Você não tem permissão para adicionar membros à equipe' },
          { status: 403 }
        )
      }
    } else {
      // Se não informou quem está criando, verificar via header ou rejeitar
      return NextResponse.json(
        { error: 'Identificação do solicitante é obrigatória' },
        { status: 403 }
      )
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se email já existe
    const existing = await sql`
      SELECT id FROM team_members WHERE email = ${email}
    `
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10)

    // Definir permissões padrão baseadas no role
    const defaultPermissions = getDefaultPermissions(role || 'support')
    const finalPermissions = permissions || defaultPermissions

    // Criar membro (sempre ativo por padrão)
    const result = await sql`
      INSERT INTO team_members (name, email, password_hash, role, permissions, is_active)
      VALUES (${name}, ${email}, ${passwordHash}, ${role || 'support'}, ${JSON.stringify(finalPermissions)}, true)
      RETURNING id, name, email, role, permissions, is_active, created_at
    `

    // Registrar log
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, created_at)
      VALUES (${null}, 'TEAM_MEMBER_CREATED', 'team_member', ${result[0].id}, ${JSON.stringify({ name, email, role })}, NOW())
    `

    return NextResponse.json({ success: true, member: result[0] })
  } catch (error) {
    console.error('Error creating team member:', error)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}

// Atualizar membro da equipe
export async function PUT(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const body = await request.json()
    const { id, name, email, password, role, permissions, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    // Se tiver nova senha, fazer hash
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      await sql`
        UPDATE team_members 
        SET 
          name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          password_hash = ${passwordHash},
          role = COALESCE(${role}, role),
          permissions = COALESCE(${permissions ? JSON.stringify(permissions) : null}, permissions),
          is_active = COALESCE(${is_active}, is_active),
          updated_at = NOW()
        WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE team_members 
        SET 
          name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          role = COALESCE(${role}, role),
          permissions = COALESCE(${permissions ? JSON.stringify(permissions) : null}, permissions),
          is_active = COALESCE(${is_active}, is_active),
          updated_at = NOW()
        WHERE id = ${id}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating team member:', error)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}

// Deletar membro da equipe
export async function DELETE(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    await sql`DELETE FROM team_members WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting team member:', error)
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
  }
}

// Permissões padrão por role
function getDefaultPermissions(role: string) {
  switch (role) {
    case 'ceo':
      return {
        view_users: true,
        edit_users: true,
        view_transactions: true,
        manage_transactions: true,
        view_withdrawals: true,
        manage_withdrawals: true,
        view_kyc: true,
        manage_kyc: true,
        view_settings: true,
        manage_settings: true,
        view_team: true,
        manage_team: true,
        view_logs: true,
        view_reports: true,
      }
    case 'manager':
      return {
        view_users: true,
        edit_users: true,
        view_transactions: true,
        manage_transactions: true,
        view_withdrawals: true,
        manage_withdrawals: true,
        view_kyc: true,
        manage_kyc: true,
        view_settings: false,
        manage_settings: false,
        view_team: true,
        manage_team: false,
        view_logs: true,
        view_reports: true,
      }
    case 'finance':
      return {
        view_users: true,
        edit_users: false,
        view_transactions: true,
        manage_transactions: true,
        view_withdrawals: true,
        manage_withdrawals: true,
        view_kyc: false,
        manage_kyc: false,
        view_settings: false,
        manage_settings: false,
        view_team: false,
        manage_team: false,
        view_logs: true,
        view_reports: true,
      }
    case 'support':
    default:
      return {
        view_users: true,
        edit_users: false,
        view_transactions: true,
        manage_transactions: false,
        view_withdrawals: true,
        manage_withdrawals: false,
        view_kyc: true,
        manage_kyc: false,
        view_settings: false,
        manage_settings: false,
        view_team: false,
        manage_team: false,
        view_logs: false,
        view_reports: false,
      }
  }
}
