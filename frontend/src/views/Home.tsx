"use client";

import { Card, CardBody, CardHeader, Chip, Divider } from "@nextui-org/react";

export default function Home() {
  // Dados mockados para desenvolvimento
  const productsCount = 150;
  const categoriesCount = 12;
  const brandsCount = 8;

  return (
    <main className="space-y-6">
      <header className="rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-500/20 to-transparent p-6 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">ConstruPrice</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Dashboard Geral</h1>
        <p className="mt-2 max-w-4xl text-sm text-violet-100/80">
          Visão rápida de catálogo, cobertura de lojas e status operacional. A busca de materiais fica na aba
          separada “Buscar Produtos”.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="bg-[#191029] border border-[#2e2250] text-white">
          <CardBody>
            <p className="text-xs uppercase tracking-[0.15em] text-violet-300">Itens no catálogo</p>
            <p className="mt-2 text-3xl font-bold">{productsCount}</p>
          </CardBody>
        </Card>
        <Card className="bg-[#191029] border border-[#2e2250] text-white">
          <CardBody>
            <p className="text-xs uppercase tracking-[0.15em] text-violet-300">Categorias</p>
            <p className="mt-2 text-3xl font-bold">{categoriesCount}</p>
          </CardBody>
        </Card>
        <Card className="bg-[#191029] border border-[#2e2250] text-white">
          <CardBody>
            <p className="text-xs uppercase tracking-[0.15em] text-violet-300">Marcas</p>
            <p className="mt-2 text-3xl font-bold">{brandsCount}</p>
          </CardBody>
        </Card>
        <Card className="bg-[#191029] border border-[#2e2250] text-white">
          <CardBody>
            <p className="text-xs uppercase tracking-[0.15em] text-violet-300">Modo de dados</p>
            <p className="mt-2 text-lg font-semibold">Mock até backend</p>
          </CardBody>
        </Card>
      </section>

      <Card className="border border-[#2e2250] bg-[#120c20] text-white">
        <CardHeader className="flex-col items-start gap-2">
          <h2 className="text-lg font-semibold">Painel operacional</h2>
          <p className="text-sm text-violet-200/80">
            Interface minimalista no estilo dark para monitorar o sistema.
          </p>
        </CardHeader>
        <Divider className="bg-[#2e2250]" />
        <CardBody className="grid gap-3 md:grid-cols-3">
          <Chip className="border border-lime-500/30 bg-lime-500/20 text-lime-100">
            Scraper Megaleste: online
          </Chip>
          <Chip className="border border-yellow-500/30 bg-yellow-500/20 text-yellow-100">
            Atacadista: aguardando credenciais
          </Chip>
          <Chip className="border border-brand-500/30 bg-brand-500/20 text-brand-100">
            Tema ativo: Dark Purple
          </Chip>
        </CardBody>
      </Card>
    </main>
  );
}
