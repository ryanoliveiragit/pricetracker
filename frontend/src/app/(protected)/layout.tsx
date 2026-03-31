import type { ReactNode } from "react";
import AuthGuard from "../../components/AuthGuard";
import LayoutSelector from "../../layouts/LayoutSelector";
import { SavedOffersProvider } from "../../context/SavedOffersContext";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <LayoutSelector>
        <SavedOffersProvider>
          {children}
        </SavedOffersProvider>
      </LayoutSelector>
    </AuthGuard>
  );
}
