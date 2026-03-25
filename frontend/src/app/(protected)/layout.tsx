import type { ReactNode } from "react";
import AuthGuard from "../../components/AuthGuard";
import LayoutSelector from "../../layouts/LayoutSelector";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <LayoutSelector>
        {children}
      </LayoutSelector>
    </AuthGuard>
  );
}
