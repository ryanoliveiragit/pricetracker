"use client";

import { useState } from "react";
import { notify } from "../_toast";

const MOCK_AUDIT = [
  { ts: "2026-05-10 14:22:08", actor: "lucia@construprice.com", action: "tenant.update", target: "construtora-bnblx", detail: "plan: pro → enterprise" },
  { ts: "2026-05-10 13:51:43", actor: "lucia@construprice.com", action: "user.create", target: "marina@bnblx.com", detail: "role: admin" },
  { ts: "2026-05-10 11:09:12", actor: "system", action: "scraper.fail", target: "soma-uranio", detail: "Selenium login expirado" },
  { ts: "2026-05-10 09:33:00", actor: "diego@demo.com", action: "feedback.deploy", target: "fb5", detail: "branch fix/soma-login → main" },
  { ts: "2026-05-09 22:00:00", actor: "system", action: "cache.clear", target: "redis://default", detail: "scheduled weekly purge" },
  { ts: "2026-05-09 18:42:11", actor: "lucia@construprice.com", action: "tenant.create", target: "ryan", detail: "plan: free" },
  { ts: "2026-05-09 16:01:55", actor: "carlos@demo.com", action: "feedback.create", target: "fb2", detail: "Filtro por categoria some" },
  { ts: "2026-05-09 09:14:08", actor: "lucia@construprice.com", action: "settings.update", target: "scrapers.interval_minutes", detail: "30 → 15" },
];

export default function AuditPage() {
  const [q, setQ] = useState("");
  const items = MOCK_AUDIT.filter(a => !q || a.actor.includes(q) || a.action.includes(q) || a.target.includes(q));

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Audit log</h1><p>Histórico imutável de ações administrativas</p></div>
        <div className="pg-actions">
          <button className="btn" onClick={() => notify("Exportação iniciada")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></svg>
            Exportar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="inp" style={{ flex: 1, maxWidth: 320 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.3-4.3"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar por actor, action ou target…" />
          </div>
          <select className="btn sm">
            <option>Todos os tipos</option>
            <option>tenant.*</option>
            <option>user.*</option>
            <option>scraper.*</option>
            <option>feedback.*</option>
          </select>
          <select className="btn sm">
            <option>Últimos 7 dias</option>
            <option>30 dias</option>
            <option>90 dias</option>
          </select>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11.5 }}>{items.length} eventos</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Detalhe</th><th /></tr></thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={i}>
                <td className="mono muted" style={{ fontSize: 11.5 }}>{a.ts}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{a.actor}</td>
                <td>
                  <span className={`chip plain ${a.action.startsWith("scraper.fail") ? "err" : a.action.startsWith("tenant") ? "accent" : a.action.startsWith("user") || a.action.startsWith("feedback") ? "info" : ""}`}>
                    {a.action}
                  </span>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{a.target}</td>
                <td style={{ fontSize: 12.5 }}>{a.detail}</td>
                <td><button className="btn icon btn-ghost" title="Ver">
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx={12} cy={12} r={3}/></svg>
                </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

