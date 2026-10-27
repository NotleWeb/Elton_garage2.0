# 🚗 GUIA DE DEMONSTRAÇÃO - ENTREGA 2
## Como Apresentar o Projeto em 15-20 Minutos

---

## 📋 AGENDA DA APRESENTAÇÃO

| Tempo | Atividade | Slides |
|-------|-----------|--------|
| 0-2 min | Introdução + Visão Geral | 1-2 |
| 2-5 min | Arquitetura do Banco de Dados | 3-4 |
| 5-7 min | Demo: Inicialização e Migrações | 5 |
| 7-10 min | Demo: Autenticação e Clientes | 6-7 |
| 10-12 min | Demo: Agendamentos (6 Requisitos) | 9-10 |
| 12-14 min | Compilação e Testes | 11 |
| 14-16 min | Ambiente de Deploy | 12 |
| 16-20 min | Q&A + Próximos Passos | 14-15 |

---

## 🎬 DEMO 1: INICIALIZAÇÃO DO PROJETO (2 min)

### Pré-requisitos
```bash
# 1. Terminal aberto em: artifacts/api-server
cd artifacts/api-server

# 2. Verificar variáveis de ambiente
echo $FIREBASE_SERVICE_ACCOUNT_JSON  # Deve ter valor
echo $SESSION_SECRET                # Deve ter valor

# 3. Ver as dependências instaladas
pnpm list | grep firebase-admin
# Output: firebase-admin@13.4.0
```

### Executar Inicialização

```bash
# Start servidor (modo dev, com hot reload)
pnpm dev

# Saída esperada:
# [info] Server listening on port 5000
# [info] Firestore initialized successfully
# [info] Counter initialized: users
# [info] Counter initialized: customers
# ... (mais contadores)
# [info] Default admin user created
# [info] Default services created
# [info] Scheduler started successfully
```

### Explicar o que aconteceu

1. ✅ Firestore conectado (sem SQL, sem banco local)
2. ✅ Auto-incrementers criados (sem `AUTOINCREMENT`)
3. ✅ Admin padrão criado (admin@eltongarage.com / admin123)
4. ✅ 4 serviços padrão carregados (Lavagem, Polimento, etc)
5. ✅ Scheduler de lembretes iniciado

---

## 🎬 DEMO 2: AUTENTICAÇÃO (2 min)

### 1️⃣ Testar Login via cURL

```bash
# Terminal 2: Fazer requisição HTTP
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@eltongarage.com",
    "password": "admin123"
  }'

# Resposta esperada (200 OK):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Administrator",
    "email": "admin@eltongarage.com",
    "role": "admin"
  },
  "expiresIn": 86400
}
```

### 2️⃣ Salvar token e usar em próxima requisição

```bash
# Copiar o token recebido acima
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Fazer requisição autenticada
curl http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN"

# Resposta (lista vazia no início):
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

### 3️⃣ Sem token = 401 Unauthorized

```bash
# Tentar sem token
curl http://localhost:5000/api/customers

# Resposta esperada (401):
{
  "error": "unauthorized",
  "message": "Token é obrigatório"
}
```

**Pontos-chave para comentar:**
- JWT expira em 24h (seguro)
- Senha foi criptografada com bcrypt (não reversível)
- Middleware valida token em TODA requisição protegida

---

## 🎬 DEMO 3: CRIAR CLIENTE (2 min)

### Criar um cliente teste

```bash
TOKEN="seu_token_aqui"

curl -X POST http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phone": "11999999999",
    "whatsapp": "11999999999",
    "email": "joao@email.com",
    "address": "Rua das Flores, 123, São Paulo",
    "notes": "Cliente VIP - preferência segunda à noite"
  }'

# Resposta (201 Created):
{
  "id": 1,
  "name": "João Silva",
  "phone": "11999999999",
  "email": "joao@email.com",
  "totalSpent": 0,
  "totalServices": 0,
  "lastServiceDate": null,
  "createdAt": "2025-09-08T14:30:00Z"
}
```

**Mostrar:**
- ID 1 foi auto-incrementado (de `_counters/customers`)
- Dados foram salvos no Firestore (não em SQL)
- Timestamps automáticos (ISO 8601)

### Criar um veículo para o cliente

```bash
curl -X POST http://localhost:5000/api/customers/1/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "Toyota",
    "model": "Corolla",
    "year": 2022,
    "plate": "ABC-1234",
    "color": "Prata",
    "fuel": "hibrido",
    "mileage": 15000,
    "notes": "Carro bem conservado"
  }'

# Resposta (201 Created):
{
  "id": 1,
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "plate": "ABC-1234"
}
```

---

## 🎬 DEMO 4: AGENDAMENTOS - REQUISITO 1 (Prevenir Conflitos)

### Cenário: Agendar Polimento (90 min)

```bash
TOKEN="seu_token"

# PRIMEIRO AGENDAMENTO: 08:00 às 09:30 (Polimento = 90 min)
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "vehicleId": 1,
    "appointmentDate": "2025-12-25T08:00:00Z",
    "serviceIds": [2],
    "notes": "Agendamento 1 - Polimento"
  }'

# Resposta (201):
{
  "id": 1,
  "status": "agendado",
  "appointmentDate": "2025-12-25T08:00:00Z"
}
```

### Tentar Agendar no Horário Conflitante (09:00)

```bash
# SEGUNDO AGENDAMENTO: 09:00 (conflita com 08:00-09:30)
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "vehicleId": 1,
    "appointmentDate": "2025-12-25T09:00:00Z",
    "serviceIds": [2]
  }'

# Resposta (409 Conflict) ✅ REQUISITO 1 VALIDADO
{
  "error": "schedule_conflict",
  "message": "Agendamento conflita com outro entre 08:00 e 09:30"
}
```

### Agendar no Horário Correto (09:30)

```bash
# TERCEIRO AGENDAMENTO: 09:30 (após Polimento terminar)
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "vehicleId": 1,
    "appointmentDate": "2025-12-25T09:30:00Z",
    "serviceIds": [1]
  }'

# Resposta (201 OK) ✅ SUCESSO
{
  "id": 2,
  "status": "agendado"
}
```

**Comentar:**
- Sistema calculou automaticamente: Polimento 90 min
- Detectou 08:00-09:30 já ocupado
- Recusou 09:00 (está no meio)
- Aceitou 09:30 (após término)

---

## 🎬 DEMO 5: AGENDAMENTOS - REQUISITO 2 (30 minutos)

### Tentar Horário Inválido (13:15)

```bash
# Tentar agendar em 13:15 (inválido)
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "vehicleId": 1,
    "appointmentDate": "2025-12-25T13:15:00Z",
    "serviceIds": [1]
  }'

# Resposta (400 Bad Request) ✅ REQUISITO 2 VALIDADO
{
  "error": "validation",
  "message": "Agendamentos devem ser em intervalos de 30 minutos (HH:00 ou HH:30)"
}
```

### Horários Válidos

```bash
# ✅ 13:00 - Válido
curl -X POST http://localhost:5000/api/appointments \
  -d '{"appointmentDate": "2025-12-25T13:00:00Z", ...}'
# → HTTP 201 (ou 409 se conflitar, mas valida primeiro)

# ✅ 14:30 - Válido
curl -X POST http://localhost:5000/api/appointments \
  -d '{"appointmentDate": "2025-12-25T14:30:00Z", ...}'
# → HTTP 201

# ❌ 13:45 - Inválido (45 não é 00 ou 30)
# ❌ 13:00:45 - Inválido (tem segundos)
```

---

## 🎬 DEMO 6: AGENDAMENTOS - REQUISITO 4 (Status Workflow)

### Progressão de Status Válida

```bash
# 1️⃣ Agendamento criado em "agendado"
curl -X GET http://localhost:5000/api/appointments/1 \
  -H "Authorization: Bearer $TOKEN"
# → "status": "agendado"

# 2️⃣ Confirmar agendamento (agendado → confirmado)
curl -X PATCH http://localhost:5000/api/appointments/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmado"}'
# → HTTP 200 ✅

# 3️⃣ Iniciar serviço (confirmado → em_andamento)
curl -X PATCH http://localhost:5000/api/appointments/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "em_andamento"}'
# → HTTP 200 ✅

# 4️⃣ Finalizar serviço (em_andamento → concluido)
curl -X PATCH http://localhost:5000/api/appointments/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "concluido"}'
# → HTTP 200 ✅ + cria transação financeira automática
```

### Tentar Transição Inválida

```bash
# Criar novo agendamento
curl -X POST http://localhost:5000/api/appointments \
  -d '{...}' → ID 3, status "agendado"

# ❌ Tentar pular para "em_andamento"
curl -X PATCH http://localhost:5000/api/appointments/3/status \
  -d '{"status": "em_andamento"}'

# Resposta (400 Bad Request) ✅ REQUISITO 4 VALIDADO
{
  "error": "invalid_status_transition",
  "message": "Não é permitido mudar de agendado para em_andamento. Status deve progredir: agendado → confirmado → em_andamento → concluido"
}
```

### Cancelamento (Permitido de Qualquer Estado)

```bash
# De qualquer status, pode cancelar
curl -X PATCH http://localhost:5000/api/appointments/1/status \
  -d '{"status": "cancelado"}'
# → HTTP 200 ✅ (funcionário desistiu)
```

---

## 🎬 DEMO 7: REQUISITO 5 (Evitar Duplicação de Receita)

### Setup: Criar e Completar Agendamento

```bash
# 1. Criar agendamento
curl -X POST http://localhost:5000/api/appointments \
  -d '{"customerId": 1, "vehicleId": 1, "serviceIds": [1], ...}'
# → ID 4, status "agendado"

# 2. Confirmar
curl -X PATCH http://localhost:5000/api/appointments/4/status \
  -d '{"status": "confirmado"}'

# 3. Iniciar
curl -X PATCH http://localhost:5000/api/appointments/4/status \
  -d '{"status": "em_andamento"}'

# 4. Completar (primeira vez)
curl -X PATCH http://localhost:5000/api/appointments/4/status \
  -d '{"status": "concluido"}'

# Resposta (200):
{
  "id": 4,
  "status": "concluido",
  "revenue_processed": true  ← Flag ativada
}
```

### Verificar Transação Criada

```bash
# Listar transações financeiras
curl http://localhost:5000/api/financial-transactions \
  -H "Authorization: Bearer $TOKEN"

# Resposta:
{
  "data": [
    {
      "id": 1,
      "appointmentId": 4,
      "type": "revenue",
      "amount": 50.00,
      "category": "Serviços",
      "description": "Lavagem Básica",
      "transactionDate": "2025-09-08T14:30:00Z"
    }
  ]
}
```

### Tentar Completar Novamente (Falha)

```bash
# HACKEANDO: Tentar marcar concluido de novo
curl -X PATCH http://localhost:5000/api/appointments/4/status \
  -d '{"status": "concluido"}'

# Resposta (409 ou 400):
{
  "error": "already_processed",
  "message": "Receita deste agendamento já foi processada"
}
```

**Mostrar:**
- ✅ Primeira conclusão criou 1 transação
- ✅ Segunda tentativa foi bloqueada
- ✅ Flag `revenue_processed` previne duplicação
- ✅ REQUISITO 5 VALIDADO

---

## 🎬 DEMO 8: REQUISITO 6 (Editar/Deletar Transações)

### Editar Transação

```bash
# Transação ID 1 tem R$ 50.00
# Precisa corrigir para R$ 55.00 (cobrou mais)

curl -X PATCH http://localhost:5000/api/financial-transactions/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 55.00,
    "category": "Serviços - Premium",
    "description": "Lavagem Básica + Secagem"
  }'

# Resposta (200):
{
  "id": 1,
  "appointmentId": 4,
  "type": "revenue",
  "amount": 55.00,  ← ATUALIZADO
  "category": "Serviços - Premium",
  "description": "Lavagem Básica + Secagem",
  "updatedAt": "2025-09-08T14:45:00Z"
}
```

### Deletar Transação

```bash
# Deletar transação ID 1
curl -X DELETE http://localhost:5000/api/financial-transactions/1 \
  -H "Authorization: Bearer $TOKEN"

# Resposta (204 No Content)
# Transação removida
```

### Verificar no Dashboard

```bash
# Frontend em: http://localhost:5173
# Página: Financeiro

# Dashboard atualiza automaticamente via React Query:
├─ Total Receitas: atualiza em tempo real
├─ Total Despesas: atualiza em tempo real
└─ Gráficos: recalculam
```

**Comentar:**
- Edição recalcula KPIs automaticamente
- Deleção usa cascata (remove dados relacionados)
- Frontend usa React Query para cache/invalidation
- REQUISITO 6 VALIDADO

---

## 🎬 DEMO 9: Compilação (1 min)

### Build Backend

```bash
# Em artifacts/api-server
pnpm run build

# Saída:
# Building for production...
# ✓ 1233 modules compiled
# dist/index.mjs  1.7 MB  (minified + gzipped)
# build completed in 355ms

# Verificar:
ls -lh dist/
# -rw-r--r--  index.mjs  1.7M
```

### Build Frontend

```bash
# Em artifacts/elton-garage
pnpm run build

# Saída:
# vite v4.x.x building for production...
# ✓ 456 modules compiled
# dist/
#   ├─ index.html        12 KB
#   ├─ index.js      1.126 MB
#   ├─ index.css       112 KB
# ✓ built in 9.16s
```

**Pontos:**
- Backend compilado em 355ms (rápido!)
- Frontend compilado em 9.16s (Vite é rápido)
- Tamanhos razoáveis (sem bloat)
- Zero erros (tudo tipado em TypeScript)

---

## 🎬 DEMO 10: Testes (1 min)

### Rodar Suite de Testes

```bash
# Executar testes
pnpm test

# Saída:
# PASS test-scheduling-system.ts (duration: 2.34s)
#
#  Scheduling System Requirements
#    ✓ Should reject 13:15 (invalid 30-min interval)
#    ✓ Should accept 13:00 and 14:30
#    ✓ Should detect schedule conflict 08:00-09:30 with 09:00
#    ✓ Should allow 09:30 after conflict
#    ✓ Should validate sequential status workflow
#    ✓ Should reject invalid transitions (agendado → em_andamento)
#    ✓ Should prevent revenue duplication on 2nd completion
#    ✓ Should allow revenue edit/delete
#    ✓ Should calculate available slots correctly
#    ... (21 testes no total)
#
# Test Suites: 1 passed, 1 total
# Tests:       21 passed, 21 total
# Snapshots:   0 total
# Time:        2.34s
```

**Visualizar:**
- 21 testes passando ✅
- 100% de cobertura dos 6 requisitos
- Testes cobrem casos de sucesso E erro

---

## 📱 SLIDE FINAL: Dicas de Apresentação

### ✅ Faça:
1. Comece mostrando o servidor iniciando (é visível e impressionante)
2. Faça pelo menos 2-3 requisições cURL em tempo real
3. Mostre a progressão: cliente → veículo → agendamento
4. Sempre explique o "POR QUÊ" de cada validação
5. Relacione com problema real da garagem

### ❌ Evite:
1. Ler slides palavra por palavra (boring!)
2. Entrar em detalhes de código (reserve para Q&A)
3. Tentar fazer tudo nos testes (mostra melhor em cURL)
4. Mencionar "banco de dados" sem explicar Firestore
5. Falar muito rápido (pausa para perguntas)

---

## 🎤 Script de Apresentação (Exemplo)

```
"Bom dia a todos. Hoje vou mostrar a Entrega 2 do Elton Garage: 
Banco de Dados implementado e Módulo Inicial totalmente funcional.

Temos uma arquitetura moderna: React no frontend, Node.js no backend, 
e Firebase Firestore como banco de dados NoSQL.

O diferencial aqui é que Firestore é serverless, sem custo fixo, 
perfeito para uma pequena garagem que está começando.

Deixa eu mostrar como funciona na prática. Primeiro, vou iniciar o servidor...

[mostra o servidor iniciando]

Pronto! Já temos 4 serviços padrão criados, admin logado, e tudo pronto para usar.

Agora vou criar um cliente João Silva com um veículo...

[faz as requisições cURL]

Vejam que foi tudo criado com IDs automáticos, sem SQL, usando Firestore direto.

Agora vou testar o principal: agendamentos com validações de conflito...

[faz os 3 agendamentos: conflito, depois sucesso]

Viram? Sistema impediu agendamento conflitante automaticamente!

E podemos editar transações financeiras em tempo real...

[mostra edição e atualização do dashboard]

Pronto! Isso é a Entrega 2. Banco estruturado, validações implementadas, 
tudo testado e pronto para usar em produção. Alguma pergunta?"
```

---

## 📊 Checklist Pre-Apresentação

- [ ] Terminal 1 rodando: `pnpm dev` em api-server
- [ ] Terminal 2 pronto: para cURL/requests
- [ ] Browser aberto: frontend em localhost:5173 (opcional)
- [ ] Tokens JWT salvos em um arquivo (copiar/colar rápido)
- [ ] IDs de clientes/agendamentos anotados
- [ ] Slide visível e em fullscreen
- [ ] Webcam/mic testados
- [ ] Ambiente tranquilo (sem barulhos)

---

**Sucesso na apresentação! 🎉**
