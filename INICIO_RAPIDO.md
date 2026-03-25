# 🚀 Início Rápido - ConstruPrice

## ⚡ Instalação em 3 Passos

### 1️⃣ Instalar Backend Python

```bash
cd backend
.\install.bat
```

Aguarde a instalação das dependências (pode demorar 2-3 minutos).

### 2️⃣ Instalar Frontend Next.js

```bash
cd frontend
npm install
```

### 3️⃣ Iniciar Sistema Completo

**Na raiz do projeto:**
```bash
.\start-all.bat
```

Ou inicie separadamente:

**Backend:**
```bash
cd backend
.\start.bat
```

**Frontend:**
```bash
cd frontend
.\start.bat
```

## 🌐 Acessar Aplicação

Após iniciar, acesse:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentação API**: http://localhost:8000/docs

## 📋 Pré-requisitos

- ✅ **Python 3.10+** instalado
- ✅ **Node.js 18+** instalado
- ✅ **Google Chrome** instalado (para web scraping)

## 🔧 Solução de Problemas

### Backend não inicia

```bash
cd backend
.\install.bat
```

### Frontend não inicia

```bash
cd frontend
npm install
.\start.bat
```

### Porta 8000 ou 3000 já em uso

Feche outros processos usando essas portas ou altere as portas em:
- Backend: `backend/.env` → `API_PORT=8001`
- Frontend: `frontend/package.json` → `"dev": "next dev -p 3001"`

## 📖 Próximos Passos

1. **Cadastrar Fornecedores** - Acesse http://localhost:3000/suppliers
2. **Adicionar Credenciais** - Configure login para lojas que requerem
3. **Ajustar Seletores CSS** - Edite scrapers em `backend/app/scrapers/`
4. **Fazer Busca** - Teste com produtos reais

## 🎯 Estrutura do Projeto

```
pricetracker/
├── backend/          # API Python + Web Scraping
│   ├── app/
│   │   ├── scrapers/   # Scrapers por fornecedor
│   │   ├── api/        # Endpoints FastAPI
│   │   └── models/     # Modelos de dados
│   ├── install.bat     # Instalação automática
│   └── start.bat       # Iniciar backend
│
├── frontend/         # Interface Next.js
│   ├── src/
│   │   ├── pages/      # Páginas da aplicação
│   │   ├── components/ # Componentes React
│   │   └── services/   # Integração com API
│   └── start.bat       # Iniciar frontend
│
└── start-all.bat     # Iniciar tudo junto
```

## 💡 Dicas

- Use `Ctrl+C` para parar os servidores
- Logs do backend aparecem no terminal
- Hot reload ativo em desenvolvimento
- Credenciais são enviadas do frontend para backend

---

**Dúvidas?** Consulte:
- `backend/README.md` - Documentação técnica do backend
- `SETUP_BACKEND.md` - Guia detalhado de configuração
- `frontend/API_README.md` - Documentação da API
