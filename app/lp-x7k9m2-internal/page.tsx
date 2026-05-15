"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirecionar para o dashboard CEO
    router.replace("/lp-x7k9m2-internal/ceo");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando painel admin...</p>
      </div>
    </div>
  );
}
