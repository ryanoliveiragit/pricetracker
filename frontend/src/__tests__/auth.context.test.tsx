import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../context/AuthContext";

function TestConsumer({ onError }: { onError?: (e: Error) => void } = {}) {
  const { user, isAuthenticated, login, logout } = useAuth();
  const handleLogin = (email: string, pass: string) => {
    login(email, pass).catch((e: Error) => onError?.(e));
  };
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? "logged-in" : "logged-out"}</span>
      <span data-testid="user-email">{user?.email ?? ""}</span>
      <span data-testid="user-role">{user?.role ?? ""}</span>
      <button onClick={() => handleLogin("admin@test.com", "senha123")}>login-admin</button>
      <button onClick={() => handleLogin("user@test.com", "pass")}>login-user</button>
      <button onClick={() => handleLogin("x", "123")}>login-invalid</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("AuthContext — estado inicial", () => {
  it("começa deslogado sem dados no localStorage", () => {
    renderWithAuth();
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-out");
  });

  it("restaura sessão do localStorage", () => {
    localStorage.setItem("construprice-auth", JSON.stringify({
      email: "cached@test.com",
      displayName: "Cached",
      role: "gestor",
    }));
    renderWithAuth();
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-in");
    expect(screen.getByTestId("user-email").textContent).toBe("cached@test.com");
  });

  it("ignora localStorage corrompido", () => {
    localStorage.setItem("construprice-auth", "{invalid json}");
    renderWithAuth();
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-out");
  });
});

describe("AuthContext — login", () => {
  it("loga com credenciais válidas e define role", async () => {
    renderWithAuth();
    await act(() => userEvent.click(screen.getByText("login-admin")));
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-in");
    expect(screen.getByTestId("user-role").textContent).toBe("admin");
  });

  it("persiste sessão no localStorage após login", async () => {
    renderWithAuth();
    await act(() => userEvent.click(screen.getByText("login-admin")));
    const stored = JSON.parse(localStorage.getItem("construprice-auth")!);
    expect(stored.email).toBe("admin@test.com");
  });

  it("lança erro com credenciais curtas/inválidas", async () => {
    let caughtError: Error | null = null;
    render(
      <AuthProvider>
        <TestConsumer onError={(e) => { caughtError = e; }} />
      </AuthProvider>
    );
    await act(() => userEvent.click(screen.getByText("login-invalid")));
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-out");
    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toMatch(/credenciais/i);
  });
});

describe("AuthContext — logout", () => {
  it("desloga e limpa localStorage", async () => {
    renderWithAuth();
    await act(() => userEvent.click(screen.getByText("login-admin")));
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-in");

    await act(() => userEvent.click(screen.getByText("logout")));
    expect(screen.getByTestId("auth-status").textContent).toBe("logged-out");
    expect(localStorage.getItem("construprice-auth")).toBeNull();
  });
});

describe("AuthContext — useAuth fora de Provider", () => {
  it("lança erro quando useAuth usado sem AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth deve ser usado dentro de AuthProvider");
    consoleSpy.mockRestore();
  });
});
