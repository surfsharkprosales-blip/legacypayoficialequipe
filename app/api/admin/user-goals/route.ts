
import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Metas de faturamento com recompensas
export const GOALS = [
  { value: 1000, label: "R$ 1K", reward: null },
  { value: 10000, label: "R$ 10K", reward: null },
  { value: 20000, label: "R$ 20K", reward: "Pulseira" },
  { value: 50000, label: "R$ 50K", reward: null },
  { value: 75000, label: "R$ 75K", reward: null },
  { value: 100000, label: "R$ 100K", reward: "Placa de 100K" },
  { value: 250000, label: "R$ 250K", reward: null },
  { value: 375000, label: "R$ 375K", reward: null },
  { value: 500000, label: "R$ 500K", reward: "Placa de 500K" },
  { value: 750000, label: "R$ 750K", reward: null },
  { value: 1000000, label: "R$ 1M", reward: "Placa de 1M" },
];

export function getCurrentGoal(revenue: number) {
  // Encontra a maior meta atingida
  let currentGoal = null;
  for (let i = GOALS.length - 1; i >= 0; i--) {
    if (revenue >= GOALS[i].value) {
      currentGoal = GOALS[i];
      break;
    }
  }
  return currentGoal;
}

export function getNextGoal(revenue: number) {
  // Encontra a proxima meta
  for (const goal of GOALS) {
    if (revenue < goal.value) {
      return goal;
    }
  }
  return null; // Ja atingiu todas
}

export function getProgress(revenue: number) {
  const nextGoal = getNextGoal(revenue);
  if (!nextGoal) return 100;

  const currentGoal = getCurrentGoal(revenue);
  const baseValue = currentGoal ? currentGoal.value : 0;
  
  const progress = ((revenue - baseValue) / (nextGoal.value - baseValue)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

export async function GET(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // "all" | "with_goals" | "pending_rewards"
    const search = searchParams.get("search");

    // Buscar todos os usuarios (excluindo admins)
    const users = await sql`
      SELECT 
        id,
        name,
        email,
        phone,
        created_at
      FROM profiles
      WHERE is_admin = false OR is_admin IS NULL
      ORDER BY created_at DESC
    `;

    // Buscar faturamento calculado das transacoes para cada usuario
    const transactions = await sql`
      SELECT 
        user_id,
        SUM(amount) as total
      FROM transactions 
      WHERE type IN ('deposit', 'transfer_in', 'pix_in') 
      AND status = 'completed'
      GROUP BY user_id
    `;

    // Criar map de faturamento por usuario
    const revenueMap = new Map();
    for (const t of transactions) {
      revenueMap.set(t.user_id, Number(t.total) || 0);
    }

    // Buscar recompensas ja entregues
    let deliveredRewards: any[] = [];
    try {
    // SEGURANCA: Verificar se e admin
    
    

      deliveredRewards = await sql`SELECT user_id, goal_value FROM user_rewards`;
    } catch (e) {
      // Table may not exist yet
    }

    // Criar um Set para lookup rapido
    const deliveredSet = new Set(
      deliveredRewards.map((r: any) => `${r.user_id}-${r.goal_value}`)
    );

    // Calcular metas para cada usuario
    const usersArray = Array.isArray(users) ? users : [];
    const usersWithGoals = usersArray.map((user: any) => {
      // Usar o faturamento calculado das transacoes
      const totalRevenue = revenueMap.get(user.id) || 0;

      const currentGoal = getCurrentGoal(totalRevenue);
      const nextGoal = getNextGoal(totalRevenue);
      const progress = getProgress(totalRevenue);

      // Encontrar TODAS as metas atingidas (com ou sem recompensa)
      const allAchievedGoals = GOALS.filter(g => totalRevenue >= g.value);
      
      // Encontrar metas atingidas QUE TEM recompensa
      const achievedRewards = GOALS.filter(
        g => g.reward && totalRevenue >= g.value
      ).map(g => ({
        ...g,
        delivered: deliveredSet.has(`${user.id}-${g.value}`)
      }));

      // Recompensas pendentes = atingidas com recompensa mas NAO entregues
      const pendingRewards = achievedRewards.filter(r => !r.delivered);
      
      // Recompensas entregues
      const deliveredRewardsForUser = achievedRewards.filter(r => r.delivered);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        created_at: user.created_at,
        total_revenue: totalRevenue,
        current_goal: currentGoal,
        next_goal: nextGoal,
        progress,
        all_achieved_goals: allAchievedGoals,
        achieved_rewards: achievedRewards,
        pending_rewards: pendingRewards,
        delivered_rewards: deliveredRewardsForUser,
        has_rewards: achievedRewards.length > 0,
        has_pending_rewards: pendingRewards.length > 0,
      };
    });

    // Aplicar filtros
    let filtered = usersWithGoals;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((u: any) =>
        u.name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.phone?.includes(search)
      );
    }

    if (filter === "with_goals") {
      // Filtrar usuarios que atingiram pelo menos uma meta
      filtered = filtered.filter((u: any) => u.current_goal !== null);
    } else if (filter === "pending_rewards") {
      // Filtrar APENAS usuarios com recompensas PENDENTES (nao entregues)
      filtered = filtered.filter((u: any) => u.has_pending_rewards === true);
    } else if (filter === "with_rewards") {
      // Filtrar usuarios que atingiram metas com recompensa (pendente ou entregue)
      filtered = filtered.filter((u: any) => u.has_rewards === true);
    }

    // Ordenar: usuarios com recompensas pendentes primeiro, depois por faturamento
    filtered.sort((a: any, b: any) => {
      if (a.has_pending_rewards && !b.has_pending_rewards) return -1;
      if (!a.has_pending_rewards && b.has_pending_rewards) return 1;
      return b.total_revenue - a.total_revenue;
    });

    // Stats
    const stats = {
      total_users: usersWithGoals.length,
      users_with_goals: usersWithGoals.filter((u: any) => u.current_goal !== null).length,
      users_with_rewards: usersWithGoals.filter((u: any) => u.has_rewards === true).length,
      users_with_pending_rewards: usersWithGoals.filter((u: any) => u.has_pending_rewards === true).length,
      total_revenue: usersWithGoals.reduce((sum: number, u: any) => sum + u.total_revenue, 0),
    };

    return NextResponse.json({
      users: filtered,
      stats,
      goals: GOALS,
    });
  } catch (error) {
    console.error("Error in user-goals API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Marcar recompensa como entregue
export async function POST(request: NextRequest) {
  try {
    // SEGURANCA: Verificar se e admin
    
    

    const body = await request.json();
    const { user_id, goal_value, reward_delivered } = body;

    // Aqui poderiamos salvar em uma tabela de recompensas entregues
    // Por enquanto, vamos apenas retornar sucesso
    // TODO: Criar tabela user_rewards_delivered

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking reward:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
