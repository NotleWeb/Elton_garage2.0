# Roteiro de slides — Integração Frontend e Backend

**Projeto:** Elton Garage 2.0  
**Tema:** Telas interativas conectadas às APIs e fluxos de operação  
**Duração sugerida:** 8 a 10 minutos  
**Público:** avaliadores, gestores e equipe técnica

> Use este roteiro como conteúdo para PowerPoint, Canva ou Gamma. As falas são notas do apresentador, não texto para projetar.

## Direção visual

- Formato widescreen 16:9.
- Paleta: grafite, azul escuro, branco e amarelo para destaques.
- Priorize capturas reais da aplicação e diagramas de fluxo; não invente telas ou indicadores.
- Mantenha pouco texto por slide. Mostre detalhes de endpoints apenas durante a demonstração.

---

## Slide 1 — Da interface à operação real

**Texto no slide**

- Elton Garage 2.0
- Integração entre telas, APIs e dados
- Do cadastro ao atendimento e ao financeiro

**Sugestão visual:** uma linha com quatro etapas: **Tela → API → Firestore → Resultado**. Use uma captura real da aplicação como imagem de fundo ou elemento central.

**Fala do apresentador:**  
“Nesta etapa, o foco é mostrar como a aplicação deixa de ser apenas uma interface e passa a apoiar a operação. As telas enviam informações às APIs, o backend aplica as regras do negócio e os dados são persistidos no Firestore. O resultado esperado é um fluxo conectado, do cadastro até o acompanhamento financeiro.”

**Transição:** “Para entender esse fluxo, vamos começar pela arquitetura.”

---

## Slide 2 — Como frontend e backend se comunicam

**Texto no slide**

- Frontend: React
- Backend: Node.js, Express e TypeScript
- Comunicação por API REST: HTTP e JSON
- Persistência no Firebase Firestore
- JWT protege as rotas privadas

**Sugestão visual:** diagrama horizontal: **React (tela)** → **API Express (validação e regras)** → **Firestore (dados)**; desenhe o retorno da resposta no sentido inverso.

**Fala do apresentador:**  
“A interface React conversa com o servidor por requisições HTTP e respostas JSON. O backend centraliza as validações e as regras, acessa o Firestore e devolve o resultado para a tela. No login, a API valida as credenciais e emite um token JWT, usado nas requisições protegidas.”

**Transição:** “Essa arquitetura aparece nos cadastros que sustentam o atendimento.”

---

## Slide 3 — Cadastros que alimentam o atendimento

**Texto no slide**

- Clientes: consultar, cadastrar, editar e remover
- Veículos vinculados ao cliente
- Serviços com preço e duração
- Dados enviados à API e armazenados no Firestore

**Sugestão visual:** três cartões conectados: **Cliente → Veículo → Serviço**. Se houver ambiente disponível, substitua os cartões por capturas reais das telas.

**Fala do apresentador:**  
“O fluxo começa com os dados necessários para atender cada pessoa: cadastro do cliente, seus veículos e o catálogo de serviços. A API oferece operações para consultar e manter esses registros. O vínculo entre veículo e cliente é importante para que o agendamento use informações consistentes.”

**Transição:** “Com esses dados, podemos montar o fluxo de agendamento.”

---

## Slide 4 — Agendamento com regras aplicadas pela API

**Texto no slide**

- Cliente, veículo e serviço precisam existir
- O veículo deve pertencer ao cliente escolhido
- Horários aceitos: :00 ou :30
- Conflitos são recusados com HTTP 409
- Status seguem um fluxo controlado

**Sugestão visual:** fluxo: **Selecionar cliente/veículo/serviço → escolher horário → validar → confirmar**. Destaque em amarelo a resposta **409 — conflito de horário** e mostre abaixo: **Agendado → Confirmado → Em andamento → Concluído**.

**Fala do apresentador:**  
“Ao criar um agendamento, o backend verifica os registros relacionados, valida o horário e calcula a duração total dos serviços. Se o horário se sobrepõe a outro atendimento, a API retorna conflito em vez de aceitar dados inconsistentes. Depois, o status avança pelas etapas previstas, sem permitir saltos ou retrocessos inválidos.”

**Transição:** “Quando o atendimento termina, o fluxo continua no financeiro.”

---

## Slide 5 — Do atendimento ao financeiro e aos indicadores

**Texto no slide**

- Conclusão do atendimento gera receita vinculada
- Proteção contra lançamento duplicado
- Transações podem ser consultadas, editadas e removidas
- Indicadores refletem as transações atualizadas

**Sugestão visual:** **Agendamento concluído → Receita → Dashboard**. Acrescente um selo “processada” no agendamento e mostre indicadores descritos no material: receitas, despesas e saldo líquido.

**Fala do apresentador:**  
“Ao concluir um atendimento, a receita é associada ao agendamento. A sinalização `revenue_processed` impede que o mesmo atendimento gere a receita mais de uma vez. No módulo financeiro, as transações podem ser consultadas e mantidas; após alterações, os totais e indicadores do dashboard são recalculados.”

**Transição:** “Vamos fechar com os resultados e uma demonstração curta do fluxo.”

---

## Slide 6 — Resultados e demonstração

**Texto no slide**

- 13 coleções Firestore documentadas
- 21 testes de agendamento: 100% aprovados, conforme o material
- Regras de horário, conflito e status validadas
- Fluxo conectado: autenticação → cadastro → agendamento → financeiro

**Sugestão visual:** quatro etapas numeradas com um indicador de teste. Durante a apresentação, mostre a aplicação e a resposta da API lado a lado.

**Fala do apresentador:**  
“Como demonstração, faço login, consulto ou cadastro um cliente e seu veículo, crio um agendamento e mostro uma validação de horário ou conflito. Em seguida, avanço o status até a conclusão e confiro a transação financeira. O material registra 21 testes automatizados de agendamento aprovados; a demonstração ao vivo confirma o comportamento no ambiente disponível.”

**Frase de encerramento:**  
“A integração transforma cadastros e regras de negócio em um fluxo operacional conectado e verificável.”

---

## Roteiro de tempo

| Slide | Tempo |
|---|---:|
| 1. Da interface à operação real | 45 s |
| 2. Comunicação entre camadas | 1 min 15 s |
| 3. Cadastros | 1 min |
| 4. Agendamento | 1 min 45 s |
| 5. Financeiro e indicadores | 1 min 30 s |
| 6. Resultados e demonstração | 2 a 3 min |

## Observação importante para a apresentação

O documento de referência informa que a seleção visual de horários disponíveis no frontend estava prevista para uma próxima etapa. Portanto, antes da apresentação, confirme essa tela no ambiente atual. Se ela ainda não estiver implementada, demonstre a validação pela API e não apresente a seleção visual como funcionalidade concluída. Use capturas reais e atualizadas da aplicação.

## Prompt pronto para gerar o visual dos slides

```text
Crie uma apresentação em português do Brasil, formato 16:9, com exatamente 6 slides, seguindo o conteúdo deste roteiro. Use estilo profissional para um sistema de gestão automotiva: grafite, azul escuro, branco e amarelo. Mantenha pouco texto, títulos grandes e diagramas simples. Não invente telas, funcionalidades, números ou resultados. Inclua as falas do apresentador apenas nas notas, não no conteúdo projetado. Priorize capturas reais da aplicação; quando não houver imagem real, use diagramas esquemáticos claramente ilustrativos. Preserve a observação de que a seleção visual de horários pode estar planejada para uma próxima etapa.
```
