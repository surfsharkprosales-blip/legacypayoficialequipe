
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    // Create user_rewards table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS user_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        goal_value INTEGER NOT NULL,
        reward_type TEXT NOT NULL,
        delivered_at TIMESTAMPTZ DEFAULT NOW(),
        delivered_by TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id)
    `;

    // Create unique constraint to prevent duplicate rewards
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rewards_unique 
      ON user_rewards(user_id, goal_value)
    `;

    return NextResponse.json({ success: true, message: "Table created successfully" });
  } catch (error: any) {
    console.error("Error creating table:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
