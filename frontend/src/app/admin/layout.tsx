"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("construprice-auth");
    if (!raw) { router.replace("/login"); return; }
    try {
      const auth = JSON.parse(raw) as { role?: string };
      if (auth.role !== "super_admin") { router.replace("/login"); return; }
    } catch {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400">
      Verificando acesso...
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-purple-400 text-lg">ConstruPrice · Admin</span>
        <nav className="flex gap-4 text-sm">
          <a href="/admin/tenants" className="text-gray-300 hover:text-white transition-colors">Tenants</a>
          <a href="/admin/feedback" className="text-gray-300 hover:text-white transition-colors">Feedback</a>
          <button
            onClick={() => { localStorage.removeItem("construprice-auth"); router.push("/login"); }}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            Sair
          </button>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
