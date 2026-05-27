# ConstruPrice — Conteúdo para Landing Page

## O que é

ConstruPrice é uma plataforma SaaS B2B de comparação de preços de materiais de construção em tempo real. Empresas do setor — construtoras, empreiteiras, depósitos e compradores profissionais — usam para cotar dezenas de itens de uma vez, comparar preços de múltiplos fornecedores e identificar onde comprar mais barato, tudo em segundos.

---

## Para quem é

- **Construtoras e empreiteiras** que compram materiais em volume e precisam fechar a cotação mais rápido
- **Compradores e gestores de suprimentos** que fazem cotação manual hoje (telefone, WhatsApp, planilha)
- **Depósitos de materiais** que querem oferecer essa ferramenta para seus clientes como diferencial
- **Profissionais autônomos** (engenheiros, arquitetos, mestres de obra) que querem o menor preço sem perder tempo

---

## O problema que resolve

Hoje, quem compra material de construção profissionalmente perde horas por semana ligando para fornecedores, enviando mensagens e montando planilhas de cotação manualmente. Quando a lista tem 30 itens e 5 fornecedores, são 150 verificações de preço feitas à mão.

ConstruPrice faz isso em segundos.

---

## Como funciona — passo a passo

**1. Cole sua lista de materiais**
O usuário digita ou cola os itens que precisa comprar — um por linha. Sem formulário complexo, sem SKU, sem código. Linguagem natural: "cimento cp2 50kg", "tijolo 8 furos", "vergalhão 10mm 12m".

**2. A plataforma busca em múltiplos fornecedores simultaneamente**
Em paralelo, scrapers automáticos consultam os sites dos fornecedores cadastrados. A busca usa normalização de texto e inteligência de sinônimos para encontrar o produto certo mesmo quando o nome está diferente ("cimento cp ii" = "cimento cp2" = "cimento portland").

**3. Resultados organizados por item**
Cada material aparece com os preços de todos os fornecedores lado a lado. O menor preço fica destacado. O usuário vê de onde comprar cada item para pagar menos.

**4. Acesso direto ao produto**
Cada resultado tem link direto para a página do produto ou carrinho do fornecedor. Um clique e o usuário já está comprando.

---

## Funcionalidades principais

### Busca e comparação
- Busca simultânea em múltiplos fornecedores (até 5 em paralelo por padrão)
- Normalização automática: remove acentos, plurais, variações de escrita
- Expansão de sinônimos: aprende que "tijolo baiano" = "tijolo 8 furos" e aplica automaticamente
- Sistema de abreviações: "cim" vira "cimento", "verg" vira "vergalhão"
- Cache de resultados: buscas repetidas retornam na hora (cache de 30 minutos)
- Streaming de resultados: os preços aparecem conforme chegam, sem esperar todos os fornecedores terminarem

### Catálogo inteligente
- Banco de produtos pré-cadastrados com variantes e sinônimos
- Scraping agendado a cada 2 horas para manter preços atualizados
- Busca instantânea no catálogo local antes de acionar scrapers externos
- Suporte a SKU, marca, unidade e categoria

### Multi-tenant (cada empresa tem seu ambiente)
- Cada empresa cliente tem seus próprios fornecedores, usuários e dados isolados
- Acesso via subdomínio exclusivo: `suaempresa.construprice.com.br`
- Configuração de marca própria: nome da plataforma, cor, logo (white-label)
- Planos: free, pro, enterprise

### Gestão de fornecedores
- Cadastro de fornecedores por tenant
- Suporte a fornecedores que exigem login (sessão Selenium mantida em cache)
- Fornecedores públicos (sem login) e privados
- Credenciais criptografadas por fornecedor
- Teste de login integrado: o admin testa se as credenciais funcionam antes de ativar
- Ativação/desativação de fornecedor por tenant

### Gestão de usuários e times
- Perfis: Admin, Gestor, Usuário, Funcionário
- Super Admin da plataforma (acesso cross-tenant)
- Convite de usuários com envio de credenciais por e-mail
- Controle de acesso por role

### Ofertas salvas
- Usuário salva ofertas específicas para comparar depois ou montar pedido
- Histórico de cotações por tenant

### Agente IA de cotação
- Chat guiado para montar lista de itens: o agente pergunta quais produtos o usuário quer cotar, em qual fornecedor, e vai montando o pedido
- O agente aprende com o contexto da conversa: se o usuário diz "quero cimento, vergalhão e telha", ele organiza e busca tudo
- Sugere sinônimos e variações para maximizar resultados

### Feedback e auto-fix (para operadores da plataforma)
- Usuários reportam quando um resultado está errado (produto errado, preço desatualizado, nome diferente)
- IA analisa o feedback e propõe a correção (novo sinônimo, nova abreviação, ajuste de scraper)
- Painel Kanban para gestão dos tickets: Pendente → Analisado → Validado → Executando → Deployed → Mergeado
- Auto-fix: correções simples (sinônimos, abreviações) são aplicadas automaticamente no banco após validação do admin
- Correções complexas geram branch no GitHub com diff proposto para revisão e merge

---

## Diferenciais técnicos (para landing page mais técnica)

- **Scraping robusto**: Selenium com sessão persistente para sites que exigem login; BeautifulSoup para sites públicos
- **Sem dependência de API**: acessa os sites como um humano, sem precisar de integração com o fornecedor
- **Resultado em tempo real**: streaming via SSE, o usuário vê os preços chegando um por um
- **Alta resiliência**: se um fornecedor cair, os outros continuam; erro nunca trava a busca
- **Inteligência de texto**: normalização fonética, similaridade fuzzy, expansão de sinônimos dinâmica
- **Deploy**: funciona em Vercel (frontend) + Railway/Fly (backend) ou Docker self-hosted

---

## Números e escala

- Até **20+ itens** por cotação em uma única busca
- **5 fornecedores** em paralelo por padrão (configurável)
- Cache de **30 minutos** para buscas repetidas
- Sessões Selenium mantidas em cache para **login instantâneo**
- Scraping a cada **2 horas** para manter catálogo atualizado

---

## Frases para copy da landing page

**Hero:**
> "Cole sua lista. Receba os menores preços. Em segundos."

> "Pare de ligar para fornecedor. ConstruPrice faz a cotação por você."

> "Compre material de construção mais barato — sem planilha, sem telefone, sem perda de tempo."

**Sub-hero:**
> "Busca simultânea em múltiplos fornecedores. Resultados em tempo real. Um clique para comprar."

**Problema:**
> "Você ainda faz cotação no WhatsApp?"
> "Sua equipe passa horas por semana pedindo preço manualmente."
> "Até você receber todas as respostas, algum preço já mudou."

**Solução:**
> "ConstruPrice compara preços em tempo real, em todos os seus fornecedores, ao mesmo tempo."

**Para quem:**
> "Para construtoras, empreiteiras e compradores profissionais que compram material todo mês."

**Social proof (placeholder):**
> "Empresas que usam ConstruPrice economizam em média X% na cotação de materiais."
> "O que levava 3 horas agora leva 30 segundos."

**CTA:**
> "Comece grátis — sem cartão de crédito"
> "Solicite uma demo"
> "Cadastre sua empresa"

---

## Seções sugeridas para a landing page

1. **Hero** — título forte + subtítulo + CTA + GIF/vídeo mostrando a busca em tempo real
2. **Como funciona** — 3 passos ilustrados (Cole a lista → Buscamos nos fornecedores → Compare e compra)
3. **Para quem é** — cards com personas (Construtora, Empreiteira, Gestor de suprimentos)
4. **Funcionalidades** — grid de features com ícones
5. **Diferenciais** — por que não usar Google, WhatsApp ou planilha
6. **Depoimentos** (quando tiver)
7. **Planos e preços**
8. **FAQ**
9. **CTA final** — "Comece agora, é grátis"

---

## Paleta de cores atual da plataforma

- Primária: `#7c3aed` (purple-700)
- Acento: `#2563eb` (blue-600)
- Background: `#030712` (gray-950)
- Superfície: `#111827` (gray-900)
- Texto principal: `#f3f4f6` (gray-100)
- Texto secundário: `#9ca3af` (gray-400)
