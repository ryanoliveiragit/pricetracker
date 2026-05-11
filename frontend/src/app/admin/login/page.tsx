"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../../../services/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.login(email, password, true);
      if (!result.success || !result.user) {
        setError("Credenciais inválidas");
        return;
      }
      if (result.user.role !== "super_admin" && result.user.role !== "admin") {
        setError("Acesso restrito. Apenas administradores da plataforma.");
        return;
      }
      localStorage.setItem("construprice-auth", JSON.stringify({
        email: result.user.email,
        displayName: result.user.name ?? result.user.email.split("@")[0],
        role: result.user.role,
        token: result.token ?? "",
      }));
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell" style={{ minHeight: "100vh" }}>
      <div className="login-art">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>⌘</div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>ConstruPrice</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>Admin Console · v2.4</div>
          </div>
        </div>

        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".15em", textTransform: "uppercase", opacity: 0.55, marginBottom: 16 }}>Operações · Plataforma · Segurança</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.1, margin: 0, fontWeight: 600, letterSpacing: "-0.025em" }}>
            O console de operações para sua plataforma multi-tenant.
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 16, lineHeight: 1.55 }}>
            Gerencie tenants, monitore scrapers, revise feedbacks e mantenha o controle de toda a infraestrutura — em um só lugar.
          </p>

          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 12 }}>
            {[
              { n: "8", l: "Tenants ativos" },
              { n: "23", l: "Scrapers monitorados" },
              { n: "99.4%", l: "Uptime · 30d" },
            ].map(s => (
              <div key={s.l}>
                <div className="mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.n}</div>
                <div style={{ opacity: 0.5, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.45 }}>
          <span>Apenas administradores autorizados</span>
          <span className="mono">us-east-1 · prod</span>
        </div>
      </div>

      <div className="login-form-wrap">
        <div className="login-form">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Acessar painel</h2>
          <p style={{ margin: "6px 0 28px", color: "var(--text-3)", fontSize: 13 }}>Faça login como administrador da plataforma.</p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--err-soft)", border: "1px solid color-mix(in oklab, var(--err) 25%, transparent)", borderRadius: 8, fontSize: 12.5, color: "var(--err)", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.3 3.4 1.8 17.5a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17v.01"/></svg>
                {error}
              </div>
            )}

            <div className="field" style={{ marginBottom: 14 }}>
              <label>E-mail</label>
              <div className="inp">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={9} cy={8} r={4}/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><circle cx={17} cy={7} r={3}/><path d="M22 18c0-2.7-2.2-5-5-5"/></svg>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@construprice.com" required />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 18 }}>
              <label>Senha</label>
              <div className="inp">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z"/></svg>
                <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={4} />
                <button type="button" onClick={() => setShow(!show)} style={{ background: "transparent", border: 0, color: "var(--text-3)", padding: 0, cursor: "pointer" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx={12} cy={12} r={3}/></svg>
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", height: 38, justifyContent: "center", fontSize: 13 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={12} cy={12} r={9}/><path d="M12 8v.01M12 12v4"/></svg>
            <span>Acesso restrito a roles <code className="mono" style={{ color: "var(--text-2)" }}>super_admin</code> ou <code className="mono" style={{ color: "var(--text-2)" }}>admin</code>.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
