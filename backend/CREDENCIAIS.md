# 🔐 Credenciais de Acesso - ConstruPrice

## Usuários Padrão

### 👨‍💼 Administrador
- **Email**: `admin@construprice.com`
- **Senha**: `admin`
- **Permissões**: Acesso total ao sistema

### 👤 Gestor
- **Email**: `gestor@construprice.com`
- **Senha**: `gestor123`
- **Permissões**: Acesso ao sistema

## 🔗 Endpoints de Autenticação

### POST /api/auth/login

**Request:**
```json
{
  "email": "admin@construprice.com",
  "password": "admin"
}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "user": {
    "email": "admin@construprice.com",
    "name": "Administrador",
    "is_active": true
  },
  "token": "mock-token-admin@construprice.com"
}
```

**Response (Erro):**
```json
{
  "success": false,
  "message": "Email ou senha inválidos"
}
```

### GET /api/auth/users

Lista todos os usuários disponíveis (apenas desenvolvimento).

**Response:**
```json
{
  "users": [
    {
      "email": "admin@construprice.com",
      "password": "admin",
      "name": "Administrador"
    },
    {
      "email": "gestor@construprice.com",
      "password": "gestor123",
      "name": "Gestor"
    }
  ]
}
```

## 🧪 Testar Login

### Via Documentação Swagger

1. Acesse: http://localhost:8000/docs
2. Expanda `POST /api/auth/login`
3. Clique em "Try it out"
4. Cole o JSON:
```json
{
  "email": "admin@construprice.com",
  "password": "admin"
}
```
5. Clique em "Execute"

### Via cURL

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@construprice.com",
    "password": "admin"
  }'
```

### Via Frontend

1. Acesse: http://localhost:3002
2. Faça login com:
   - Email: `admin@construprice.com`
   - Senha: `admin`

## 🔒 Segurança

⚠️ **IMPORTANTE**: Este é um sistema de autenticação simplificado para desenvolvimento.

**Em produção, você deve:**
- ✅ Usar banco de dados real (PostgreSQL, MongoDB)
- ✅ Implementar JWT tokens reais
- ✅ Usar bcrypt para hash de senhas (não SHA256)
- ✅ Adicionar rate limiting
- ✅ Implementar refresh tokens
- ✅ Adicionar 2FA (autenticação de dois fatores)
- ✅ Usar HTTPS obrigatório

## 📝 Adicionar Novos Usuários

Atualmente os usuários estão em memória em `backend/app/utils/auth.py`.

Para adicionar um novo usuário, edite o arquivo e adicione:

```python
USERS_DB = {
    # ... usuários existentes ...
    "novo@construprice.com": {
        "email": "novo@construprice.com",
        "password_hash": hashlib.sha256("senha123".encode()).hexdigest(),
        "name": "Novo Usuário",
        "is_active": True
    }
}
```

**Ou use a função `create_user()` (futuro):**

```python
from app.utils.auth import create_user

create_user(
    email="novo@construprice.com",
    password="senha123",
    name="Novo Usuário"
)
```
