SISTEMA DE COMPARAÇÃO DE PREÇOS – MATERIAIS DE CONSTRUÇÃO
Instruções Iniciais
PAPEL DA IA: Você é um arquiteto de software sênior especializado em aplicações web com foco em scraping, comparação de preços e SaaS B2B. Construa o sistema descrito abaixo seguindo boas práticas de escalabilidade, separação de responsabilidades e código limpo. A cada etapa, pergunte se há dúvidas antes de avançar.

1. Contexto e Problema
Trabalho em um depósito de materiais de construção e vejo diariamente que clientes e empresas perdem tempo buscando o melhor preço entre várias lojas. Esta plataforma resolve isso: o usuário cola uma lista de materiais e recebe, em segundos, uma comparação de preços de múltiplos fornecedores.

2. Objetivo do MVP
Construir uma aplicação web funcional que permita:

Inserir uma lista de materiais (digitando ou colando)

Executar scraping automático em lojas configuradas

Exibir resultados organizados por item, com menor preço destacado

Redirecionar o usuário diretamente para o produto ou carrinho da loja

3. Stack Técnica Recomendada
Camada	Tecnologia
Frontend	React + TypeScript + Tailwind CSS
Backend/API	Node.js (NestJS) ou Python (FastAPI)
Scraping	Python – BeautifulSoup + Playwright/Selenium
Banco de dados	PostgreSQL
Infraestrutura	Docker + Railway ou Vercel
Nota: Se houver conflito de escolha técnica, priorize Python no backend para unificar com o scraping.

4. Arquitetura Geral do Sistema
text
[Frontend React]
      ↓ POST /search (lista de itens)
[API Backend]
      ↓ dispara jobs paralelos
[Scraping Service] → Loja A, Loja B, Loja C...
      ↓ retorna resultados normalizados
[Backend] → agrupa por item, ordena por preço
      ↓
[Frontend] → exibe tabela comparativa
5. Funcionalidades Detalhadas do MVP
5.1 – Input de Materiais
Campo de texto livre (textarea) onde o usuário digita ou cola a lista

Cada linha = 1 item

Suporte a no mínimo 20 itens por pesquisa

Normalização automática do texto antes da busca:

Converter para lowercase

Remover acentos

Tratamento de abreviações comuns

Remover espaços extras

5.2 – Busca Inteligente com Fuzzy Matching
O sistema deve reconhecer variações de escrita do mesmo produto:

Exemplos de variações que devem ser reconhecidas:

text
"ferro 3/8" → "barra de ferro 3/8" → "vergalhão 3/8"
"fita isolante" → "fita isolante 20m" → "fita isolante imperial"
"lampada 9w" → "lâmpada LED 9w" → "lampada branca 9w"
"rejunte" → "argamassa rejunte" → "rejunte cinza"
Implementação:

Usar biblioteca fuzzywuzzy (Python) ou rapidfuzz para backend

Usar fuse.js no frontend como alternativa

Threshold mínimo de match: 70%

Priorizar matches por: (1) score de similaridade, (2) preço menor

5.3 – Web Scraping por Loja
Cada loja deve ter um scraper dedicado em módulo separado:

text
/scrapers
  ├── megaleste.py
  ├── cofema.py
  ├── estoque_atacadista.py
  └── base_scraper.py  ← classe abstrata com interface padrão
Schema de retorno padrão (JSON):

json
{
  "store": "Estoque Megaleste",
  "product_name": "Fita Isolante Imperial 20m PCT/10",
  "price": 50.00,
  "currency": "BRL",
  "url": "https://exemplo.com/produto/123",
  "add_to_cart_url": "https://exemplo.com/carrinho?add=123",
  "availability": "em_estoque",
  "timestamp": "2026-03-16T15:43:00Z"
}
Requisitos gerais dos scrapers:

Timeout máximo: 10 segundos por loja

Se falhar, não travar a busca – retornar status "indisponível"

Executar de forma paralela (não sequencial)

Lidar com mudanças de HTML via seletores CSS + XPath

Manter logs de erros para debugging

5.4 – Gerenciamento de Credenciais por Loja
Algumas lojas exigem login para exibir preços (ex: Estoque Atacadista). O sistema deve:

Funcionalidades:

Tela de configuração de credenciais por loja (username, password)

Armazenar credenciais de forma segura:

Variáveis de ambiente para desenvolvimento

Vault/criptografia para produção

Suportar múltiplas credenciais por região (usuário pode ter acesso em diferentes regiões)

Scraper faz login automático antes de buscar preços

Tratamento de captcha (flag para avisar que não conseguiu fazer login automaticamente)

Ponto Crítico:
⚠️ Antes de implementar o scraper do Estoque Atacadista, perguntar ao Rian (Dev) sobre:

URL de acesso

Credenciais de teste

Se há API alternativa ou apenas scraping

5.5 – Página de Resultados
Exibir os resultados agrupados por item com comparação entre lojas.

Estrutura esperada:

text
ITEM 1: FITA ISOLANTE IMPERIAL 20MTS – PCT/10

┌─────────────────────────┬──────────┬──────────────────────┐
│ Loja                    │ Preço    │ Ação                 │
├─────────────────────────┼──────────┼──────────────────────┤
│ ✅ Estoque Megaleste    │ R$ 50,00 │ [Ver] [Add ao Carr🛒]│
│ Cofema                  │ R$ 60,00 │ [Ver] [Add ao Carr🛒]│
│ MegaLeste 2             │ R$ 70,00 │ [Ver] [Add ao Carr🛒]│
└─────────────────────────┴──────────┴──────────────────────┘

Economia: R$ 20,00 (comparado ao mais caro)
Funcionalidades de exibição:

Menor preço destacado com ✅ e cor diferente (verde)

Link direto para o produto (abre em nova aba)

Botão "Add ao Carrinho" quando disponível no site

Exibir disponibilidade (em estoque / indisponível / por encomenda)

Filtros: Menor Preço | Por Marca | Por Loja

5.6 – Tratamento de Múltiplos Resultados
Se a busca retornar vários produtos para um mesmo item (ex: "fita isolante" gera 10 resultados):

Exibir apenas o melhor resultado por loja:

Calcular score: (fuzzy_match_score × 0.6) + (menor_preço × 0.4)

Retornar resultado com maior score

Incluir botão "Ver outras opções" para expandir os demais resultados

Limitar a 10 alternativas por loja

5.7 – Página Inicial (Homepage)
Logo e nome do projeto

Breve descrição: "Compare preços de materiais de construção em segundos"

Campo de input destacado (focus automático ao carregar)

Exemplos de listas que podem ser pesquisadas

Links para lojas integradas

Botão destacado "Pesquisar"

6. Lojas Integradas no MVP
Loja	URL	Requer Login?	Status
Estoque Megaleste	a confirmar	❓	Desenvolvimento
Cofema	a confirmar	Não	Desenvolvimento
Estoque Atacadista	a confirmar	✅ Sim	Aguardando credenciais do Rian
Nota Importante:

A arquitetura deve permitir adicionar novas lojas apenas criando um novo arquivo em /scrapers/ sem alterar o restante do sistema

Template: copiar estrutura de base_scraper.py e adaptar seletores CSS/XPath

7. Versão Gratuita vs. Premium (Pós-MVP)
MVP não inclui diferenciação, mas arquitetura deve preparar para:
Recurso	Free	Premium
Itens por pesquisa	até 5	ilimitado
Lojas comparadas	2 primeiras	todas
Exportar lista PDF	❌	✅
Histórico de buscas	❌	✅
Enviar por WhatsApp	❌	✅
Salvar comparações	❌	✅
8. Funcionalidades Futuras (NÃO implementar no MVP)
Sistema de login e autenticação de usuários

Histórico de pesquisas do usuário

Importação de lista via arquivo PDF

OCR para foto de lista de materiais

Exportação de lista comparativa em PDF/Excel

Integração com WhatsApp

Sistema de afiliados com lojas

Área de anúncios na plataforma

Notificações de queda de preço

Wishlist e alertas de preço

9. Requisitos Não-Funcionais
Performance
Scraping paralelo (todas as lojas ao mesmo tempo, não sequencial)

Timeout máximo por loja: 10 segundos

Se timeout, mostrar "indisponível" sem travar a busca geral

Cache de produtos por 24 horas (opcional no MVP)

UX/Design
Design responsivo (celular, tablet, desktop)

Tempo de busca máximo: 15 segundos (incluindo timeout)

Interface intuitiva e limpa

Indicador de carregamento durante scraping

Código
Modular e bem comentado

Separação clara de responsabilidades

Fácil de adicionar novos scrapers

Tratamento robusto de erros

Logging detalhado para debugging

Segurança
Credenciais não armazenadas em código fonte

HTTPS obrigatório em produção

Validação de entrada do usuário

Rate limiting (máx 10 buscas/min por IP – futuro)

10. Fluxo de Execução Recomendado
A IA deve construir o sistema etapa por etapa:

Setup Inicial – Estrutura de pastas, dependências, .env

Base de Dados – Schema PostgreSQL para armazenar buscas/resultados

Backend Estrutura – API REST com endpoints básicos

Primeiro Scraper – Implementar scraper para Cofema ou Megaleste

Segundo Scraper – Implementar segundo scraper (base já existe)

Frontend Inicial – Homepage e campo de busca

Integração Frontend-Backend – Conectar pesquisa com API

Página de Resultados – Exibir comparação de preços

Filtros e Ordenação – Adicionar filtros

Tratamento de Erros – Melhorias gerais

Após cada etapa, aguarde confirmação e feedback antes de prosseguir.

11. Pontos Críticos para Clarificação
Antes de começar, a IA deve perguntar:

URLs das lojas – Endereços exatos de cada loja

Credenciais do Estoque Atacadista – Username/password de teste

Seletores CSS/XPath – Se o dev já mapeou as estruturas HTML

Preferência de framework – React vs. Vue para frontend?

Banco de dados – PostgreSQL ou MongoDB?

Hospedagem – Railway, Vercel, outro?

12. Estrutura de Pastas Esperada
text
projeto-precos-materiais/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── search.py
│   │   │       └── stores.py
│   │   ├── scrapers/
│   │   │   ├── base_scraper.py
│   │   │   ├── megaleste.py
│   │   │   ├── cofema.py
│   │   │   └── estoque_atacadista.py
│   │   ├── models/
│   │   │   └── product.py
│   │   └── config.py
│   ├── .env.example
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── ResultsTable.tsx
│   │   │   └── FilterPanel.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   └── Results.tsx
│   │   ├