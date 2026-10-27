# 📝 REFERÊNCIA RÁPIDA & DADOS DE TESTE
## Entrega 2 - Elton Garage 2.0

---

## 🔐 CREDENCIAIS DE ACESSO

### Admin Padrão (Criado Automaticamente)
```json
{
  "email": "admin@eltongarage.com",
  "password": "admin123",
  "role": "admin"
}
```

### Como Obter Token JWT

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eltongarage.com","password":"admin123"}'

# 2. Copiar token da resposta
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZWx0b25nYXJhZ2UuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjI1ODg4MDAwLCJleHAiOjE2MjU5NzQ0MDB9.abc123xyz..."

# 3. Usar em todas as requisições
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
curl http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 DADOS DE TESTE PRÉ-PRONTOS

### 1️⃣ Cliente Teste

**POST /api/customers**
```json
{
  "name": "João Silva Santos",
  "phone": "11999999999",
  "whatsapp": "11999999999",
  "email": "joao.silva@email.com",
  "address": "Rua das Flores, 123, São Paulo - SP",
  "notes": "Cliente VIP, preferência segunda à noite"
}
```

**Resposta esperada (HTTP 201):**
```json
{
  "id": 1,
  "name": "João Silva Santos",
  "phone": "11999999999",
  "email": "joao.silva@email.com",
  "totalSpent": 0,
  "totalServices": 0,
  "lastServiceDate": null,
  "createdAt": "2025-09-08T14:30:00.123Z",
  "updatedAt": "2025-09-08T14:30:00.123Z"
}
```

---

### 2️⃣ Veículo Teste

**POST /api/customers/1/vehicles**
```json
{
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "plate": "ABC-1234",
  "color": "Prata Metálica",
  "fuel": "hibrido",
  "mileage": 15000,
  "notes": "Carro bem conservado, primeiro serviço"
}
```

**Resposta esperada (HTTP 201):**
```json
{
  "id": 1,
  "customerId": 1,
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "plate": "ABC-1234",
  "color": "Prata Metálica",
  "fuel": "hibrido",
  "mileage": 15000,
  "notes": "Carro bem conservado, primeiro serviço"
}
```

---

### 3️⃣ Serviços Padrão (Criados Automaticamente)

| ID | Nome | Duração | Preço | Categoria |
|----|------|---------|-------|-----------|
| 1 | Lavagem Básica | 30 min | R$ 50 | lavagem |
| 2 | Polimento | 60 min | R$ 120 | polimento |
| 3 | Proteção Cerâmica | 120 min | R$ 350 | proteção |
| 4 | Limpeza Interna | 45 min | R$ 80 | limpeza |

---

### 4️⃣ Agendamento Teste (SEM CONFLITO)

**POST /api/appointments**
```json
{
  "customerId": 1,
  "vehicleId": 1,
  "appointmentDate": "2025-12-25T08:00:00Z",
  "serviceIds": [2],
  "notes": "Polimento completo com proteção"
}
```

**Resposta esperada (HTTP 201):**
```json
{
  "id": 1,
  "customerId": 1,
  "vehicleId": 1,
  "appointmentDate": "2025-12-25T08:00:00Z",
  "status": "agendado",
  "notes": "Polimento completo com proteção",
  "revenueProcessed": false,
  "createdAt": "2025-09-08T14:30:00.123Z",
  "updatedAt": "2025-09-08T14:30:00.123Z"
}
```

---

### 5️⃣ Agendamento CONFLITANTE (Deve Falhar)

**POST /api/appointments**
```json
{
  "customerId": 1,
  "vehicleId": 1,
  "appointmentDate": "2025-12-25T09:00:00Z",
  "serviceIds": [1]
}
```

**Resposta esperada (HTTP 409 Conflict):**
```json
{
  "error": "schedule_conflict",
  "message": "Agendamento conflita com outro entre 08:00 e 09:30",
  "conflictsWith": {
    "appointmentId": 1,
    "startTime": "2025-12-25T08:00:00Z",
    "endTime": "2025-12-25T09:30:00Z"
  }
}
```

---

### 6️⃣ Horário Inválido (Deve Falhar)

**POST /api/appointments**
```json
{
  "customerId": 1,
  "vehicleId": 1,
  "appointmentDate": "2025-12-25T13:15:00Z",
  "serviceIds": [1]
}
```

**Resposta esperada (HTTP 400 Bad Request):**
```json
{
  "error": "validation",
  "message": "Agendamentos devem ser em intervalos de 30 minutos (HH:00 ou HH:30)"
}
```

---

## 🔄 FLUXO DE STATUS

### Transição Válida (Agendamento ID 1)

```bash
# 1. Estado inicial (criado)
GET /api/appointments/1
# → "status": "agendado"

# 2. Confirmar
PATCH /api/appointments/1/status
# {"status": "confirmado"}
# → 200 OK ✅

# 3. Iniciar
PATCH /api/appointments/1/status
# {"status": "em_andamento"}
# → 200 OK ✅

# 4. Concluir
PATCH /api/appointments/1/status
# {"status": "concluido"}
# → 200 OK ✅ + cria transação financeira

# 5. Verificar transação criada
GET /api/financial-transactions
# → mostra receita de R$ 120 (preço do Polimento)
```

---

### Transição Inválida (Deve Falhar)

```bash
# Criar novo agendamento
POST /api/appointments
# → ID: 2, status: "agendado"

# ❌ Tentar pular para em_andamento
PATCH /api/appointments/2/status
# {"status": "em_andamento"}
# → HTTP 400
# "Não é permitido mudar de agendado para em_andamento"
```

---

## 💰 TRANSAÇÕES FINANCEIRAS

### Criar Transação Manual (Revenue)

**POST /api/financial-transactions**
```json
{
  "appointmentId": 1,
  "customerId": 1,
  "type": "revenue",
  "amount": 120.00,
  "category": "Serviços - Polimento",
  "description": "Polimento de veículo completo"
}
```

---

### Editar Transação

**PATCH /api/financial-transactions/1**
```json
{
  "amount": 150.00,
  "category": "Serviços - Polimento Premium",
  "description": "Polimento de veículo + aplicação de cera"
}
```

---

### Deletar Transação

**DELETE /api/financial-transactions/1**
```
→ 204 No Content
```

---

## 📊 ENDPOINTS DE LEITURA (SEM AUTENTICAÇÃO NECESSÁRIA EM DEV)

```bash
# Listar clientes
GET /api/customers?page=1&limit=20&search="Silva"

# Detalhar cliente
GET /api/customers/1

# Listar agendamentos
GET /api/appointments?status=agendado

# Listar serviços
GET /api/services?isActive=true

# Listar transações
GET /api/financial-transactions

# Health check
GET /api/health
```

---

## ⏰ HORÁRIOS VÁLIDOS PARA TESTES

Use estas combinações de data/hora:

```javascript
// Data teste: 2025-12-25 (natal)

// VÁLIDOS ✅
"2025-12-25T08:00:00Z"   // 08:00
"2025-12-25T08:30:00Z"   // 08:30
"2025-12-25T09:00:00Z"   // 09:00
"2025-12-25T09:30:00Z"   // 09:30
"2025-12-25T10:00:00Z"   // 10:00
"2025-12-25T14:00:00Z"   // 14:00
"2025-12-25T14:30:00Z"   // 14:30
"2025-12-25T15:00:00Z"   // 15:00

// INVÁLIDOS ❌
"2025-12-25T08:15:00Z"   // :15 minutos
"2025-12-25T08:45:00Z"   // :45 minutos
"2025-12-25T08:00:30Z"   // com segundos
```

---

## 📈 EXEMPLO DE TIMELINE COM CONFLITO

```
╔═══════════════════════════════════════════════════════════════╗
║           AGENDAMENTOS DO DIA 25/12/2025                      ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  08:00 ┌──────────────────────────────┐                       ║
║        │ Agendamento 1: POLIMENTO     │ Duração: 90 min      ║
║        │ (Serviço ID 2 = 60 min)      │                      ║
║        │ Cliente: João Silva          │                      ║
║  09:00 │ Status: confirmado           │                      ║
║        │ Valor: R$ 120                │                      ║
║  09:30 └──────────────────────────────┘                       ║
║        ├─ X ❌ Agendamento 2: 09:00 (CONFLITA)               ║
║        │  Tentativa de Lavagem                              ║
║        │  Status: REJEITADO (HTTP 409)                       ║
║        │                                                      ║
║  09:30 ┌──────────────────┐                                  ║
║        │ Agendamento 3:   │ Duração: 30 min                 ║
║        │ LAVAGEM BÁSICA   │ Status: agendado                ║
║  10:00 │ Cliente: João    │ Valor: R$ 50                    ║
║        │ Silva            │                                  ║
║        └──────────────────┘                                  ║
║                                                               ║
║  14:00 ┌──────────────────┐                                  ║
║        │ Agendamento 4:   │ Duração: 45 min                 ║
║        │ LIMPEZA INTERNA  │ Status: agendado                ║
║  14:45 │ Cliente: Maria   │ Valor: R$ 80                    ║
║        │ Santos           │                                  ║
║        └──────────────────┘                                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🎯 CHECKLIST RÁPIDO (Para Apresentação)

**Antes de começar:**
- [ ] Backend rodando em http://localhost:5000
- [ ] Frontend rodando em http://localhost:5173
- [ ] Token JWT copiado e pronto
- [ ] Terminal 2 aberto para cURL
- [ ] Browser com Postman ou similar (opcional)

**Durante apresentação:**
- [ ] ✅ Mostrar servidor iniciando
- [ ] ✅ Fazer login (GET token)
- [ ] ✅ Criar cliente
- [ ] ✅ Criar veículo
- [ ] ✅ Criar agendamento 1 (sucesso)
- [ ] ✅ Criar agendamento 2 (conflito)
- [ ] ✅ Tentar horário inválido (13:15)
- [ ] ✅ Fluxo de status (agendado → concluido)
- [ ] ✅ Editar transação
- [ ] ✅ Ver testes passando

**Pontos-chave a mencionar:**
- [ ] Firestore é NoSQL (sem SQL)
- [ ] Auto-increment via _counters
- [ ] JWT por 24h (seguro)
- [ ] Validações em tempo real
- [ ] Backend compila em 355ms
- [ ] Frontend compila em 9.16s
- [ ] 21 testes, 100% passando

---

## 🔧 TROUBLESHOOTING RÁPIDO

### Problema: "Firestore initialization failed"
```bash
# Solução: Verificar variável de ambiente
echo $FIREBASE_SERVICE_ACCOUNT_JSON
# Deve ter um JSON válido

# Se vazio, adicionar:
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

### Problema: "Token inválido"
```bash
# Solução: Gerar novo token
curl -X POST http://localhost:5000/api/auth/login \
  -d '{"email":"admin@eltongarage.com","password":"admin123"}'

# Token expira em 24h
```

### Problema: "Agendamento não criado"
```bash
# Verificar:
1. Horário em intervalo de 30 min (HH:00 ou HH:30)
2. Customer ID existe
3. Vehicle ID existe
4. Service IDs válidos
5. Sem conflito com outro agendamento
```

### Problema: "Transação criada mas receita não somou"
```bash
# Verificar:
1. Agendamento foi marcado como "concluido"
2. revenue_processed está true
3. Dashboard atualizar (F5)
```

---

## 📱 URLS E PORTAS

| Serviço | URL | Porta |
|---------|-----|-------|
| Frontend (React) | http://localhost:5173 | 5173 |
| Backend (API) | http://localhost:5000 | 5000 |
| Firebase | https://console.firebase.google.com | HTTPS |
| Render (Prod) | https://api.render.com | HTTPS |
| Netlify (Prod) | https://elton-garage.netlify.app | HTTPS |

---

## 📚 ARQUIVOS IMPORTANTES

```
artifacts/
├─ api-server/              ← Backend Node.js
│  ├─ src/
│  │  ├─ db.ts              ← Firestore init + helpers
│  │  ├─ index.ts           ← Entry point
│  │  ├─ routes/
│  │  │  ├─ customers.ts    ← CRUD clientes
│  │  │  ├─ appointments.ts ← Agendamentos (6 requisitos)
│  │  │  ├─ auth.ts         ← JWT login
│  │  │  └─ ... (mais rotas)
│  │  └─ middleware/
│  │     └─ auth.ts         ← Verificação JWT
│  ├─ build.mjs             ← Script de build (esbuild)
│  └─ package.json          ← Dependências
│
└─ elton-garage/            ← Frontend React
   ├─ src/
   │  ├─ App.tsx            ← Componente raiz
   │  ├─ main.tsx           ← Entry point
   │  ├─ pages/
   │  │  ├─ Login.tsx       ← Autenticação
   │  │  ├─ Dashboard.tsx   ← KPIs
   │  │  ├─ Agendamentos.tsx← Agendamentos
   │  │  ├─ Clientes.tsx    ← Clientes
   │  │  ├─ Financeiro.tsx  ← Transações
   │  │  └─ ... (mais páginas)
   │  ├─ components/        ← Componentes reutilizáveis
   │  └─ hooks/             ← Custom React Hooks
   ├─ vite.config.ts        ← Configuração Vite
   └─ package.json          ← Dependências
```

---

## 🎓 RESUMO DE CONCLUSÃO

```
┌──────────────────────────────────────────────────────┐
│  ENTREGA 2 - ELTON GARAGE 2.0                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ✅ Modelagem de banco: 13 coleções Firestore      │
│  ✅ Migrações automáticas: sem scripts SQL         │
│  ✅ Módulo inicial: Auth + Clientes + Serviços    │
│  ✅ 6 requisitos de agendamento implementados     │
│  ✅ Backend pronto para produção (355ms build)    │
│  ✅ Frontend pronto para produção (9.16s build)   │
│  ✅ 21 testes automatizados (100% pass)           │
│  ✅ Documentação completa (18 slides)             │
│                                                      │
│  STATUS: PRONTO PARA APRESENTAR 🎉                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

**Última atualização: 08/09/2025**
**Documento de referência para apresentação - Entrega 2**
