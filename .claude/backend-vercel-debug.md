# Backend Vercel Debug - Estado Atual

## Projeto
- Backend: https://pricetracker-rxdw.vercel.app
- Repo: ryanoliveiragit/pricetracker (branch main)
- Projeto Vercel: prj_6KRk1jhx1bAoBkY82OFDP0l7hTW6 (team: team_ddvcrU1mdvPM1MfSzRuRmNqp)

## Problema
Backend retorna 500 INTERNAL_SERVER_ERROR em todas as rotas.
Erro nos logs Vercel: `could not import "main.py"` (truncado, erro completo desconhecido).

## O que sabemos
- Framework do projeto Vercel: `fastapi` (detectado automaticamente)
- Quando `functions` format no vercel.json → Python É buildado (lambdaRuntimeStats: python:1)
- Quando `builds` format → Python NÃO é buildado (59ms, sem pacotes)
- Cache de 36MB confirma pacotes instalando corretamente
- `backend/requirements.txt` é lido automaticamente pelo Vercel FastAPI preset
- A falha é em RUNTIME, não no build

## Arquivos modificados nessa sessão
- `vercel.json` → formato `functions` com `main.py` + `includeFiles: backend/**`
- `main.py` (novo na raiz) → último commit é teste MINIMAL (só FastAPI puro)
- `backend/main.py` → adicionado sys.path no início
- `backend/app/database.py` → SSL fix: `supabase.` em vez de `supabase.co`
- `backend/requirements.txt` → removido selenium e webdriver-manager
- `api/index.py` (novo) → bridge file (não usado mais pelo vercel.json atual)

## Estado atual do vercel.json
```json
{
  "functions": {
    "main.py": {
      "runtime": "python3.11",
      "maxDuration": 60,
      "memory": 1024,
      "includeFiles": "backend/**"
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "main.py" }
  ]
}
```

## Último commit deployado (aguardando resultado)
`9ce757d debug: minimal FastAPI to test Vercel runtime`

`main.py` na raiz contém apenas:
```python
from fastapi import FastAPI
app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok", "version": "minimal"}
```

## Próximos passos
1. Testar https://pricetracker-rxdw.vercel.app/health após deploy do commit 9ce757d
   - Se 200 → Vercel funciona, o problema é na importação do backend
     → Próximo passo: adicionar imports do backend gradualmente para achar o que quebra
   - Se 500 → Problema fundamental com o projeto/framework preset
     → Verificar no Dashboard Vercel: Settings > Framework > mudar para "Other" ou "Python"

2. Env vars já configuradas no Vercel (confirmado pelo usuário):
   - DATABASE_URL = postgresql+asyncpg://postgres.nepwcsxyasvlftsjmzku:...@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
   - Outras vars de acordo com backend/app/config.py

## Suspeitos do erro de import
- `psycopg2-binary` (pode ter incompatibilidade de wheel no Lambda)
- Algum módulo que tenta conexão na inicialização
- O `lifespan` do APScheduler rodando no cold start

## Solução final provável
Após confirmar que FastAPI minimal funciona:
1. main.py na raiz importa backend com sys.path correto
2. Se lifespan crashar → tornar startup gracioso (try/except no lifespan)
3. Se psycopg2 crashar → remover do requirements (não é usado diretamente)
