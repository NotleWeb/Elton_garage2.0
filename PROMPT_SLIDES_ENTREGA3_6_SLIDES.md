# PROMPT PARA GERAR SLIDES — ENTREGA 3

## Como usar

Copie o bloco abaixo e cole em outra IA, como ChatGPT, Claude, Gemini ou Gamma.

```text
Você é um especialista em apresentações acadêmicas e técnicas. Crie uma apresentação profissional, objetiva e visual em português do Brasil.

TEMA:
ENTREGA 3 — Regras de Negócio e APIs
Projeto: Elton Garage 2.0
Data: 22/09

OBJETIVO DA APRESENTAÇÃO:
Explicar o desenvolvimento das principais APIs, serviços de backend e regras centrais do sistema de gestão para uma oficina de detalhamento automotivo.

PÚBLICO:
Professores, avaliadores, gestores e pessoas com conhecimento técnico intermediário.

DURAÇÃO:
Apresentação de 10 a 15 minutos.

QUANTIDADE OBRIGATÓRIA:
Crie no máximo 6 ou 7 slides.
Não crie slides extras de capa, agenda, referências ou conclusão separada. A capa deve ser o Slide 1 e a conclusão deve estar junto ao último slide.

FORMATO DE CADA SLIDE:
- Número e título do slide
- De 3 a 5 tópicos curtos
- Uma sugestão visual, como diagrama, fluxo, tabela ou destaque numérico
- Uma nota do apresentador com 2 ou 3 frases
- No máximo 40 palavras visíveis no conteúdo principal de cada slide

ESTILO:
- Profissional, claro e direto
- Pouco texto e boa hierarquia visual
- Não invente métricas ou funcionalidades
- Explique termos técnicos com linguagem simples
- Use uma narrativa: problema, solução, funcionamento e resultado
- Sugira ícones, fluxogramas e tabelas em vez de parágrafos longos
- Use cores relacionadas ao setor automotivo, como azul escuro, grafite, branco e amarelo como destaque

CONTEÚDO REAL DO PROJETO:

1. ARQUITETURA
- Frontend em React
- Backend em Node.js, Express e TypeScript
- Banco de dados Firebase Firestore
- API organizada por domínios
- Comunicação por HTTP, JSON e Bearer Token

2. PRINCIPAIS MÓDULOS DA API
- /api/auth
- /api/customers
- /api/vehicles
- /api/services
- /api/appointments
- /api/financial
- /api/dashboard
- /api/reports
- /api/inventory
- /api/notifications
- /api/loyalty

3. REGRAS DE AGENDAMENTO
- Cliente, veículo e serviço precisam existir
- O veículo deve pertencer ao cliente selecionado
- Horários aceitos somente em :00 ou :30
- A duração total é calculada pela soma dos serviços
- Conflitos de horário retornam HTTP 409
- Agendamento inicia com status agendado
- O fluxo é: agendado → confirmado → em_andamento → concluido
- Cancelamento pode ocorrer a partir de qualquer estado
- Lembretes são agendados após a criação

4. FINANCEIRO E RECEITA
- Cadastro de receitas e despesas
- Listagem com filtros e paginação
- Edição e exclusão de transações
- Resumo mensal de receita, despesa e lucro
- Receita vinculada ao agendamento pelo appointment_id
- Verificação evita duplicação da receita quando o processamento se repete

5. DASHBOARD E RELATÓRIOS
- Receita e lucro do mês
- Ticket médio
- Total de agendamentos
- Serviços concluídos
- Novos clientes
- Produtos com estoque baixo
- Receita por dia
- Serviços mais utilizados
- Clientes com maior consumo
- Clientes que precisam retornar

6. SEGURANÇA
- Autenticação com JWT
- SESSION_SECRET armazenado em variável de ambiente
- Middleware protege as rotas privadas
- Rate limit para reduzir abuso e tentativas repetidas
- CORS configurável
- Helmet para cabeçalhos de segurança
- HTTPS obrigatório em produção
- Respostas HTTP padronizadas: 400, 401, 403, 404, 409 e 500

7. RESULTADO DA ENTREGA
- APIs organizadas por domínio
- Regras de negócio centralizadas no backend
- Agenda protegida contra conflitos
- Fluxo de status controlado
- Financeiro integrado aos atendimentos
- Dashboard e relatórios prontos para consumo do frontend
- Base preparada para testes de integração e novas funcionalidades

VALIDAÇÃO TÉCNICA:
O typecheck atual encontrou uma referência de configuração para lib/db no tsconfig do backend, mas esse arquivo não está presente no workspace. Apresente isso como pendência técnica de configuração, sem afirmar que o build está 100% aprovado.

ESTRUTURA OBRIGATÓRIA DOS SLIDES:

Slide 1 — Entrega 3: objetivo e visão geral
Apresente o problema operacional e o que foi desenvolvido.

Slide 2 — Arquitetura e APIs principais
Mostre o caminho Frontend → Express → Serviços → Firestore.

Slide 3 — Regras de agendamento
Mostre o fluxo de criação, validações, conflito de horário e status.

Slide 4 — Financeiro e receita sem duplicação
Mostre CRUD financeiro, resumo mensal e idempotência da receita.

Slide 5 — Dashboard, relatórios e segurança
Combine indicadores gerenciais com as principais proteções da API.

Slide 6 — Demonstração e resultados
Mostre o roteiro: login, criar agendamento, provocar erro 409, concluir, consultar financeiro e KPIs. Finalize com os resultados da entrega.

Slide opcional 7 — Próximos passos
Crie somente se o conteúdo não couber no Slide 6. Inclua typecheck, testes de integração, documentação OpenAPI e notificações externas.

NO FINAL, INCLUA:
1. Uma frase de encerramento com até 20 palavras.
2. Três perguntas prováveis da banca e respostas curtas.
3. Um roteiro de apresentação com o tempo sugerido para cada slide.
4. Uma lista de elementos visuais que devem aparecer em cada slide.

Não ultrapasse 7 slides.
```

## Prompt curto para acompanhar

Depois de colar o script acima, envie:

```text
Agora gere a apresentação completa seguindo exatamente as regras do script. Use no máximo 6 slides; utilize o 7º somente se for realmente necessário. Entregue o texto pronto para copiar no PowerPoint ou Canva, incluindo notas do apresentador.
```

## Versão para gerar HTML ou PowerPoint

Acrescente ao final:

```text
Depois de criar o conteúdo, gere também uma versão em HTML responsivo ou uma estrutura pronta para PowerPoint. Use layout 16:9, títulos grandes, pouco texto e destaque visual para os fluxos de agendamento e receita idempotente.
```
