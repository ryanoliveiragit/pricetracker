"use client";

import { useAuth } from "../../context/AuthContext";
import { ReactNode } from "react";

type Role = "admin" | "gestor" | "usuario" | "funcionario";

interface RoleGuardProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !user.role) return <>{fallback}</>;

  if (roles.includes(user.role as Role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
