"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Users,
  Wallet,
  DollarSign,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Shield,
  Settings,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  Home,
  CreditCard,
  UserCheck,
  Banknote,
  Percent,
  Ticket,
  Activity,
  Database,
  Globe,
  Send,
  MessageSquare,
  Gift,
  BarChart3,
  Building,
  Users2,
  Zap,
} from "lucide-react";

const menuItems = [
  { icon: Home, label: "Dashboard", href: "/lp-x7k9m2-internal", active: true },
  { icon: Users, label: "Usuarios", href: "/lp-x7k9m2-internal/ceo/users" },
  { icon: Users2, label: "Equipe", href: "/lp-x7k9m2-internal/ceo/team" },
  { icon: UserCheck, label: "KYC", href: "/lp-x7k9m2-internal/ceo/kyc" },
  { icon: CreditCard, label: "Transacoes", href: "/lp-x7k9m2-internal/ceo/transactions" },
  { icon: Banknote, label: "Saques", href: "/lp-x7k9m2-internal/ceo/withdrawals" },
  { icon: Percent, label: "Taxas", href: "/lp-x7k9m2-internal/ceo/fees" },
  { icon: Ticket, label: "Tickets", href: "/lp-x7k9m2-internal/ceo/tickets" },
  { icon: Activity, label: "Logs", href: "/lp-x7k9m2-internal/ceo/logs" },
  { icon: Database, label: "Backup", href: "/lp-x7k9m2-internal/ceo/backup" },
  { icon: Globe, label: "Webhooks", href: "/lp-x7k9m2-internal/ceo/webhooks" },
  { icon: Bell, label: "Notificacoes", href: "/lp-x7k9m2-internal/ceo/notifications" },
  { icon: Send, label: "Push", href: "/lp-x7k9m2-internal/ceo/push" },
  { icon: MessageSquare, label: "Telegram", href: "/lp-x7k9m2-internal/ceo/telegram" },
  { icon: Gift, label: "Recompensas", href: "/lp-x7k9m2-internal/ceo/rewards" },
  { icon: BarChart3, label: "Relatorios", href: "/lp-x7k9m2-internal/ceo/reports" },
  { icon: Building, label: "Adquirentes", href: "/lp-x7k9m2-internal/ceo/acquirers" },
  { icon: Zap, label: "Afiliados", href: "/lp-x7k9m2-internal/ceo/affiliates" },
  { icon: Shield, label: "Ataques", href: "/lp-x7k9m2-internal/ceo/attacks" },
  { icon: DollarSign, label: "Financeiro", href: "/lp-x7k9m2-internal/ceo/financial" },
  { icon: Settings, label: "Configuracoes", href: "/lp-x7k9m2-internal/ceo/settings" },
];

const statsCards = [
  {
    title: "Volume Total",
    value: "R$ 0,00",
    change: "+0%",
    positive: true,
    icon: DollarSign,
  },
  {
    title: "Taxas Coletadas",
    value: "R$ 0,00",
    change: "+0%",
    positive: true,
    icon: TrendingUp,
  },
  {
    title: "Usuarios Ativos",
    value: "0",
    change: "+0",
    positive: true,
    icon: Users,
  },
  {
    title: "Transacoes Hoje",
    value: "0",
    change: "+0%",
    positive: true,
    icon: CreditCard,
  },
];

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Image src="/logo-icon.png" alt="Logo" width={24} height={24} />
              </div>
              <div>
                <span className="font-bold text-white">Legacy</span>
                <span className="font-bold text-primary">Pay</span>
                <p className="text-xs text-muted-foreground">Painel Admin</p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Admin CEO</p>
                <p className="text-xs text-muted-foreground">Acesso Total</p>
              </div>
              <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-white transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Visao geral do sistema
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  {stat.positive ? (
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${
                      stat.positive ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-muted-foreground">vs ontem</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Transacoes Recentes</h3>
                <Link
                  href="/lp-x7k9m2-internal/ceo/transactions"
                  className="text-sm text-primary hover:underline"
                >
                  Ver todas
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <div className="text-center">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma transacao encontrada</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Acoes Pendentes</h3>
              </div>
              <div className="space-y-3">
                <Link
                  href="/lp-x7k9m2-internal/ceo/kyc"
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">KYC Pendentes</p>
                      <p className="text-xs text-muted-foreground">0 solicitacoes</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </Link>

                <Link
                  href="/lp-x7k9m2-internal/ceo/withdrawals"
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Banknote className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Saques Pendentes</p>
                      <p className="text-xs text-muted-foreground">0 solicitacoes</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </Link>

                <Link
                  href="/lp-x7k9m2-internal/ceo/tickets"
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Ticket className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Tickets Abertos</p>
                      <p className="text-xs text-muted-foreground">0 tickets</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-white mb-4">Status do Sistema</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-white">API</p>
                  <p className="text-xs text-muted-foreground">Operacional</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-white">Banco de Dados</p>
                  <p className="text-xs text-muted-foreground">Conectado</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-white">PIX</p>
                  <p className="text-xs text-muted-foreground">Ativo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-white">Webhooks</p>
                  <p className="text-xs text-muted-foreground">Funcionando</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
