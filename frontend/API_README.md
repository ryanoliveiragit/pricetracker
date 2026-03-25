# API Fake com JSON Server

## 🚀 Como Usar

### ⚡ SCRIPT RÁPIDO (RECOMENDADO)

**Windows - Execute este comando:**
```bash
.\start.bat
```

Este script vai:
1. ✅ Limpar o cache do Next.js automaticamente
2. ✅ Iniciar a API (porta 4001)
3. ✅ Iniciar o Frontend (porta 3000)

**Ou manualmente:**
```bash
# Limpar cache primeiro (IMPORTANTE!)
Remove-Item -Recurse -Force .next

# Depois iniciar os servidores
npm run dev:all
```

### Iniciar a API Fake (Método Manual)

```bash
# Opção 1: Rodar API e Frontend juntos
npm run dev:all

# Opção 2: Rodar separadamente
# Terminal 1 - API
npm run api

# Terminal 2 - Frontend
npm run dev
```

### URLs da API

- **API Base:** `http://localhost:3001`
- **Frontend:** `http://localhost:3003`

---

## 📋 Endpoints Disponíveis

### Fornecedores (Suppliers)

```bash
# Listar todos
GET http://localhost:3001/suppliers

# Buscar por ID
GET http://localhost:3001/suppliers/1

# Criar novo
POST http://localhost:3001/suppliers
Content-Type: application/json

{
  "name": "Novo Fornecedor",
  "url": "https://exemplo.com",
  "requiresLogin": false,
  "isActive": true,
  "region": "Nacional"
}

# Atualizar
PATCH http://localhost:3001/suppliers/1
Content-Type: application/json

{
  "name": "Nome Atualizado"
}

# Deletar
DELETE http://localhost:3001/suppliers/1
```

### Produtos (Products)

```bash
# Listar todos
GET http://localhost:3001/products

# Buscar por ID
GET http://localhost:3001/products/1

# Criar novo
POST http://localhost:3001/products
Content-Type: application/json

{
  "name": "Novo Produto",
  "category": "Categoria",
  "brand": "Marca",
  "unit": "Unidade"
}

# Atualizar
PATCH http://localhost:3001/products/1

# Deletar
DELETE http://localhost:3001/products/1
```

### Resultados de Busca

```bash
# Listar todos os resultados
GET http://localhost:3001/search-results

# Buscar por ID
GET http://localhost:3001/search-results/1
```

### Usuários (Auth)

```bash
# Buscar usuário por email e senha
GET http://localhost:3001/users?email=gestor@construprice.com&password=123456
```

---

## 📊 Dados Mockados

### 5 Fornecedores
1. **Estoque Megaleste** - Nordeste (requer login)
2. **Cofema Materiais** - Nacional
3. **Estoque Atacadista** - Sudeste (requer login)
4. **Constrular** - Sul
5. **Leroy Merlin** - Nacional

### 8 Produtos
1. Cimento Portland CP-II 50kg
2. Tijolo Cerâmico 6 Furos
3. Areia Média Lavada
4. Brita 1
5. Vergalhão CA-50 10mm
6. Tinta Acrílica Branca 18L
7. Piso Cerâmico 45x45cm
8. Argamassa AC-II 20kg

### 3 Resultados de Busca
- Cimento com 3 ofertas
- Tijolo com 2 ofertas
- Areia com 2 ofertas

---

## 🔧 Filtros e Buscas

JSON Server suporta filtros automáticos:

```bash
# Filtrar por campo
GET http://localhost:3001/suppliers?region=Nacional

# Busca parcial
GET http://localhost:3001/products?name_like=Cimento

# Ordenar
GET http://localhost:3001/products?_sort=name&_order=asc

# Paginar
GET http://localhost:3001/products?_page=1&_limit=10

# Múltiplos filtros
GET http://localhost:3001/suppliers?isActive=true&region=Nacional
```

---

## 📝 Integração com Frontend

O serviço `src/services/api.ts` já está configurado:

```typescript
import { suppliersApi, productsApi, searchApi } from '@/services/api';

// Usar nos componentes
const suppliers = await suppliersApi.getAll();
const product = await productsApi.getById('1');
const results = await searchApi.search(['Cimento']);
```

---

## 🎯 Próximos Passos

Para integrar com a aplicação:

1. ✅ API fake rodando
2. ⏳ Atualizar contextos para usar API
3. ⏳ Substituir localStorage por chamadas HTTP
4. ⏳ Adicionar loading states
5. ⏳ Adicionar error handling

---

## 🐛 Troubleshooting

**Erro de CORS:**
- JSON Server já habilita CORS por padrão

**Porta 3001 em uso:**
```bash
# Mudar porta no package.json
"api": "json-server --watch db.json --port 3002"
```

**Dados não persistem:**
- Os dados são salvos em `db.json`
- Edite o arquivo para alterar dados iniciais
