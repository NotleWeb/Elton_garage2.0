# ✅ CHECKLIST FINAL - IMPRESSÃO RECOMENDADA
## Use este documento durante a apresentação

---

## 🎯 CHECKLIST PRÉ-APRESENTAÇÃO (Imprima isto!)

```
PREPARAÇÃO DO AMBIENTE (24h antes)
═══════════════════════════════════════════════════════════════

[ ] Leitura de Preparação
    [ ] Ler RESUMO_EXECUTIVO_ENTREGA2.md (15 min)
    [ ] Ler ROTEIRO_VISUAL_SLIDES.md (30 min)
    [ ] Estudar GUIA_DEMONSTRACAO_ENTREGA2.md (1 hora)

[ ] Materiais Técnicos
    [ ] Abrir APRESENTACAO_ENTREGA2.md em PDF/Markdown
    [ ] Abrir REFERENCIA_RAPIDA_TESTES.md em navegador
    [ ] Clonar repositório git
    [ ] Ter Node.js 20+ instalado
    [ ] Ter pnpm instalado

[ ] Testes Locais
    [ ] cd artifacts/api-server
    [ ] pnpm install
    [ ] Verificar variáveis de ambiente (Firebase)
    [ ] pnpm dev → servidor inicia sem erros
    [ ] Terminal 2: testar GET http://localhost:5000/api/health
    [ ] Testar login com cURL
    [ ] Testar criar cliente
    [ ] Testar agendamento

[ ] Preparação de Slides
    [ ] Criar slides em PowerPoint/Google (opcional)
    [ ] OU imprimir ROTEIRO_VISUAL_SLIDES.md
    [ ] Testar projetor/monitor
    [ ] Testar webcam/microfone
    [ ] Testar internet/WiFi

[ ] Ambiente Físico
    [ ] Computador com bateria carregada
    [ ] Carregador à mão
    [ ] Adaptador HDMI/USB-C
    [ ] Clicker remoto (opcional)
    [ ] Garrafa d'água
    [ ] Respira fundo 😊


SETUP 30 MINUTOS ANTES
═══════════════════════════════════════════════════════════════

[ ] Terminal Setup
    [ ] Terminal 1 aberto em: artifacts/api-server
    [ ] Executar: pnpm dev
    [ ] Aguardar: "Server listening on port 5000"
    [ ] Copiar para Notepad:
        Token JWT: [deixe em branco, vai gerar]
        Customer ID: 1
        Vehicle ID: 1
        Appointment ID: 1

[ ] Dados de Teste
    [ ] Abrir REFERENCIA_RAPIDA_TESTES.md em navegador
    [ ] Copiar credenciais admin: admin@eltongarage.com / admin123
    [ ] Terminal 2 pronto (ou outra aba de terminal)
    [ ] Testar: curl http://localhost:5000/api/health
    [ ] Testar: curl -X POST /auth/login (copiar do REFERENCIA)

[ ] Documentação
    [ ] RESUMO_EXECUTIVO_ENTREGA2.md aberto
    [ ] ROTEIRO_VISUAL_SLIDES.md aberto (como cola)
    [ ] GUIA_DEMONSTRACAO_ENTREGA2.md aberto (como cola)
    [ ] REFERENCIA_RAPIDA_TESTES.md aberto (como cola)
    [ ] Este checklist (VERIFICAR ITENS)

[ ] Apresentação
    [ ] Slides em fullscreen pronto
    [ ] Presentação será em qual app? ___________
    [ ] Duração esperada: _____ minutos
    [ ] Audiência: _________________________ (quantas pessoas)
    [ ] Sala/local: _________________________


DURANTE A APRESENTAÇÃO
═══════════════════════════════════════════════════════════════

TIMING DE APRESENTAÇÃO

⏱️ 0-2 min │ INTRODUÇÃO (Slide 1-2)
   [ ] Cumprimentar audiência
   [ ] Apresentar projeto: "Elton Garage 2.0"
   [ ] Tema da entrega 2: "Banco de Dados e Módulo Inicial"
   [ ] Frase-chave: "Tudo pronto para produção!"

⏱️ 2-5 min │ ARQUITETURA (Slide 3-4)
   [ ] Explicar stack: React + Express + Firestore
   [ ] Mostrar slide de arquitetura
   [ ] Frase-chave: "Firestore é serverless, sem custo fixo"
   [ ] Frase-chave: "13 coleções estruturadas"

⏱️ 5-7 min │ INICIALIZAÇÃO + DEMO 1 (Slide 5)
   [ ] Mostrar Terminal 1 (backend rodando)
   [ ] Explicar: "Tudo automático, sem scripts SQL"
   [ ] DEMO: Rodar pnpm dev (se não estiver rodando)
   [ ] Mostrar logs de inicialização
   [ ] Pausar para que vejam

⏱️ 7-9 min │ AUTENTICAÇÃO + DEMO 2 (Slide 6)
   [ ] Explicar: "JWT com bcrypt"
   [ ] DEMO: Fazer login com cURL
   [ ] Copiar token do REFERENCIA_RAPIDA ou Terminal
   [ ] Colar em Notepad "Token: eyJhbG..."
   [ ] Frase-chave: "Token expira em 24h"

⏱️ 9-10 min │ CLIENTES + DEMO 3 (Slide 7)
   [ ] DEMO: Criar cliente com POST /customers
   [ ] Copiar JSON do REFERENCIA_RAPIDA
   [ ] Mostrar resposta com ID auto-incrementado (id: 1)
   [ ] Comentar: "Sem SQL, sem migration!"

⏱️ 10-11 min │ AGENDAMENTOS REQUISITO 1 + DEMO 4 (Slide 8)
   [ ] DEMO: Criar agendamento 1 (08:00 - Polimento)
   [ ] DEMO: Tentar agendamento 2 (09:00 - CONFLITO)
   [ ] Mostrar HTTP 409
   [ ] Frase-chave: "Sistema detectou conflito!"

⏱️ 11-12 min │ AGENDAMENTOS REQUISITO 2 + DEMO 5 (Slide 9)
   [ ] DEMO: Tentar agendamento em 13:15 (inválido)
   [ ] Mostrar HTTP 400
   [ ] Frase-chave: "Só aceita :00 ou :30 minutos"

⏱️ 12-13 min │ AGENDAMENTOS REQUISITO 4 + DEMO 6 (Slide 10)
   [ ] Explicar workflow: agendado → confirmado → concluido
   [ ] DEMO: Fazer 4 PATCHs sucessivos
   [ ] Mostrar erro ao pular etapa
   [ ] Frase-chave: "Fluxo sequencial garante integridade"

⏱️ 13-14 min │ BUILD & TESTES (Slide 13)
   [ ] Mostrar: "Backend: 355ms, 1.7 MB"
   [ ] Mostrar: "Frontend: 9.16s, 1.2 MB"
   [ ] Mostrar: "21 testes: 100% pass"
   [ ] Frase-chave: "Zero erros, pronto para produção"

⏱️ 14-15 min │ RESUMO (Slide 14-16)
   [ ] Revisar 6 requisitos (todos ✅)
   [ ] Mostrar números do projeto
   [ ] Mencionar: "Próxima entrega: UI/UX + Mobile"

⏱️ 15-20 min │ Q&A (Slide 17-18)
   [ ] Abrir para perguntas
   [ ] Se pergunta técnica, citar arquivo:
       "Veja APRESENTACAO_ENTREGA2.md, Slide X"
   [ ] Se pergunta sobre dados:
       "Veja REFERENCIA_RAPIDA_TESTES.md"
   [ ] Se pergunta sobre demos:
       "Veja GUIA_DEMONSTRACAO_ENTREGA2.md"
   [ ] Finalizar: "Obrigado pela atenção!"


RESPOSTAS RÁPIDAS
═══════════════════════════════════════════════════════════════

P: Por que Firestore?
R: [Frase pronta] "Sem servidor, grátis até 1 GB, fácil escalar"

P: Como funciona auto-increment?
R: [Frase pronta] "Coleção _counters com transações atômicas"

P: Está seguro?
R: [Frase pronta] "JWT + bcrypt + middleware em todas rotas"

P: Quando posso usar em produção?
R: [Frase pronta] "Agora! 15 minutos de setup apenas"

P: Qual é o custo?
R: [Frase pronta] "Grátis no plano Spark até 1 GB + 50k leituras/dia"

P: Como adiciono novos campos?
R: [Frase pronta] "Firestore é schema-less, sem migrations necessárias"

---SE NÃO SOUBER UMA RESPOSTA---
[ ] Diga: "Ótima pergunta! Vou verificar e retorno"
[ ] Consulte o documento apropriado discretamente
[ ] OU diga: "Essa funcionalidade será na Entrega 3"
[ ] NUNCA diga "não sei" (sempre tem uma resposta!)


TROUBLESHOOTING RÁPIDO
═══════════════════════════════════════════════════════════════

Problema: Backend não inicia
[ ] Verificar FIREBASE_SERVICE_ACCOUNT_JSON
[ ] Verificar NODE_ENV
[ ] Testar: pnpm install (reinstalar deps)
[ ] Reiniciar terminal
Solução: Ver REFERENCIA_RAPIDA_TESTES.md - Troubleshooting

Problema: Token expirado
[ ] Fazer login novamente
[ ] Copiar novo token
[ ] Colar em novo comando cURL
Solução: Rápido (< 1 min para recuperar)

Problema: Agendamento foi rejeitado (inesperadamente)
[ ] Verificar: horário em :00 ou :30?
[ ] Verificar: já existe outro neste horário?
[ ] Verificar: customer_id e vehicle_id existem?
Solução: Ver GUIA_DEMONSTRACAO_ENTREGA2.md

Problema: Quer mostrar demo que já fez
[ ] Copiar cURL do REFERENCIA_RAPIDA_TESTES.md
[ ] Colar em Terminal 2
[ ] Pressionar Enter
Solução: Sempre ter referência aberta!

Problema: Slide não carrega / projetor
[ ] Ter plano B: mostrar em navegador/arquivo
[ ] Ter backup em PowerPoint + PDF
[ ] Ter texto do ROTEIRO_VISUAL_SLIDES.md impresso
Solução: Nunca depender 100% de slides


PÓS-APRESENTAÇÃO
═══════════════════════════════════════════════════════════════

[ ] Agradecer audiência
[ ] Oferecer contato para dúvidas posteriores
[ ] Compartilhar documentação:
    ├─ RESUMO_EXECUTIVO_ENTREGA2.md
    ├─ APRESENTACAO_ENTREGA2.md
    ├─ GUIA_DEMONSTRACAO_ENTREGA2.md
    └─ REFERENCIA_RAPIDA_TESTES.md
[ ] Recolher feedback
[ ] Fazer foto do grupo
[ ] Desligar servidor (pnpm dev com Ctrl+C)
[ ] Fazer backup de apresentação


MEMÓRIA DE APRESENTAÇÃO
═══════════════════════════════════════════════════════════════

Quando fizemos esta apresentação:
Data: ________________
Local: ________________
Audiência: ____________
Duração: _____________ min
Feedback geral: _____________________________________________________
O que funcionou bem: ________________________________________________
O que melhorar: _____________________________________________________
Perguntas mais frequentes: ___________________________________________
Próximas melhorias: __________________________________________________

```

---

## 📱 REFERÊNCIA RÁPIDA DE COMANDOS

### Copie e cole conforme necessário:

#### 1️⃣ Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eltongarage.com","password":"admin123"}'
```

#### 2️⃣ Criar Cliente (com TOKEN)
```bash
TOKEN="seu_token"
curl -X POST http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"João Silva","phone":"11999999999","email":"joao@email.com"}'
```

#### 3️⃣ Agendamento 1 (Sucesso)
```bash
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId":1,"vehicleId":1,"appointmentDate":"2025-12-25T08:00:00Z","serviceIds":[2]}'
```

#### 4️⃣ Agendamento 2 (Conflito - 409)
```bash
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId":1,"vehicleId":1,"appointmentDate":"2025-12-25T09:00:00Z","serviceIds":[1]}'
```

#### 5️⃣ Agendamento 3 (Horário Inválido - 400)
```bash
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId":1,"vehicleId":1,"appointmentDate":"2025-12-25T13:15:00Z","serviceIds":[1]}'
```

---

## 🎬 ORDEM DE DEMOS (Copiar esta ordem)

```
Demo 1: pnpm dev (mostrar servidor iniciando)
↓
Demo 2: Login (curl auth/login)
↓
Demo 3: Criar cliente (POST /customers)
↓
Demo 4: Agendamento sucesso (POST /appointments)
↓
Demo 5: Agendamento conflito (HTTP 409)
↓
Demo 6: Horário inválido (HTTP 400)
↓
Demo 7: Status workflow (4 PATCHs)
↓
Demo 8: Resultados dos testes
↓
FIM - Abrir para Q&A
```

---

## 📊 NÚMEROS PARA MENCIONAR (Memorize estes!)

```
Coleções Firestore:        13
Endpoints API:             50+
Testes automatizados:      21 (100% pass)
Requisitos implementados:  6 (todos ✅)

Build Backend:             355 ms
Build Frontend:            9.16 segundos
Tamanho Backend:           1.7 MB
Tamanho Frontend JS:       1.126 MB
Tamanho Frontend CSS:      112 KB

Banco Firestore Grátis:    1 GB + 50k leituras/dia
Custo mensal (atual):      R$ 0,00
Escalabilidade:            Ilimitada (pago)
```

---

## 🎯 FRASES-CHAVE (Use ao apresentar)

```
1️⃣ "Tudo pronto para produção!"
2️⃣ "Sem SQL, sem migrations!"
3️⃣ "Validações em tempo real!"
4️⃣ "Seguro: JWT + bcrypt"
5️⃣ "Automático: agendamentos + receita"
6️⃣ "Escalável: Firestore serverless"
7️⃣ "100% testado: 21 testes passando"
8️⃣ "Rápido: build em segundos"
9️⃣ "Integrado: frontend + backend"
🔟 "Pronto para produção AGORA!"
```

---

## ⚡ TIMING CRÍTICO

```
Tempo total: 15-20 minutos

Se está atrasado (-5 min):
[ ] Pular Slide 5-6 (inicialização)
[ ] Ir direto para demos

Se está adiantado (+5 min):
[ ] Aprofundar em Requisito 4 (status)
[ ] Mostrar código de teste
[ ] Responder perguntas extras

NUNCA ultrapasse 20 minutos (respeito ao tempo!)
```

---

## 💡 ÚLTIMO CONSELHO

```
✅ VOCÊ ESTÁ PREPARADO!

Você tem:
├─ 6 arquivos de documentação
├─ Código testado e compilado
├─ 21 testes passando
├─ 18 slides de apresentação
├─ 10 demos práticas prontas
└─ Este checklist para consulta

Foco em:
├─ Confiança (você sabe!)
├─ Calma (sem pressa)
├─ Clareza (fale devagar)
├─ Demonstração (mostre funcionando)
└─ Entusiasmo (ama o projeto!)

Boa apresentação! 🎉
Você vai bombar! 🚀
```

---

**Checklist imprimível - Data: 08/09/2025**
**Use este papel durante a apresentação**
**Marca os itens conforme avança!**
