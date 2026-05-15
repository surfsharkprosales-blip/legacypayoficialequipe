"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileCheck,
  ArrowLeftRight,
  Wallet,
  Settings,
  Server,
  LogOut,
  Menu,
  X,
  Shield,
  UserCog,
  Bell,
  BellRing,
  Activity,
  Gift,
  Percent,
  FileBarChart,
  UsersRound,
  Webhook,
  Clock,
  DollarSign,
  Database,
  Headphones,
  Bot,
} from "lucide-react";

// Menu organizado em categorias com cores
const menuCategories = [
  {
    title: "Visao Geral",
    color: "primary", // Laranja
    items: [
      { label: "Dashboard", href: "/lp-x7k9m2-internal/ceo", icon: LayoutDashboard },
      { label: "Relatorios", href: "/lp-x7k9m2-internal/ceo/reports", icon: FileBarChart },
    ],
  },
  {
    title: "Usuarios & Equipe",
    color: "blue", // Azul
    items: [
      { label: "Usuarios", href: "/lp-x7k9m2-internal/ceo/users", icon: Users },
      { label: "Equipe", href: "/lp-x7k9m2-internal/ceo/team", icon: UserCog },
      { label: "KYC", href: "/lp-x7k9m2-internal/ceo/kyc", icon: FileCheck },
      { label: "Afiliados", href: "/lp-x7k9m2-internal/ceo/affiliates", icon: UsersRound },
    ],
  },
  {
    title: "Financeiro",
    color: "emerald", // Verde
    items: [
      { label: "Dashboard", href: "/lp-x7k9m2-internal/ceo/financial", icon: DollarSign },
      { label: "Transacoes", href: "/lp-x7k9m2-internal/ceo/transactions", icon: ArrowLeftRight },
      { label: "Saques", href: "/lp-x7k9m2-internal/ceo/withdrawals", icon: Wallet },
      { label: "Taxas", href: "/lp-x7k9m2-internal/ceo/fees", icon: Percent },
    ],
  },
  {
    title: "Engajamento",
    color: "cyan", // Ciano
    items: [
      { label: "Tickets", href: "/lp-x7k9m2-internal/ceo/tickets", icon: Headphones },
      { label: "Premiacoes", href: "/lp-x7k9m2-internal/ceo/rewards", icon: Gift },
      { label: "Notificacoes", href: "/lp-x7k9m2-internal/ceo/notifications", icon: Bell },
      { label: "Push", href: "/lp-x7k9m2-internal/ceo/push", icon: BellRing },
    ],
  },
  {
    title: "Sistema",
    color: "purple", // Roxo
    items: [
      { label: "Telegram", href: "/lp-x7k9m2-internal/ceo/telegram", icon: Bot },
      { label: "Webhooks", href: "/lp-x7k9m2-internal/ceo/webhooks", icon: Webhook },
      { label: "Logs", href: "/lp-x7k9m2-internal/ceo/logs", icon: Activity },
      { label: "Ataques", href: "/lp-x7k9m2-internal/ceo/attacks", icon: Shield },
      { label: "Adquirentes", href: "/lp-x7k9m2-internal/ceo/acquirers", icon: Server },
      { label: "Backup", href: "/lp-x7k9m2-internal/ceo/backup", icon: Database },
      { label: "Config", href: "/lp-x7k9m2-internal/ceo/settings", icon: Settings },
    ],
  },
];

// Funcao para obter classes de cor
const getColorClasses = (color: string, isActive: boolean) => {
  const colors: Record<string, { label: string; active: string; hover: string; icon: string }> = {
    primary: {
      label: "text-primary/70",
      active: "bg-gradient-to-r from-primary/20 to-primary/5 text-primary border-l-2 border-primary",
      hover: "hover:bg-primary/5 hover:text-primary",
      icon: "text-primary",
    },
    blue: {
      label: "text-blue-500/70",
      active: "bg-gradient-to-r from-blue-500/20 to-blue-500/5 text-blue-400 border-l-2 border-blue-500",
      hover: "hover:bg-blue-500/5 hover:text-blue-400",
      icon: "text-blue-400",
    },
    emerald: {
      label: "text-emerald-500/70",
      active: "bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-l-2 border-emerald-500",
      hover: "hover:bg-emerald-500/5 hover:text-emerald-400",
      icon: "text-emerald-400",
    },
    cyan: {
      label: "text-cyan-500/70",
      active: "bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-l-2 border-cyan-500",
      hover: "hover:bg-cyan-500/5 hover:text-cyan-400",
      icon: "text-cyan-400",
    },
    purple: {
      label: "text-purple-500/70",
      active: "bg-gradient-to-r from-purple-500/20 to-purple-500/5 text-purple-400 border-l-2 border-purple-500",
      hover: "hover:bg-purple-500/5 hover:text-purple-400",
      icon: "text-purple-400",
    },
  }
  return colors[color] || colors.primary
};

export default function CEOLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser] = useState("Admin CEO");
  const [sessionTimeLeft] = useState("24h 00m");
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("lp_admin_session");
    localStorage.removeItem("lp_admin_user");
    localStorage.removeItem("lp_admin_role");
    localStorage.removeItem("lp_admin_login_time");
    router.push("/lp-x7k9m2-internal");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden glass sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="LegacyPay" width={32} height={32} />
          <span className="font-semibold text-foreground">Admin CEO</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Timer Mobile */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Clock className="w-3 h-3 text-yellow-500" />
            <span className="text-xs font-medium text-yellow-400">{sessionTimeLeft || "24h 00m"}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:min-h-screen bg-gradient-to-b from-card to-black/95 border-r border-border/50 sticky top-0">
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Image
                  src="/logo-icon.png"
                  alt="LegacyPay"
                  width={40}
                  height={40}
                  className="relative drop-shadow-lg"
                />
              </div>
              <div>
                <div className="flex items-baseline">
                  <span className="font-bold text-foreground">Legacy</span>
                  <span className="font-bold text-primary">Pay</span>
                </div>
                <span className="text-xs text-red-400 font-medium">Painel CEO</span>
              </div>
            </div>
            
            {/* Timer de Sessao - TOPO */}
            <div className="flex items-center gap-2 px-3 py-2 mt-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20">
              <Clock className="w-4 h-4 text-yellow-500" />
              <div className="flex-1">
                <p className="text-[10px] text-yellow-500 font-medium">Sessao expira em</p>
                <p className="text-sm font-bold text-yellow-400">{sessionTimeLeft || "24h 00m"}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
            {menuCategories.map((category, categoryIndex) => {
              const colorClasses = getColorClasses(category.color, false)
              return (
                <div key={category.title} className={categoryIndex > 0 ? "pt-5" : "pt-2"}>
                  <div className="pb-2">
                    <span className={`px-4 text-[10px] font-semibold uppercase tracking-widest ${colorClasses.label}`}>
                      {category.title}
                    </span>
                  </div>
                  {category.items.map((item) => {
                    const isActive = item.href === "/lp-x7k9m2-internal/ceo" 
                      ? pathname === item.href 
                      : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                          isActive
                            ? colorClasses.active
                            : `text-muted-foreground ${colorClasses.hover}`
                        }`}
                      >
                        <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? colorClasses.icon : "group-hover:scale-110"}`} />
                        <span className="font-medium text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">
                  {adminUser}
                </p>
                <p className="text-xs text-muted-foreground">CEO / Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-overlay z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 25 }}
                className="fixed left-0 top-0 bottom-0 w-72 bg-card z-50 lg:hidden flex flex-col"
              >
                <div className="p-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/logo-icon.png"
                      alt="LegacyPay"
                      width={36}
                      height={36}
                    />
                    <div>
                      <div className="flex items-baseline">
                        <span className="font-bold text-foreground">Legacy</span>
                        <span className="font-bold text-primary">Pay</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Painel CEO
                      </span>
                    </div>
                  </div>
                  
                  {/* Timer de Sessao Mobile - TOPO */}
                  <div className="flex items-center gap-2 px-3 py-2 mt-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <div className="flex-1">
                      <p className="text-[10px] text-yellow-500">Sessao expira em</p>
                      <p className="text-sm font-bold text-yellow-400">{sessionTimeLeft || "24h 00m"}</p>
                    </div>
                  </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
                  {menuCategories.map((category, categoryIndex) => {
                    const colorClasses = getColorClasses(category.color, false)
                    return (
                      <div key={category.title} className={categoryIndex > 0 ? "pt-5" : "pt-2"}>
                        <div className="pb-2">
                          <span className={`px-4 text-[10px] font-semibold uppercase tracking-widest ${colorClasses.label}`}>
                            {category.title}
                          </span>
                        </div>
                        {category.items.map((item) => {
                          const isActive = item.href === "/lp-x7k9m2-internal/ceo" 
                            ? pathname === item.href 
                            : pathname.startsWith(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                isActive
                                  ? colorClasses.active
                                  : `text-muted-foreground ${colorClasses.hover}`
                              }`}
                            >
                              <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? colorClasses.icon : "group-hover:scale-110"}`} />
                              <span className="font-medium text-sm">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )
                  })}
                </nav>

                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {adminUser}
                      </p>
                      <p className="text-xs text-muted-foreground">CEO / Admin</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sair</span>
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
