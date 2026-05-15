import { NextResponse } from "next/server";
import { sql } from "@/lib/db";


export async function GET() {
  
  

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Volume total processado (PIX pagos) - status pode ser 'completed' ou 'paid'
    const totalVolume = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_fees,
        COUNT(*) as total_transactions
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit')
    `;

    // Volume este mes
    const thisMonth = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(SUM(fee), 0) as fees,
        COUNT(*) as count
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit') AND created_at >= ${startOfMonth.toISOString()}
    `;

    // Volume mes passado (para comparativo)
    const lastMonth = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(SUM(fee), 0) as fees,
        COUNT(*) as count
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit')
        AND created_at >= ${startOfLastMonth.toISOString()}
        AND created_at <= ${endOfLastMonth.toISOString()}
    `;

    // Volume esta semana
    const thisWeek = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(SUM(fee), 0) as fees,
        COUNT(*) as count
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit') AND created_at >= ${startOfWeek.toISOString()}
    `;

    // Volume hoje
    const today = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(SUM(fee), 0) as fees,
        COUNT(*) as count
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit') AND created_at >= ${startOfDay.toISOString()}
    `;

    // Total de saques
    const withdrawals = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(fee), 0) as total_fees,
        COUNT(*) as count
      FROM withdrawals 
      WHERE status = 'completed'
    `;

    // Saques este mes
    const withdrawalsThisMonth = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as amount,
        COALESCE(SUM(fee), 0) as fees
      FROM withdrawals 
      WHERE status = 'completed' AND created_at >= ${startOfMonth.toISOString()}
    `;

    // Custo com adquirentes (taxas pagas aos gateways)
    // Assumindo que a taxa do acquirer esta no metadata da transacao
    const acquirerCosts = await sql`
      SELECT 
        COALESCE(SUM((metadata->>'acquirer_fee')::numeric), 0) as total_acquirer_fees
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND metadata->>'acquirer_fee' IS NOT NULL
    `;

    const acquirerCostsThisMonth = await sql`
      SELECT 
        COALESCE(SUM((metadata->>'acquirer_fee')::numeric), 0) as acquirer_fees
      FROM transactions 
      WHERE status IN ('completed', 'paid')
        AND metadata->>'acquirer_fee' IS NOT NULL
        AND created_at >= ${startOfMonth.toISOString()}
    `;

    // Volume por dia nos ultimos 30 dias (para grafico)
    const dailyVolume = await sql`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(SUM(fee), 0) as fees,
        COUNT(*) as count
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit') AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Ticket medio
    const avgTicket = await sql`
      SELECT COALESCE(AVG(amount), 0) as avg_ticket
      FROM transactions 
      WHERE status IN ('completed', 'paid') AND type IN ('pix_in', 'deposit') AND created_at >= ${startOfMonth.toISOString()}
    `;

    // Taxa de conversao (PIX gerados vs pagos)
    const conversionRate = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('completed', 'paid')) as paid_count,
        COUNT(*) as total_count
      FROM transactions 
      WHERE type IN ('pix_in', 'deposit') AND created_at >= ${startOfMonth.toISOString()}
    `;

    // Usuarios ativos este mes
    const activeUsers = await sql`
      SELECT COUNT(DISTINCT user_id) as count
      FROM transactions 
      WHERE created_at >= ${startOfMonth.toISOString()}
    `;

    // Novos usuarios este mes
    const newUsers = await sql`
      SELECT COUNT(*) as count
      FROM profiles 
      WHERE created_at >= ${startOfMonth.toISOString()}
    `;

    // Calculos de lucro
    // Receita total = taxas de transacoes PIX + taxas de saques
    const totalFeesCollected = Number(totalVolume[0]?.total_fees || 0) + Number(withdrawals[0]?.total_fees || 0);
    const totalAcquirerCosts = Number(acquirerCosts[0]?.total_acquirer_fees || 0);
    const grossProfit = totalFeesCollected - totalAcquirerCosts;

    const thisMonthFeesCollected = Number(thisMonth[0]?.fees || 0) + Number(withdrawalsThisMonth[0]?.fees || 0);
    const thisMonthAcquirerCosts = Number(acquirerCostsThisMonth[0]?.acquirer_fees || 0);
    const thisMonthProfit = thisMonthFeesCollected - thisMonthAcquirerCosts;

    const lastMonthProfit = Number(lastMonth[0]?.fees || 0) * 0.85; // Estimativa 85% margem (mais realista)

    // Projecao mensal baseada nos dias passados
    const daysPassed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlyProfit = (thisMonthProfit / daysPassed) * daysInMonth;

    // Comparativo mes a mes
    const monthOverMonth = lastMonthProfit > 0 
      ? ((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100 
      : 0;

    // Taxa de conversao
    const paidCount = Number(conversionRate[0]?.paid_count || 0);
    const totalCount = Number(conversionRate[0]?.total_count || 1);
    const conversion = (paidCount / totalCount) * 100;

    return NextResponse.json({
      overview: {
        totalVolume: Number(totalVolume[0]?.total_volume || 0),
        totalFees: totalFeesCollected,
        totalTransactions: Number(totalVolume[0]?.total_transactions || 0),
        grossProfit,
        totalAcquirerCosts,
      },
      thisMonth: {
        volume: Number(thisMonth[0]?.volume || 0),
        fees: thisMonthFeesCollected,
        count: Number(thisMonth[0]?.count || 0),
        profit: thisMonthProfit,
        acquirerCosts: thisMonthAcquirerCosts,
        projectedProfit: projectedMonthlyProfit,
      },
      lastMonth: {
        volume: Number(lastMonth[0]?.volume || 0),
        fees: Number(lastMonth[0]?.fees || 0),
        count: Number(lastMonth[0]?.count || 0),
        profit: lastMonthProfit,
      },
      comparison: {
        monthOverMonth,
        volumeGrowth: Number(lastMonth[0]?.volume || 0) > 0 
          ? ((Number(thisMonth[0]?.volume || 0) - Number(lastMonth[0]?.volume || 0)) / Number(lastMonth[0]?.volume || 0)) * 100 
          : 0,
      },
      today: {
        volume: Number(today[0]?.volume || 0),
        fees: Number(today[0]?.fees || 0),
        count: Number(today[0]?.count || 0),
      },
      thisWeek: {
        volume: Number(thisWeek[0]?.volume || 0),
        fees: Number(thisWeek[0]?.fees || 0),
        count: Number(thisWeek[0]?.count || 0),
      },
      withdrawals: {
        total: Number(withdrawals[0]?.total_amount || 0),
        fees: Number(withdrawals[0]?.total_fees || 0),
        thisMonth: Number(withdrawalsThisMonth[0]?.amount || 0),
        thisMonthFees: Number(withdrawalsThisMonth[0]?.fees || 0),
      },
      metrics: {
        avgTicket: Number(avgTicket[0]?.avg_ticket || 0),
        conversionRate: conversion,
        activeUsers: Number(activeUsers[0]?.count || 0),
        newUsers: Number(newUsers[0]?.count || 0),
      },
      dailyVolume: dailyVolume.map(d => ({
        date: d.date,
        volume: Number(d.volume),
        fees: Number(d.fees),
        count: Number(d.count),
      })),
    });
  } catch (error) {
    console.error("Error fetching financial data:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados financeiros" },
      { status: 500 }
    );
  }
}
