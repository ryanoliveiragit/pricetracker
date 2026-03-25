"use client";

import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function Credenciais() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl border border-[#2e2250] bg-[#120c20] text-white shadow-2xl shadow-black/40">
        <CardHeader className="pb-0 pt-6 px-6">
          <h1 className="text-2xl font-bold text-white">🔐 Credenciais de Acesso</h1>
          <p className="text-sm text-violet-200/80 mt-2">
            Use estas credenciais para acessar o sistema ConstruPrice
          </p>
        </CardHeader>
        <CardBody className="px-6 py-6">
          <div className="space-y-4">
            <Card className="bg-[#191029] border-[#2e2250]">
              <CardBody className="p-4">
                <h3 className="text-lg font-semibold text-brand-200 mb-2">👨‍💼 Administrador</h3>
                <div className="space-y-2 font-mono text-sm">
                  <div>
                    <span className="text-violet-300">Email:</span>
                    <span className="ml-2 text-white">admin@construprice.com</span>
                  </div>
                  <div>
                    <span className="text-violet-300">Senha:</span>
                    <span className="ml-2 text-white">admin</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="bg-[#191029] border-[#2e2250]">
              <CardBody className="p-4">
                <h3 className="text-lg font-semibold text-brand-200 mb-2">👤 Gestor</h3>
                <div className="space-y-2 font-mono text-sm">
                  <div>
                    <span className="text-violet-300">Email:</span>
                    <span className="ml-2 text-white">gestor@construprice.com</span>
                  </div>
                  <div>
                    <span className="text-violet-300">Senha:</span>
                    <span className="ml-2 text-white">gestor123</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="mt-6 p-4 bg-[#2e2250]/20 rounded-lg border border-[#2e2250]/50">
              <h4 className="text-sm font-semibold text-brand-200 mb-2">📡 URLs do Sistema</h4>
              <div className="space-y-1 text-sm text-violet-200/80">
                <div>Frontend: <span className="text-white font-mono">http://localhost:3002</span></div>
                <div>Backend API: <span className="text-white font-mono">http://localhost:8000</span></div>
                <div>Documentação: <span className="text-white font-mono">http://localhost:8000/docs</span></div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <h4 className="text-sm font-semibold text-yellow-300 mb-2">⚠️ Importante</h4>
              <ul className="text-sm text-yellow-200/80 space-y-1 list-disc list-inside">
                <li>Backend deve estar rodando na porta 8000</li>
                <li>Frontend deve estar rodando na porta 3002</li>
                <li>Credenciais são válidas para desenvolvimento</li>
                <li>Em produção, configure usuários no banco de dados</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
