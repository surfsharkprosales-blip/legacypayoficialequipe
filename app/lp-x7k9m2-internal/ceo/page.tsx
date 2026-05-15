"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Wallet,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface Stats {
  totalProcessed: number;
  totalFees: number;
  dailyVolume: number;
  activeUsers: number;
  pendingKyc: number;
  pendingWithdrawals: number;
  approvalRate: number;
  completedTransactions: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  payer_name: string | null;
}

export default function CEODashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProcessed: 0,
    totalFees: 0,
    dailyVolume: 0,
    activeUsers: 0,
    pendingKyc: 0,
    pendingWithdrawals: 0,
    approvalRate: 0,
    completedTransactions: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      
      // Tentar buscar stats (sem redirecionar se falhar)
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          if (data.stats) {
            setStats({
              totalProcessed: Number(data.stats.totalVolumeRaw) || 0,
              totalFees: Number(data.stats.totalFeesRaw) || 0,
              dailyVolume: 0,
              activeUsers: Number(data.stats.totalUsers) || 0,
              pendingKyc: 0,
              pendingWithdrawals: 0,
              approvalRate: 0,
              completedTransactions: Number(data.stats.completedTransactions) || 0,
            });
          }
        }
      } catch (e) {
        console.log("Stats API error:", e);
      }

      // Tentar buscar transacoes (sem redirecionar se falhar)
      try {
        const txResponse = await fetch("/api/admin/transactions");
        if (txResponse.ok) {
          const txData = await txResponse.json();
          if (txData.transactions && Array.isArray(txData.transactions)) {
            setRecentTransactions(txData.transactions);
          }
        }
      } catch (e) {
        console.log("Transactions API error:", e);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statCards = [
    {
      label: "Volume Total",
      value: formatCurrency(stats.totalProcessed),
      icon: Wallet,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      description: "Total de transações aprovadas",
    },
    {
      label: "Taxas Arrecadadas",
      value: formatCurrency(stats.totalFees),
      icon: DollarSign,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
      description: "Receita total em taxas",
    },
    {
      label: "Usuários Cadastrados",
      value: stats.activeUsers.toString(),
      icon: Users,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      description: "Total de usuários",
    },
    {
      label: "Transações Aprovadas",
      value: stats.completedTransactions.toString(),
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      description: "Transações concluídas",
    },
  ];

  const pendingCards = [
    {
      label: "KYC Pendentes",
      value: stats.pendingKyc,
      icon: Clock,
      href: "/lp-x7k9m2-internal/ceo/kyc",
    },
    {
      label: "Saques Pendentes",
      value: stats.pendingWithdrawals,
      icon: Wallet,
      href: "/lp-x7k9m2-internal/ceo/withdrawals",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-secondary rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-secondary rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard CEO</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema LegacyPay
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-card border border-border rounded-lg p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-2xl font-bold mb-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-sm font-medium text-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </div>
              <div className={`p-2.5 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pending Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingCards.map((card, index) => (
          <motion.a
            key={card.label}
            href={card.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="bg-card border border-border rounded-lg p-5 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/15">
                <card.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.a>
        ))}
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-card border border-border rounded-lg overflow-hidden"
      >
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Transacoes Recentes
          </h2>
        </div>
        <div className="divide-y divide-border">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma transação encontrada
            </div>
          ) : (
            recentTransactions.map((transaction) => {
              const isDeposit = transaction.type === "deposit" || transaction.type === "pix_in" || transaction.type === "transfer_in";
              const userName = transaction.user_name || transaction.payer_name || "Usuário";
              const userEmail = transaction.user_email || "";
              const typeLabel = transaction.type === "pix_in" ? "PIX In" 
                : transaction.type === "deposit" ? "Depósito"
                : transaction.type === "withdrawal" ? "Saque"
                : transaction.type === "pix_out" ? "PIX Out"
                : transaction.type === "transfer_in" ? "Recebimento"
                : "Transferência";
              
              return (
                <div
                  key={transaction.id}
                  className="p-4 flex items-center justify-between hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        isDeposit ? "bg-green-400/10" : "bg-red-400/10"
                      }`}
                    >
                      {isDeposit ? (
                        <ArrowDownRight className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{userName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{userEmail}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                          {typeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        isDeposit ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isDeposit ? "+" : "-"}
                      {formatCurrency(Number(transaction.amount))}
                    </p>
                    {transaction.fee > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Taxa: {formatCurrency(Number(transaction.fee))}
                      </p>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        transaction.status === "completed"
                          ? "bg-green-400/10 text-green-400"
                          : transaction.status === "pending"
                          ? "bg-yellow-400/10 text-yellow-400"
                          : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {transaction.status === "completed"
                        ? "Concluído"
                        : transaction.status === "pending"
                        ? "Pendente"
                        : "Falhou"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
