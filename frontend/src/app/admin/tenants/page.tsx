"use client";

import { useEffect, useState, useCallback } from "react";
import { tenantsApi, suppliersApi, type ApiTenant, type ApiSupplier } from "@/services/api";
import { adminApi, type AdminSupplier } from "@/services/adminApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScraperCredentials {
  username: string;
  password: string;
}

interface TestResult {
  ok: boolean;
  message: string;
}

// ─── Scraper row ─────────────────────────────────────────────────────────────

function ScraperRow({
  supplier,
  linked,
  savedCreds,
  tenantId,
  onToggleLink,
}: {
  supplier: AdminSupplier;
  linked: boolean;
  savedCreds?: ScraperCredentials;
  tenantId: string;
  onToggleLink: () => void;
}) {
  const [creds, setCreds] = useState<ScraperCredentials>(
    savedCreds ?? { username: "", password: "" }
  );
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveResult, setSaveResult] = useState<"ok" | "err" | null>(null);

  // Re-sync when parent loads saved creds after linking
  useEffect(() => {
    if (savedCreds) setCreds(savedCreds);
  }, [savedCreds?.username, savedCreds?.password]);

  const handleTest = async () => {
    if (!creds.username || !creds.password) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await suppliersApi.testLogin(supplier.id, creds.username, creds.password);
      setTestResult(res);
    } catch {
      setTestResult({ ok: false, message: "Erro ao conectar com o backend" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!creds.username || !creds.password) return;
    setSaving(true);
    setSaveResult(null);
    try {
      await suppliersApi.update(supplier.id, { username: creds.username, password: creds.password });
      setSaveResult("ok");
    } catch {
      setSaveResult("err");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLink = async () => {
    setLinking(true);
    try {
      if (linked) {
        await tenantsApi.removeSupplier(tenantId, supplier.id);
      } else {
        await tenantsApi.addSupplier(tenantId, supplier.id);
      }
      onToggleLink();
    } catch {
      // silently fail — parent will re-fetch
    } finally {
      setLinking(false);
    }
  };

  const needsLogin = supplier.requiresLogin || supplier.login_type !== "none";

  return (
    <div className="border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-100">{supplier.name}</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{supplier.region}</span>
          {linked && (
            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">vinculado</span>
          )}
          {linked && needsLogin && savedCreds?.username && (
            <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">credenciais salvas</span>
          )}
        </div>
        <button
          onClick={handleToggleLink}
          disabled={linking}
          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
            linked
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
              : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30"
          }`}
        >
          {linking ? "..." : linked ? "Desvincular" : "Vincular"}
        </button>
      </div>

      {linked && needsLogin && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Usuário / login"
              value={creds.username}
              onChange={e => { setCreds(p => ({ ...p, username: e.target.value })); setSaveResult(null); }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <input
              type="password"
              placeholder="Senha"
              value={creds.password}
              onChange={e => { setCreds(p => ({ ...p, password: e.target.value })); setSaveResult(null); }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving || !creds.username || !creds.password}
              className="text-sm px-4 py-1.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {saving ? "Salvando..." : "Salvar Credenciais"}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !creds.username || !creds.password}
              className="text-sm px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {testing ? "Testando..." : "Testar Login"}
            </button>

            {saveResult === "ok" && <span className="text-sm text-green-400 font-medium">✓ Salvo</span>}
            {saveResult === "err" && <span className="text-sm text-red-400 font-medium">✗ Erro ao salvar</span>}
            {testResult && (
              <span className={`text-sm font-medium ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.ok ? "✓ Login OK" : `✗ ${testResult.message}`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tenant card ─────────────────────────────────────────────────────────────

function TenantCard({
  tenant,
  allSuppliers,
}: {
  tenant: ApiTenant;
  allSuppliers: AdminSupplier[];
}) {
  const [open, setOpen] = useState(false);
  const [linkedMap, setLinkedMap] = useState<Map<string, ScraperCredentials>>(new Map());
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const loadLinked = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const linked = await tenantsApi.getSuppliers(tenant.id);
      const map = new Map<string, ScraperCredentials>();
      for (const s of linked as ApiSupplier[]) {
        map.set(s.id, { username: s.username ?? "", password: s.password ?? "" });
      }
      setLinkedMap(map);
    } catch {
      // ignore
    } finally {
      setLoadingSuppliers(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    if (open) loadLinked();
  }, [open, loadLinked]);

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-100">{tenant.name}</span>
          <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">{tenant.slug}</span>
          <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">{tenant.plan}</span>
          {!tenant.isActive && (
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">inativo</span>
          )}
        </div>
        <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Scrapers / Fornecedores
          </p>

          {loadingSuppliers ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="space-y-3">
              {allSuppliers.map(s => (
                <ScraperRow
                  key={s.id}
                  supplier={s}
                  linked={linkedMap.has(s.id)}
                  savedCreds={linkedMap.get(s.id)}
                  tenantId={tenant.id}
                  onToggleLink={loadLinked}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<AdminSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([tenantsApi.getAll(), adminApi.getAllSuppliers()])
      .then(([t, s]) => { setTenants(t); setAllSuppliers(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Carregando tenants...</p>;
  if (error) return <p className="text-red-400">Erro: {error}</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Tenants</h1>
        <span className="text-sm text-gray-500">{tenants.length} tenant(s)</span>
      </div>

      {tenants.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Nenhum tenant cadastrado.</p>
      ) : (
        tenants.map(t => (
          <TenantCard key={t.id} tenant={t} allSuppliers={allSuppliers} />
        ))
      )}
    </div>
  );
}
