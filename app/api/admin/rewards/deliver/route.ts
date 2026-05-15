
import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const body = await request.json();
    const { user_id, goal_value, reward_type, notes } = body;

    if (!user_id || !goal_value || !reward_type) {
      return NextResponse.json(
        { error: "user_id, goal_value and reward_type are required" },
        { status: 400 }
      );
    }

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS user_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        goal_value INTEGER NOT NULL,
        reward_type TEXT NOT NULL,
        delivered_at TIMESTAMPTZ DEFAULT NOW(),
        delivered_by TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, goal_value)
      )
    `;

    // Check if reward already delivered
    const existing = await sql`
      SELECT id FROM user_rewards 
      WHERE user_id = ${user_id} AND goal_value = ${goal_value}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Essa recompensa ja foi marcada como entregue" },
        { status: 400 }
      );
    }

    // Insert reward delivery record
    const result = await sql`
      INSERT INTO user_rewards (user_id, goal_value, reward_type, delivered_by, notes)
      VALUES (${user_id}, ${goal_value}, ${reward_type}, ${"admin"}, ${notes || null})
      RETURNING *
    `;

    return NextResponse.json({ 
      success: true, 
      reward: result[0],
      message: `${reward_type} marcada como entregue!`
    });
  } catch (error: any) {
    console.error("Error delivering reward:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET delivered rewards for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  try {
    // SEGURANCA: Verificar se e admin
    
    

    if (userId) {
      const rewards = await sql`
        SELECT * FROM user_rewards WHERE user_id = ${userId}
        ORDER BY delivered_at DESC
      `;
      return NextResponse.json(rewards);
    }

    // Return all delivered rewards
    const rewards = await sql`
      SELECT ur.*, p.name, p.email 
      FROM user_rewards ur
      JOIN profiles p ON ur.user_id = p.id
      ORDER BY ur.delivered_at DESC
    `;
    return NextResponse.json(rewards);
  } catch (error: any) {
    console.error("Error fetching rewards:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
