"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@nextui-org/react";

export default function TestLogin() {
  const [email, setEmail] = useState("admin@construprice.com");
  const [password, setPassword] = useState("admin");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function testLogin() {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🔐 Iniciando teste de login...');
      
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });
      
      console.log('📥 Status:', response.status);
      
      const data = await response.json();
      console.log('📦 Response:', data);
      
      setResult({
        status: response.status,
        ok: response.ok,
        data: data
      });
      
    } catch (error) {
      console.error('💥 Erro:', error);
      setResult({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        type: 'network_error'
      });
    } finally {
      setLoading(false);
    }
  }

  async function testHealth() {
    try {
      const response = await fetch('http://localhost:8000/api/health');
      const data = await response.json();
      alert(`Backend OK: ${JSON.stringify(data)}`);
    } catch (error) {
      alert(`Backend ERRO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl border border-[#2e2250] bg-[#120c20] text-white shadow-2xl shadow-black/40">
        <CardHeader className="pb-0 pt-6 px-6">
          <h1 className="text-2xl font-bold text-white">🧪 Teste de Login API</h1>
          <p className="text-sm text-violet-200/80">Teste direto da API de autenticação</p>
        </CardHeader>
        <CardBody className="px-6 py-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={testHealth}
                color="primary"
                variant="flat"
                size="sm"
              >
                🏥 Testar Health
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                label="Email"
                value={email}
                onValueChange={setEmail}
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#191029] border-[#2e2250]" }}
              />
              <Input
                label="Senha"
                type="password"
                value={password}
                onValueChange={setPassword}
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#191029] border-[#2e2250]" }}
              />
            </div>

            <Button 
              onClick={testLogin}
              color="primary"
              isLoading={loading}
              className="w-full"
            >
              🚀 Testar Login
            </Button>

            {result && (
              <Card className="bg-[#191029] border-[#2e2250]">
                <CardBody className="p-4">
                  <h3 className="text-lg font-semibold text-brand-200 mb-2">📊 Resultado:</h3>
                  <pre className="text-xs text-green-400 overflow-auto max-h-96">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </CardBody>
              </Card>
            )}

            <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">📋 Instruções:</h4>
              <ol className="text-sm text-blue-200/80 space-y-1 list-decimal list-inside">
                <li>Abra o DevTools (F12)</li>
                <li>Vá para aba Console</li>
                <li>Clique em "Testar Health"</li>
                <li>Clique em "Testar Login"</li>
                <li>Veja os logs no console</li>
              </ol>
            </div>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
