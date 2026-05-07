import { describe, it, expect, vi, beforeEach } from "vitest";
import { suppliersApi, productsApi, authApi, searchApi, LoginError } from "../services/api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockOk(data: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockError(status: number, body?: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body ?? null),
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── suppliersApi ────────────────────────────────────────────────────────────

describe("suppliersApi.getAll", () => {
  it("retorna lista de fornecedores", async () => {
    const suppliers = [{ id: "1", name: "Fornecedor A" }];
    mockFetch.mockResolvedValueOnce(mockOk(suppliers));
    const result = await suppliersApi.getAll();
    expect(result).toEqual(suppliers);
  });

  it("lança erro em resposta 500", async () => {
    mockFetch.mockResolvedValueOnce(mockError(500));
    await expect(suppliersApi.getAll()).rejects.toThrow("API error 500");
  });

  it("lança erro em resposta 404", async () => {
    mockFetch.mockResolvedValueOnce(mockError(404));
    await expect(suppliersApi.getAll()).rejects.toThrow("API error 404");
  });
});

describe("suppliersApi.create", () => {
  it("cria fornecedor e retorna objeto criado", async () => {
    const created = { id: "2", name: "Novo", url: "http://x.com", requiresLogin: false, isActive: true, createdAt: "" };
    mockFetch.mockResolvedValueOnce(mockOk(created));
    const result = await suppliersApi.create({ name: "Novo", url: "http://x.com", requiresLogin: false, isActive: true });
    expect(result).toEqual(created);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe("Novo");
  });
});

describe("suppliersApi.delete", () => {
  it("não lança erro em 200", async () => {
    mockFetch.mockResolvedValueOnce(mockOk(null));
    await expect(suppliersApi.delete("1")).resolves.toBeUndefined();
  });

  it("não lança erro em 404 (already deleted)", async () => {
    mockFetch.mockResolvedValueOnce(mockError(404));
    await expect(suppliersApi.delete("1")).resolves.toBeUndefined();
  });

  it("lança erro em 500", async () => {
    mockFetch.mockResolvedValueOnce(mockError(500));
    await expect(suppliersApi.delete("1")).rejects.toThrow("API error 500");
  });
});

// ─── productsApi ─────────────────────────────────────────────────────────────

describe("productsApi.importCsv", () => {
  it("importa CSV e retorna contadores", async () => {
    const result = { imported: 5, skipped: 1, products: [] };
    mockFetch.mockResolvedValueOnce(mockOk(result));
    const file = new File(["a,b"], "test.csv", { type: "text/csv" });
    const res = await productsApi.importCsv(file);
    expect(res.imported).toBe(5);
    expect(res.skipped).toBe(1);
  });

  it("lança erro com mensagem do backend em falha", async () => {
    mockFetch.mockResolvedValueOnce(mockError(400, { detail: "CSV inválido" }));
    const file = new File([""], "bad.csv");
    await expect(productsApi.importCsv(file)).rejects.toThrow("CSV inválido");
  });
});

// ─── authApi (mock) ───────────────────────────────────────────────────────────

describe("authApi.login", () => {
  it("retorna sucesso com email e senha válidos", async () => {
    const res = await authApi.login("user@test.com", "senha123");
    expect(res.success).toBe(true);
    expect(res.user?.email).toBe("user@test.com");
  });

  it("infere role admin quando email contém 'admin'", async () => {
    const res = await authApi.login("admin@empresa.com", "senha123");
    expect(res.user?.role).toBe("admin");
  });

  it("infere role gestor quando email contém 'gestor'", async () => {
    const res = await authApi.login("gestor@empresa.com", "senha123");
    expect(res.user?.role).toBe("gestor");
  });

  it("retorna falha com senha curta (< 4 chars)", async () => {
    const res = await authApi.login("user@test.com", "123");
    expect(res.success).toBe(false);
  });

  it("retorna falha com email vazio/inválido", async () => {
    const res = await authApi.login("ab", "senha123");
    expect(res.success).toBe(false);
  });
});

// ─── searchApi.suggestions ────────────────────────────────────────────────────

describe("searchApi.suggestions", () => {
  it("retorna sugestões para query válida", async () => {
    const data = { products: [{ name: "Cimento", brand: "Votorantim", category: "Cimento" }], synonyms: [], has_match: true };
    mockFetch.mockResolvedValueOnce(mockOk(data));
    const result = await searchApi.suggestions("cimento");
    expect(result.has_match).toBe(true);
    expect(result.products).toHaveLength(1);
  });

  it("retorna vazio em erro de rede (não lança)", async () => {
    mockFetch.mockResolvedValueOnce(mockError(503));
    const result = await searchApi.suggestions("cimento");
    expect(result.products).toEqual([]);
    expect(result.has_match).toBe(false);
  });
});

// ─── LoginError ───────────────────────────────────────────────────────────────

describe("LoginError", () => {
  it("tem name LoginError", () => {
    const err = new LoginError("credenciais inválidas");
    expect(err.name).toBe("LoginError");
    expect(err instanceof Error).toBe(true);
  });
});

// ─── parseResponse 422 com login_error ───────────────────────────────────────

describe("parseResponse — 422 login_error", () => {
  it("lança LoginError em resposta 422 com login_error", async () => {
    const body = { detail: { login_error: true, message: "Credenciais recusadas" } };
    mockFetch.mockResolvedValueOnce(mockError(422, body));
    await expect(suppliersApi.getAll()).rejects.toThrow(LoginError);
  });
});
