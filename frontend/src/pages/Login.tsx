"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, Input } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@construprice.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border border-[#2e2250] bg-[#120c20] text-white shadow-2xl shadow-black/40">
        <CardBody className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">ConstruPrice</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Entrar no painel</h1>
          <p className="mt-2 text-sm text-violet-200/80">Modo desenvolvimento: qualquer email (4+ chars) e senha (4+ chars) funcionam.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input
              type="email"
              label="E-mail"
              value={email}
              onValueChange={setEmail}
              variant="bordered"
              classNames={{ inputWrapper: "bg-[#191029] border-[#2e2250]" }}
              isRequired
            />

            <Input
              type="password"
              label="Senha"
              value={password}
              onValueChange={setPassword}
              variant="bordered"
              classNames={{ inputWrapper: "bg-[#191029] border-[#2e2250]" }}
              minLength={4}
              isRequired
            />

            {error ? <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</p> : null}

            <Button
              type="submit"
              isLoading={loading}
              className="w-full bg-brand-700 font-semibold text-white"
            >
              Entrar
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
