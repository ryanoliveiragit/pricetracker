"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

type Role = "admin" | "gestor" | "usuario" | "funcionario";

interface RoleGuardProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const allowed = isAuthenticated && user?.role && roles.includes(user.role as Role);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  if (!allowed) {
    return fallback ?? (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-sm text-neutral-400">Acesso restrito.</p>
      </div>
    );
  }

  return <>{children}</>;
}
