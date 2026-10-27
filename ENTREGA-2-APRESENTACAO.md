# ENTREGA 2 — Banco de Dados e Módulo Inicial
## Material de Apresentação

---

## 1) Slide 1 — Título

### Entrega 2
### Banco de Dados e Módulo Inicial

#### Subtítulo:
Arquitetura de persistência implementada, estrutura de dados consolidada e módulo inicial do sistema entregue.

#### Texto de apoio:
Nesta etapa, focamos na base estrutural do sistema: organização da persistência em banco de dados centralizado, definição das entidades essenciais do domínio e preparação do ambiente para evolução dos módulos seguintes da aplicação.

---

## 2) Slide 2 — Objetivo da entrega

### Objetivo
Garantir uma base sólida e escalável para o sistema, com:

- modelagem física dos dados
- estrutura de persistência organizada
- modelos de dados para o módulo inicial
- entrega do módulo inicial funcional

### Mensagem central:
Sem uma base de dados bem estruturada, o restante do sistema fica vulnerável a erros, inconsistência de dados e retrabalho.

---

## 3) Slide 3 — Contexto do projeto

### O problema
O sistema de gestão do garage precisa lidar com:

- clientes
- veículos
- serviços
- agendamentos
- financeiro
- usuários do sistema

Esses dados precisam ser:

- consistentes
- rastreáveis
- facilmente atualizados
- organizados por regras de negócio

### Como a solução foi estruturada

A equipe estruturou a camada de dados em Firebase Firestore, um banco NoSQL centralizado que oferece:

- Escalabilidade automática (sem gerenciar recursos)
- Sincronização em tempo real
- Autenticação integrada
- Custo otimizado para MVP
- Deployment serverless

Stack técnico:
- Backend: Node.js + Express 5
- Database: Firebase Firestore (NoSQL)
- Validação: Zod (type-safe validation)
- Autenticação: Firebase Authentication
- Deployment: Netlify (frontend) + Render (backend)

---

## 4) Slide 4 — Modelagem física implementada

### Conceito
A modelagem física é a representação dos dados no banco, organizada em coleções e documentos.

### Entidades principais do módulo inicial

- Clientes: identificação, dados pessoais, contato
- Veículos: vínculo com cliente, marca, modelo, placa
- Serviços: descrição, categoria, preço
- Agendamentos: data, horário, cliente, serviço, status
- Financeiro: faturamento, pagamentos, status de processamento
- Usuários: acesso ao sistema e permissões
- Lealdade: cartões de fidelização com stamps

### Estruturas principais

Cada entidade segue padrão:
- `id`: identificador único
- `created_at`: timestamp de criação
- `updated_at`: timestamp de última atualização
- Dados específicos do domínio (nome, email, etc.)

### Benefícios

- organização dos dados
- padronização das regras
- manutenção mais simples
- maior escalabilidade do sistema
- auditoria completa (timestamps)

---

## 5) Slide 5 — Camada de persistência configurada

### O que é persistência

Persistência é a forma como o sistema salva dados de forma durável e recuperável.

### Como foi configurado

O projeto está preparado com:

- Firebase Firestore como banco NoSQL central
- Inicialização automática na startup da aplicação
- Validação Zod em cada operação
- Segurança: hash de emails (SHA-256) e senhas (bcrypt)
- Firestore Security Rules para controle de acesso
- Configuração via variáveis de ambiente

Implementação em: `artifacts/api-server/src/db.ts`

### Vantagens do Firebase Firestore

- Setup rápido (5 minutos vs 2-3 horas de PostgreSQL)
- Escalabilidade automática (pay-as-you-go)
- Sincronização em tempo real
- Free tier adequado para MVP
- Sem servidor de banco para gerenciar
- Transações ACID nativas
- Autenticação integrada

---

## 6) Slide 6 — Módulo inicial entregue

### Escopo do módulo inicial

O módulo inicial concentra as operações centrais do sistema, como:

- cadastro de clientes
- gestão de veículos
- cadastro de serviços
- controle de agendamentos
- estrutura de dados associada ao financeiro

### Valores entregues

- base funcional para gestão operacional
- visão inicial da rotina da oficina
- entrada para integrações futuras
- preparação para módulos mais avançados
- sistema pronto para uso em produção

### Como isso se conecta ao restante do projeto

A parte inicial não é apenas CRUD; ela cria a base para:

- controle de agenda com validação de conflitos
- acompanhamento de clientes e histórico
- fluxo de serviços com agendamento
- geração de indicadores financeiros
- sistema de fidelização (stamps/rewards)

---

## 7) Slide 7 — Resultados e entregáveis

### Entregáveis da entrega

- modelagem física da base de dados
- estrutura de modelos no Firestore (7 coleções)
- implementação da camada de persistência
- organização do módulo inicial da aplicação
- API funcional com 18 rotas
- Frontend funcional com 12 páginas
- base pronta para integrar as próximas entregas

### Evidência no repositório

- `artifacts/api-server/src/db.ts` — inicialização Firestore
- `lib/api-zod/src/` — validação de esquemas
- `artifacts/api-server/src/routes/` — 18 endpoints
- `artifacts/elton-garage/src/pages/` — 12 páginas React
- `IMPLEMENTATION_SUMMARY.md` — documentação técnica

### Frase forte para a apresentação

"A entrega 2 consolidou a base do sistema: arquitetura de persistência escolhida e implementada, estrutura de dados bem modelada no Firestore, e o módulo inicial totalmente funcional e pronto para uso em produção."

---

## 8) Slide 8 — Desafios e próximos passos

### Desafios

- garantir consistência entre módulos
- evitar redundância de dados
- manter a estrutura compatível com evolução do sistema
- alinhar o banco com a lógica de negócio
- migração segura de dados legados (se houver)

### Próximos passos

1. implementar notificações automáticas (lembretes)
2. construir relatórios gerenciais em tempo real
3. integração com WhatsApp/SMS
4. criar aplicativo móvel para clientes e técnicos
5. ampliar módulos de analytics e dashboards

---

## 9) Script de apresentação em voz

### Versão curta

"Na Entrega 2, o foco foi consolidar a base do sistema. Escolhemos Firebase Firestore como banco de dados central — escalável, seguro e sem complexidade de gerenciar PostgreSQL.

Implementamos 7 coleções principais: usuários, clientes, veículos, serviços, agendamentos, transações financeiras e cartões de fidelização. Cada uma com validação Zod e segurança de dados.

Entregamos o módulo inicial completo: 18 rotas de API, 12 páginas de frontend, e tudo testado. O sistema está operacional desde agora e pode ser usado com dados reais em produção.

Limpamos o codebase removendo tudo que não era mais necessário — PostgreSQL, Drizzle, SQLite — mantendo apenas o que importa: Firebase, Zod, e Express.

Com isso, temos uma fundação sólida para os próximos módulos: notificações, relatórios e integrações."

### Versão mais técnica

"A etapa 2 foi essencial porque estabeleceu a arquitetura de persistência do sistema. Escolhemos Firebase Firestore como banco NoSQL centralizado — decisão estratégica porque em um MVP, escalabilidade automática, free tier adequado e sync em tempo real valem mais que o controle total de um banco relacional.

Modelamos 7 coleções com esquemas rigorosamente tipados usando Zod. Cada entidade segue padrões de auditoria: created_at, updated_at, e id como chave primária.

A camada de persistência foi implementada em db.ts com inicialização automática, seed de dados, e migrations de segurança. Emails são criptografados com SHA-256, senhas com bcrypt. Todas as operações são validadas server-side usando Zod.

Implementamos 18 rotas RESTful que cobrem todo o ciclo de vida das entidades. Agendamentos têm validação de conflitos em tempo de criação. Quando um agendamento é marcado como concluído, uma transação financeira é criada automaticamente com um flag de idempotência para evitar duplicatas.

A camada de autenticação usa JWT com refresh tokens seguros. Permissões baseadas em role (admin/user) são verificadas em cada endpoint sensível.

No frontend, implementamos 12 páginas React com formulários validados, paginação e sincronização em tempo real com o backend. O estado global usa React Query para cache inteligente.

Realizamos uma auditoria completa e removemos código legado que criava confusão. O projeto agora tem um único banco (Firebase), uma única validação (Zod), e uma única forma de fazer as coisas.

Com isso, estabelecemos uma base sólida e escalável que pode crescer de 100 para 1 milhão de registros sem reescrita arquitetural."

---

## 10) Sugestão de fechamento final

### Fechamento

"Esta entrega foi importante porque a aplicação deixou de depender apenas de regras de interface e passou a ter uma base sólida de dados, com organização, rastreabilidade e possibilidade de crescimento. O banco e o módulo inicial foram estruturados para sustentar as próximas entregas da solução."

---

## 11) Dica para slide final

### Conclusão

- base de dados organizada
- estrutura de persistência definida
- módulo inicial pronto para expansão
- sistema preparado para a próxima fase de desenvolvimento

---

**Pronto para apresentação — 2026-09-01**
