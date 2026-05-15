
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ canManageTeam: false })
    }

    const result = await sql`
      SELECT can_manage_team FROM team_members WHERE email = ${email}
    `

    if (result.length === 0) {
      return NextResponse.json({ canManageTeam: false })
    }

    return NextResponse.json({ 
      canManageTeam: result[0].can_manage_team || false 
    })
  } catch (error) {
    console.error('Error checking permission:', error)
    return NextResponse.json({ canManageTeam: false })
  }
}
