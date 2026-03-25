"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated) {
        router.replace("/login");
      } else {
        setIsChecking(false);
      }
    };

    // Pequeno delay para evitar flash
    const timer = setTimeout(checkAuth, 100);
    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  if (isChecking || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-neutral-800 border-t-purple-500" />
          <p className="text-sm text-neutral-400">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
