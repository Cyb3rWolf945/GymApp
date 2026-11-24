# Plano: GymApp (nome proposto: Fuelift). MVP em 3 dias, construído por uma equipa de agentes

## Contexto
O repositório `GymApp` está vazio (branch `claude/youthful-cori-kwhfhu`, sem commits). O objetivo é criar a base de requisitos de uma app de ginásio centrada no utilizador, com treinos e dietas personalizados gerados por um LLM e com subscrições por níveis.

Decisões já tomadas:
- **Plataforma:** mobile primeiro (iOS + Android, cross-platform).
- **Subscrição:** vários níveis (Basic / Pro / Elite).
- **MVP:** geração de treinos e dietas por IA, registo de treinos e progresso com ajuste do plano, lista de compras e receitas, integração com Apple Health e Google Fit.
- **Mercado:** internacional, com a app em inglês (EN) e i18n preparado.
- **Fora do MVP:** chat livre com coach IA (fica para a v2).
- **Prazo: app construída e publicada em, no máximo, 3 dias**, por uma equipa de agentes agendados. O progresso fica no GitHub Projects e há um orquestrador que distribui o trabalho por agentes implementadores com um modelo mais barato.

## Princípio orientador: trabalho feito, não planeamento
- Este plano é o **único** documento de planeamento. Não há mais rondas de especificação: as decisões em aberto têm um default e avança-se, e um ajuste posterior entra como uma issue nova.
- **Documentação mínima e por fases:**
  - logo de início, só o `CLAUDE.md` (convenções para os agentes) e um `docs/SPEC.md` gerado diretamente deste plano, sem reescrever nem expandir;
  - os documentos detalhados (UX, IA, marketing, backoffice) **não bloqueiam código**: o seu conteúdo entra diretamente nas issues, como critérios de aceitação.
- **Regras para os agentes (escritas no `CLAUDE.md` e no prompt do orquestrador):**
  - **"Finish before you start":** limite de trabalho em curso de 4 issues. O orquestrador só lança uma issue nova quando há um slot livre, e dá prioridade a desbloquear e fechar PRs abertos.
  - **Os implementadores não escrevem planos nem documentos:** leem a issue, implementam, testam e abrem o PR. Se algo for ambíguo, escolhem a opção mais simples que cumpra os critérios e anotam-na no PR, sem parar para perguntar.
  - **Issues pequenas** (de 1 a 3 h de trabalho de agente). Se uma issue crescer, o implementador entrega a parte essencial e o orquestrador cria uma issue de seguimento.
  - **Métrica principal no "MVP status":** issues fechadas, PRs com merge feito e funcionalidades visíveis no deploy de preview. O plano é secundário.
  - **Deploy de preview contínuo:** cada merge para `main` faz deploy automático na Vercel, para veres o trabalho feito a qualquer momento.

## Consequências do prazo de 3 dias (decisões de âmbito)
- **Uma só base de código Expo** (iOS + Android + **web**). No dia 3 a versão **web fica online** e é para lá que apontam os anúncios, com checkout Stripe. Os builds de iOS e Android são submetidos às lojas no dia 3, mas a revisão da Apple e da Google não depende de nós e pode demorar entre 1 e vários dias.
- **Fica no MVP de 3 dias:**
  - auth;
  - onboarding;
  - geração de treino e dieta (Planner + validador + QA + guardrails);
  - registo de treinos;
  - plano alimentar, receitas e lista de compras;
  - Stripe com 3 níveis e paywall;
  - progresso básico (peso e recordes);
  - páginas legais e exclusão de conta;
  - quiz web e anúncios;
  - **backoffice de admin** com os dados essenciais (secção F).
- **Passa para a v1.1** (logo a seguir ao lançamento):
  - Apple Health e Google Fit, que exigem builds nativos e revisão de permissões;
  - Body Map 3D (no MVP fica um mapa 2D simples, se houver tempo);
  - RAG vetorial com Voyage e pgvector (no MVP a memória é só estruturada, em SQL);
  - adaptação semanal automática (no MVP existe o botão "Update my plan", que usa o histórico);
  - IAP nativo;
  - estilos de coach;
  - exportação de dados.
- **Contas e chaves que tens de criar no dia 0** (os agentes não as podem criar):
  - Supabase;
  - Stripe (modo de teste e depois live);
  - API key da Anthropic;
  - Expo/EAS;
  - Vercel;
  - Apple Developer ($99/ano) e Google Play Console ($25);
  - Meta Business Manager, conta de anúncios e app Meta para a Marketing API;
  - domínio.

## Entregáveis (por ordem de execução)
1. **Imediatamente:** `CLAUDE.md`, `README.md`, `docs/SPEC.md` (este plano, sem as partes de processo) e o esqueleto do CI. Commit e push para `claude/youthful-cori-kwhfhu` e criação do `main` a partir dele, porque o repositório está vazio e a aprovação deste plano autoriza esse push.
2. **Logo a seguir:** labels, milestones, as 35 issues (com o conteúdo das secções A a F como critérios de aceitação) e a issue "MVP status".
3. **Arranque:** tarefa agendada de hora a hora do orquestrador e 1.º ciclo lançado **nesta sessão**.

As secções A a F abaixo são a especificação de onde saem as issues. **Não** se transformam em documentos separados antes do código.

---

## A. `docs/UX_BENCHMARK.md`: benchmark de UI/UX
O conteúdo vem de pesquisa já feita e de pesquisa a completar durante a escrita. Os preços variam entre fontes e ficam marcados "a verificar".

| App | O que faz bem e devemos adotar | Fraqueza / oportunidade |
|---|---|---|
| **Fitbod** | É a referência de UX em automação. Gera o treino do dia a partir do equipamento e da recuperação muscular (mapa de músculos "frescos"). Permite trocar exercícios com um toque. | É caro, não tem plano grátis e não inclui dieta. |
| **Hevy** | Registo de treino muito rápido, com séries pré-preenchidas a partir da última sessão. Tem temporizador de descanso automático, recordes pessoais e feed social. | A IA é limitada. |
| **Strong** | Logger minimalista e rápido, com exportação CSV. | Não guia a progressão. Não serve iniciantes. |
| **MacroFactor** | Algoritmo adaptativo de calorias (TDEE pela tendência do peso), check-in semanal explicado e registo de comida sem fricção. | Não gera planos de refeições. |
| **Eat This Much** | Plano de refeições automático, "regenerar/trocar refeição" e lista de compras automática. | Não tem treino e a adaptação é fraca. |
| **Planfit / Future** | Coach IA e plano explicado ("porquê este exercício"). | — |

**Padrões a adotar:**
- Onboarding curto (8 a 12 ecrãs, com barra de progresso) que mostra o plano gerado antes do paywall.
- Ecrã "Hoje" com o treino e as refeições do dia.
- Registo de séries em 1 a 2 toques, pré-preenchidas.
- Trocar um exercício ou refeição sem regenerar o plano todo.
- Check-in semanal que explica as alterações.
- Mapa de músculos e recuperação.
- Gráficos de progresso (e1RM, volume e tendência do peso).
- Modo escuro, com uso no ginásio com uma só mão.

**Ecrãs do onboarding** (12 de recolha de dados, com barra de progresso e um botão "Saltar" nos ecrãs opcionais):
1. **Boas-vindas:** proposta de valor ("treino e dieta feitos para ti, que se adaptam todas as semanas") e botões "Começar" e "Já tenho conta".
2. **Objetivo principal:** perder gordura, ganhar músculo, recomposição, força, saúde geral ou performance. É uma escolha única, com um objetivo secundário opcional.
3. **Dados básicos:** sexo biológico (para os cálculos), idade, altura e peso atual, com unidades métrica ou imperial.
4. **Peso-alvo e ritmo** (opcional, só se o objetivo envolver peso): peso desejado e ritmo (lento, moderado ou agressivo), com a data estimada calculada logo.
5. **Experiência de treino:** iniciante, intermédio ou avançado, e há quanto tempo treina. Opcional: cargas de referência (supino, agachamento e peso morto).
6. **Disponibilidade:** dias por semana (2 a 6), duração por sessão (30, 45, 60 ou 90 min) e dias preferidos.
7. **Local e equipamento:** ginásio completo, ginásio básico, casa (com seleção do equipamento: halteres, barra, elásticos, etc.) ou só peso corporal.
8. **Lesões e limitações:** zonas do corpo num mapa clicável (joelho, ombro, lombar…) e um campo livre curto. Este campo passa pelo filtro de injection e de red flags.
9. **Atividade diária:** sedentário, leve, moderado ou muito ativo. Inclui a opção de ligar o Apple Health ou o Google Fit para importar os passos e o peso.
10. **Estilo alimentar:** omnívoro, vegetariano, vegan, pescetariano, keto, etc. e o número de refeições por dia (2 a 6).
11. **Alergias e exclusões:** chips (glúten, lactose, frutos secos, marisco, ovo…) e alimentos de que não gosta. Os alergénios são tratados como restrição rígida.
12. **Orçamento e cozinha:** orçamento semanal de compras (baixo, médio ou alto), tempo para cozinhar (rápido, médio ou elaborado) e preferência por meal prep.
13. **Consentimentos:** termos, privacidade, consentimento explícito para dados de saúde (RGPD), disclaimer médico e permissão de notificações.
14. **A gerar o teu plano:** ecrã de loading com os passos visíveis ("a calcular as calorias…", "a escolher exercícios…"). Enquanto a geração corre de forma assíncrona, pede a criação de conta (Apple, Google ou email), para o plano ficar guardado.
15. **Preview do plano:** mostra o 1.º treino e o 1.º dia de refeições, as calorias e macros, e o porquê das escolhas.
16. **Paywall:** comparação Basic, Pro e Elite, com trial e com o plano já visível por trás.

Para manter o onboarding em 2 a 3 minutos, os ecrãs 4, 8 e 12 são saltáveis e os ecrãs 1, 13 e 14 não contam como perguntas.

**Guia de escrita dos textos da app (UX writing / microcopy).** A app é em inglês, por isso os exemplos estão em EN. Seguimos o modelo da Duolingo e da Apple (WWDC24): uma voz fixa e um tom que se adapta ao momento.

- **Regras gerais de escrita:**
  - 2.ª pessoa ("you") e voz ativa. Frases curtas, com uma ideia por frase.
  - Começar pelo benefício ou pela ação ("Log your set", não "Set logging").
  - Sentence case nos títulos e botões. Os botões dizem o que acontece ("Start workout", "Swap exercise"), nunca "OK" ou "Submit".
  - Números concretos em vez de adjetivos ("+2.5 kg", não "a bit heavier").
  - No máximo um emoji por mensagem, e só em celebrações.
  - Explicar o "porquê" em 1 linha quando a IA muda algo.
  - Linguagem inclusiva e neutra em termos de corpo: falar de força, energia e consistência, não de aparência.
- **Tom por tipo de texto:**
  - *Títulos e perguntas do onboarding:* curiosos e pessoais. Ex.: "What's your main goal?" e "Got it. We'll protect that knee."
  - *Botões e CTAs:* verbo + objeto, com 1 a 3 palavras. Ex.: "Build my plan" e "Start workout".
  - *Ecrã durante o treino:* mínimo, só dados. Ex.: "Set 3 of 4 · 80 kg × 8 · Rest 1:30".
  - *Celebrações (PR, 1.º treino, streak):* entusiasmo alto e curto. Ex.: "New PR! 100 kg bench. That's +5 kg in 6 weeks 🔥".
  - *Notificações push:* nome + dado concreto + ação, com menos de 60 caracteres. Ex.: "Leg day, Ana. 45 min and you're done."
  - *Check-in semanal da IA:* coach analítico. Ex.: "You lost 0.4 kg, right on pace. Calories stay the same."
  - *Semana falhada / regresso:* empático e sem culpa. Ex.: "Tough week? No problem. I've adjusted your plan to 3 days."
  - *Erros:* o que aconteceu e o que fazer, sem culpar o utilizador. Ex.: "Couldn't save your set. Check your connection and try again."
  - *Estados vazios:* convite à ação. Ex.: "No workouts yet. Your first one takes 40 min."
  - *Paywall:* valor concreto e honesto, sem urgência falsa. Ex.: "Unlock your full meal plan and weekly adjustments."
  - *Avisos de saúde:* tom sério e claro, sem humor. Ex.: "This isn't medical advice. Talk to a doctor if you're pregnant or have a health condition."
- **Palavras a evitar:**
  - culpa e vergonha: "cheat meal", "burn off", "guilt-free", "no excuses";
  - promessas irreais;
  - jargão sem explicação (RPE e e1RM aparecem sempre com tooltip).
- **Estilo do coach escolhido pelo utilizador:** "Motivating", "Calm" ou "Drill sergeant". Afeta só as notificações e as explicações da IA, nunca os erros nem os avisos de saúde.
- **Entregável:** uma tabela "Do / Don't" com 2 a 3 exemplos por tipo de texto e um glossário de termos fixos ("workout", não "session" ou "routine" alternadamente). O guia é incluído no system prompt do LLM, para os textos gerados pela IA terem o mesmo tom que a UI.

**Modelo 3D interativo do corpo ("Body Map 3D").** É um diferenciador visual: o Fitbod e outros usam só um mapa 2D.
- **Interações:**
  - Rodar 360° com um dedo, zoom com pinça, duplo toque para fazer reset, e botões Frente / Costas.
  - **Heatmap:** cada músculo é iluminado conforme o que foi treinado. Há três modos selecionáveis:
    - *últimos 7 dias* (volume em séries efetivas);
    - *recuperação* (de "fresco" a "fatigado");
    - *plano da semana* (o que vai ser treinado).
  - **Toque num músculo:** o músculo fica destacado e abre um bottom sheet com:
    - **Estatísticas:** séries por semana vs. alvo, tendência do volume (4 a 12 semanas), último treino, % de recuperação e top exercícios com recordes pessoais e e1RM.
    - **Ações:** "Plan a workout for this muscle". Chama o Planner com essa restrição de foco e passa pelo QA como qualquer outro plano. Inclui também "See exercises", com a lista filtrada da biblioteca, e "Add to today".
- **Abordagem técnica recomendada:**
  - **Renderização:** **React Three Fiber (`@react-three/fiber/native`) + `expo-gl`**, dentro da app React Native/Expo. É nativo, tem bom desempenho e o código fica todo em TypeScript. Foram descartadas duas alternativas:
    - WebView com three.js: é mais lenta e tem gestos piores;
    - Unity as a Library: é demasiado pesada para uma só funcionalidade.
  - **Asset:** um modelo anatómico em **GLB low-poly** (cerca de 30 a 50k triângulos, com compressão Draco/Meshopt, menos de 5 MB, carregado em lazy load e guardado em cache). Precisa de cerca de 25 a 30 **meshes separadas por músculo**, com IDs estáveis, por exemplo `pectoralis_major`, `quadriceps` ou `gluteus_maximus`. Há duas opções:
    - comprar um modelo com licença comercial (Sketchfab, TurboSquid, CGTrader);
    - encomendá-lo a um artista 3D.

    É preciso verificar a licença para uso em app paga.
  - **Coloração:** um material por músculo, com a cor e a emissividade calculadas a partir dos dados, numa escala acessível e com uma legenda. O toque é detetado por raycast no mesh.
  - **Dados:** a biblioteca de exercícios mapeia cada exercício para os músculos **primários (peso 1.0)** e **secundários (peso 0.5)**, com os mesmos IDs dos meshes. O backend calcula, por utilizador, o volume por músculo e a recuperação (decaimento de cerca de 48 a 72 h, ajustado pelo RPE).
  - **Desempenho e acessibilidade:**
    - Em dispositivos fracos há um fallback para um **mapa 2D em SVG** (frente/costas), com os mesmos IDs e os mesmos dados. O SVG também serve de vista leve na home.
    - Existe uma lista textual alternativa para leitores de ecrã.
- **Faseamento e níveis:**
  - MVP: mapa 2D com heatmap e toque para ver estatísticas, em todos os níveis.
  - v1.1: modelo 3D com rotação.
  - Estatísticas avançadas e "Plan a workout for this muscle" em Pro e Elite.
  - Se preferires o 3D logo no MVP, é possível, mas o asset 3D passa a ser uma dependência crítica do calendário.

**Diferenciador da GymApp:** é a única app que junta, num só plano adaptativo, treino e dieta ligados entre si. Por exemplo, as calorias ajustam-se aos dias de treino.

O documento inclui ainda:
- os fluxos-chave em texto (onboarding, sessão de treino, check-in semanal e lista de compras);
- os princípios de UX e as regras do paywall por nível;
- a recomendação do próximo passo: wireframes em Figma, ou um protótipo de design meu.

---

### Estrutura do `docs/REQUIREMENTS.md`
1. **Visão e proposta de valor.** Inclui o problema, o público-alvo e os diferenciadores: personalização real, adaptação contínua com base nos registos e dieta e treino integrados.
2. **Personas.** Iniciante, intermédio focado em hipertrofia, pessoa a perder peso e utilizador com restrições (lesões, alergias, vegan).
3. **Âmbito do MVP vs. roadmap.** Tabela MVP / v1.x / v2. O chat com coach IA, o social e o marketplace de PTs ficam na v2.
4. **Requisitos funcionais**, com IDs (FR-xx) e prioridade MoSCoW:
   - Conta e autenticação: email, Apple e Google. Exclusão de conta e exportação de dados.
   - Onboarding e perfil: objetivos, nível, dados biométricos, dias e tempo disponíveis, equipamento (ginásio, casa ou nenhum), lesões e limitações, preferências e restrições alimentares, alergias e orçamento.
   - Geração de treinos por IA: plano semanal (split, exercícios, séries, reps, RPE e descanso) baseado numa **biblioteca de exercícios curada**, para o LLM só escolher exercícios dessa lista, com substituições de exercícios.
   - Geração de dietas por IA: alvo calórico e macros calculados de forma **determinística** (Mifflin-St Jeor + nível de atividade). O LLM só cria refeições dentro desses alvos. Respeito estrito de alergias, com validação pós-geração.
   - Receitas e lista de compras: agregação dos ingredientes da semana, agrupada por categoria, com quantidades e marcação de itens já comprados.
   - Registo de treino: sessão ativa, séries, carga, reps, temporizador de descanso, histórico e recordes pessoais.
   - Progresso: peso, medidas, fotos opcionais, gráficos e adesão ao plano.
   - Body Map: mapa 2D no MVP e 3D com rotação de 360° na v1.1, com heatmap por músculo, estatísticas por músculo e um botão para planear o treino de um músculo específico (detalhe em `UX_BENCHMARK.md`).
   - Adaptação: revisão semanal automática (progressão de carga, deload, ajuste de calorias pela tendência do peso) com explicação da alteração.
   - Integrações (v1.1): leitura de peso, passos, calorias ativas e sono do HealthKit e do Health Connect. Escrita dos treinos concluídos.
   - Notificações: lembretes de treino, de refeições e de registo do peso.
   - Subscrições: paywall, trial, upgrade/downgrade e restauro de compras.
   - Backoffice de admin: ver a secção F.
5. **Planos de subscrição e preços** (pesquisa de mercado, preços em USD nos EUA, 2026; os valores vêm de sites de review e ficam a confirmar):
   - **Referências de mercado:**

     | App | Mensal | Anual |
     |---|---|---|
     | Fitbod (só treino) | ~$15.99 | ~$95.99 |
     | MacroFactor (só nutrição) | $11.99 | $71.99 |
     | Noom (coaching comportamental) | ~$70 | ~$209 |

     MacroFactor + Workouts em bundle custa ~$89.99/ano. A mediana da categoria Health & Fitness (dados da RevenueCat) está em cerca de $9.99/mês e $39.94/ano. Em média, 37.7% dos trials convertem em pagamento, e cerca de 68% da receita vem de planos anuais.
   - **O máximo defensável:** a GymApp substitui Fitbod + MacroFactor juntos, que custam cerca de $28/mês ou $168/ano. Esse é o **teto de valor percebido** para o plano principal. Acima de cerca de $30/mês entramos no território do Noom e do coach humano, onde se exige acompanhamento humano.
   - **Preços propostos:** o anual tem cerca de 50% de desconto para empurrar o anual; o trial de 7 dias só existe no anual.

     | Nível | Mensal | Anual | Inclui |
     |---|---|---|---|
     | **Basic** | **$9.99** | **$59.99** | Treino por IA (1 geração por mês, mais swaps), registo de treinos e progresso. Fica abaixo do Fitbod. |
     | **Pro** (plano âncora e "Most popular") | **$19.99** | **$119.99** | Treino + dieta + receitas + lista de compras e regenerações ilimitadas (com fair use). Custa cerca de 30% menos do que Fitbod + MacroFactor. |
     | **Elite** | **$24.99** | **$149.99** | Pro + adaptação semanal automática, estatísticas avançadas e Body Map 3D (v1.1), prioridade na geração e acesso antecipado ao coach IA. Custa só +$5/mês do que o Pro (+$30/ano), por isso o upgrade parece pequeno face ao que se ganha. A escada de preços não é linear: o salto do Basic para o Pro é de +$10, e do Pro para o Elite só +$5. |
   - **Efeito esperado:** mais utilizadores escolhem o Elite, porque "por mais $5 levo tudo", o que sobe o ARPU. O Pro continua a ser o "Most popular", para quem quer o essencial. No paywall, o Elite aparece com o preço por dia ("$0.82/day") e a diferença em destaque ("+$5 for weekly auto-adjustments").
   - **Oferta de lançamento ("Founding member"):** Pro anual a $79.99 no 1.º ano, via cupão Stripe e por tempo limitado e real.
   - **Margem:** o custo de IA é baixo face ao preço. Uma geração completa custa menos de $0.01. Mesmo um Pro com 30 gerações por mês custa menos de $0.30 de IA. A comissão do Stripe é de cerca de 2.9% + $0.30 por transação.
   - **Teste de preço desde o dia 1:** o paywall web com Stripe permite A/B por preço sem passar pelas lojas. Primeiro teste: Pro mensal a $14.99 vs. $19.99, e Elite mensal a $24.99 vs. $29.99, para medir se a diferença pequena sobe de facto o ARPU. Decide-se com base na receita por visitante do paywall, não só na conversão.
   - **Regra de gating:** as quotas de geração por nível estão na matriz de funcionalidades. Os preços ficam nos Prices do Stripe, por isso mudar um preço não exige deploy.
   - Inclui a matriz de funcionalidades por nível e as regras de limites (quota de gerações) para controlar o custo do LLM.
6. **Requisitos da IA/LLM:** resumo com os IDs AI-xx. O detalhe fica em `docs/AI_ARCHITECTURE.md`, descrito na secção B. Todos os modelos da app passam pelo OpenRouter.
7. **Requisitos não funcionais:** desempenho (geração em menos de 60 s, assíncrona), modo offline para o registo de treino, acessibilidade, i18n (EN no lançamento), unidades métricas e imperiais, disponibilidade e observabilidade.
8. **Privacidade, segurança e conformidade:** RGPD (dados de saúde são categoria especial, com consentimento explícito), regras do HealthKit e do Health Connect (não usar os dados para publicidade), políticas das lojas para subscrições, encriptação e retenção de dados, e disclaimer de saúde.
9. **Arquitetura e stack recomendada** (a confirmar):
   - App em React Native com **Expo (expo-router) e TypeScript, universal: iOS, Android e web**. Monorepo com `apps/mobile`, `supabase/` (migrations e Edge Functions para o pipeline de IA e os webhooks do Stripe) e `packages/shared` (tipos e schemas Zod).
   - Backend em **Supabase** (Postgres + RLS + Auth + Edge Functions + Storage), escolhido por ser o mais rápido de pôr a funcionar. Deploy da web na Vercel e builds nativos com EAS.
   - **Subscrições: Stripe como sistema de faturação principal.**
     - **Stripe Billing:** produtos e preços (Basic, Pro e Elite, mensal e anual), trials, cupões, Customer Portal (upgrade, downgrade e cancelamento), faturas e IVA (Stripe Tax). Os pagamentos são feitos por **web checkout**, aberto a partir da app.
     - **Restrição das lojas:** a Apple e a Google exigem, em regra, compras in-app (StoreKit / Play Billing) para subscrições digitais. O link para pagamento externo só é permitido em certos mercados (EUA desde 2025, UE ao abrigo do DMA com condições e taxas) e as regras mudam com frequência. Por isso:
       - Stripe nos mercados e situações onde é permitido, e na web;
       - IAP nativo como alternativa obrigatória nos restantes mercados.
     - **Serviço de entitlements próprio no backend:** é a fonte única da verdade sobre "que nível tem este utilizador". Recebe três fontes: webhooks do Stripe, App Store Server Notifications v2 e Google Play RTDN.
     - **Vantagem:** a app só consulta este serviço, sem lógica de pagamento no cliente.
     - **Ação:** validar as regras atuais das lojas por mercado antes do lançamento. Fica como risco na secção 12.
     - **Verificação do pagamento.** Não há uma verificação "mensal" nem "anual" feita por nós. A verificação é **orientada a eventos** e feita **em cada pedido**:
       1. **Cobrança automática:** o Stripe cobra sozinho no fim de cada período, mensal ou anual, conforme o plano.
       2. **Webhooks → tabela `entitlements`:** cada evento atualiza `tier`, `status` e `current_period_end`. Os webhooks são validados pela assinatura e processados de forma idempotente (pelo `event.id`). Eventos:
          - `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`;
          - `invoice.paid`: renovação bem-sucedida, que estende o `current_period_end`;
          - `invoice.payment_failed`: passa a `past_due`;
          - `customer.subscription.trial_will_end`: aviso 3 dias antes do fim do trial;
          - `charge.refunded` e `charge.dispute.created`: revogam o acesso.
       3. **Em cada pedido:** o acesso é verificado **no servidor** (Edge Functions e RLS), com `status IN (active, trialing)` ou `past_due` dentro do período de tolerância, **e** `current_period_end > now()`. O cliente só guarda uma cópia em cache para a UI e atualiza-a ao abrir a app. Nunca é ele que decide o acesso.
       4. **Pagamento falhado:** o Stripe tenta de novo automaticamente (Smart Retries) e envia emails de dunning ao longo de cerca de 1 a 2 semanas. Nós damos **7 dias de tolerância**, com um banner "Update your payment method" e um link para o Customer Portal. Se todas as tentativas falharem, o estado passa a `canceled` ou `unpaid` e o utilizador volta a não pagante. Os dados não se perdem: só fica bloqueado o acesso às funcionalidades pagas.
       5. **Cancelamento:** fica com `cancel_at_period_end` e o acesso mantém-se até ao fim do período já pago.
       6. **Rede de segurança:** há um job **diário** que reconcilia a tabela `entitlements` com a API do Stripe, para corrigir webhooks perdidos. As falhas de webhook aparecem como alerta no backoffice.
     - **No MVP de 3 dias:** o pagamento é feito só com Stripe na web. Nas apps nativas, o utilizador faz login com a conta já paga ("reader-style"). O IAP nativo entra na v1.1, onde for obrigatório.
   - Login: email (magic link) e Google, com **Sign in with Apple obrigatório no iOS** quando se oferece login social.
   - LLM via **OpenRouter** (uma só API key) com saídas estruturadas por JSON Schema.
   - Analytics (PostHog) e erros (Sentry).
10. **Modelo de dados inicial:** User, Profile, Subscription/Entitlement, Exercise, WorkoutPlan, WorkoutDay, PlannedExercise, WorkoutSession, SetLog, NutritionPlan, Meal, Recipe, Ingredient, ShoppingList, BodyMetric e GenerationJob. Para o backoffice: AiCallLog, GuardrailEvent, AnalyticsEvent, AdCreative, AdInsightDaily, AdminAuditLog, PromptVersion, CostEntry e RevenueDaily.
11. **Métricas de sucesso:** ativação (onboarding até ao primeiro treino), retenção D7 e D30, conversão de trial para pago, adesão semanal, churn e custo de LLM por utilizador pago.
12. **Riscos e questões em aberto:** regras da App Store e da Google Play sobre pagamentos externos (Stripe) por mercado, preços, qualidade e segurança das dietas, custo do LLM, possível revisão por nutricionista ou PT, e os nomes dos níveis.

---

## B. `docs/AI_ARCHITECTURE.md`

### B1. Modelos dentro da app, via OpenRouter (uma só API key)
Todos os modelos da app são chamados pela **API do OpenRouter**, compatível com o formato OpenAI (`https://openrouter.ai/api/v1/chat/completions`). A chave `OPENROUTER_API_KEY` fica só nas Edge Functions, nunca no cliente.

A escolha privilegia o custo-benefício para planos de treino e dieta: o Planner precisa de bom raciocínio e de JSON fiável; o QA e as tarefas leves são avaliação e classificação, onde um modelo barato chega.

| Papel | Modelo recomendado (ID OpenRouter) | Preço indicativo por 1M (in/out) | Porquê | Alternativa no A/B |
|---|---|---|---|---|
| **Planner** (treino + dieta) | **DeepSeek V4.1 Flash** | ~$0.15 / $0.60 (fora de ponta) | É o modelo mais usado no OpenRouter, raciocina bem e suporta structured outputs. Custa cerca de 15× menos do que o Sonnet. A qualidade fica garantida pelo validador determinístico e pelo QA, não pelo preço do modelo. | GLM 5.3 Flash (~$0.15 / $0.50) |
| **Escalamento** (só quando o QA reprova 2 vezes) | **Claude Sonnet 5.5** (`anthropic/claude-sonnet-5-5`) | ~$2 / $10 | Usado como último recurso antes do template seguro. Espera-se que seja menos de 5% das gerações. | — |
| **QA / Avaliador** | **GLM 5.3 Flash** | ~$0.15 / $0.50 | É de uma **família diferente** do Planner, o que reduz o viés de autoavaliação, e é muito barato. A rubrica é fixa e a saída estruturada. | GPT-6 Luna (~$0.10 / $0.50) |
| **Tarefas leves** (pré-filtro de guardrails, resumos de memória, normalização de ingredientes) | **GPT-6 Luna** ou **GLM 5.3 Flash** | ~$0.10 a $0.15 / $0.50 | Classificação simples a custo quase nulo e com structured outputs. | gpt-oss-20b, que é ainda mais barato, se o eval o validar |
| **Embeddings** (v1.1) | Fica a confirmar se o OpenRouter tem embeddings adequados. Caso contrário, Voyage AI diretamente. | — | Só são precisos para o RAG vetorial da v1.1. | — |

**Ressalvas importantes:**
- Os nomes e preços vêm de rankings e blogs de novembro de 2026 que nem sempre concordam entre si.
- **A issue 6 começa por validar isto na API de modelos do OpenRouter** (`/api/v1/models?supported_parameters=structured_outputs`), confirmando os IDs, os preços, o suporte a JSON Schema e o uptime dos providers.
- Depois corre um **eval set pequeno** (cerca de 20 perfis, incluindo casos-limite como alergias, lesões e vegan) e fixa os modelos com dados, não com palpites.
- Os modelos ficam **configuráveis** na tabela `PromptVersion` e em variáveis de ambiente, por isso trocar de modelo não exige deploy.

**Perfis de modelos: `dev` (grátis) e `prod` (os escolhidos acima).**
- **`MODEL_PROFILE=dev`** é usado em desenvolvimento, CI, E2E e nos deploys de preview, com **modelos grátis do OpenRouter** (IDs com o sufixo `:free`). A issue 6 escolhe-os através da API de modelos, filtrando por preço 0 e suporte a `structured_outputs`. Candidatos prováveis: as versões `:free` de gpt-oss-20b, DeepSeek ou GLM. Os mesmos papéis são usados com modelos grátis (Planner, QA e leve), sem escalamento para o Sonnet.
- **Cuidados com os modelos grátis:**
  - têm limites de pedidos baixos (por minuto e por dia; carregar cerca de $10 em créditos sobe o limite diário). O CI usa poucos pedidos e faz cache das respostas nos testes unitários;
  - os providers grátis podem **registar ou usar os prompts**, por isso no perfil `dev` **só se usam dados sintéticos**, nunca dados reais de utilizadores, e o `data_collection: deny` fica desligado só neste perfil;
  - a qualidade é inferior, o que é aceitável para testar o fluxo, os schemas e os guardrails, mas não para avaliar a qualidade dos planos.
- **`MODEL_PROFILE=prod`** é usado **só em produção** (issue 24), com os modelos pagos recomendados na tabela, `data_collection: deny` e o escalamento ativo. **Todos os testes** (unitários, E2E, CI, previews e o mini eval durante o desenvolvimento) usam apenas o perfil `dev`, com os modelos grátis. Depois do deploy há um único smoke test em produção, com 3 perfis sintéticos, para confirmar que os modelos pagos respondem.
- **Implementação:** um único ficheiro `models.config.ts` (`dev` e `prod`) com os papéis mapeados para os IDs do OpenRouter, selecionado pela variável de ambiente. Nenhum ID de modelo fica escrito no meio do código. Um teste automático garante que o perfil `prod` nunca contém modelos `:free`.

**Configuração do OpenRouter:**
- `response_format: { type: "json_schema", strict: true }` + `provider.require_parameters: true`, para só usar providers que cumpram o schema;
- `provider.data_collection: "deny"` (e, se possível, só providers ZDR), porque são **dados de saúde** abrangidos pelo RGPD;
- `models: [principal, fallback]` para failover automático se um provider falhar;
- limite de gasto na chave do OpenRouter;
- `user: <hash do user_id>` para tracking de abuso;
- registo de `usage` (tokens e custo devolvidos pelo OpenRouter) no `AiCallLog`, que alimenta o backoffice.

**Fluxo:**
1. Planner gera o plano.
2. Validador determinístico em código: exercícios existem na biblioteca, alergias, macros com ±5%, volume semanal e dias disponíveis.
3. QA Judge avalia o plano.
4. Se o QA reprovar, o feedback volta ao Planner, com um máximo de 2 iterações. Se continuar a falhar, há **1 tentativa com o modelo de escalamento (Sonnet 5.5)**. Se mesmo assim falhar, segue um fallback para um template seguro e o caso fica registado para revisão.

**Rubrica do QA:**
- segurança (lesões, alergias, défice calórico máximo);
- adequação ao objetivo e ao nível;
- progressão;
- equilíbrio muscular;
- exequibilidade (tempo e equipamento);
- variedade e adesão às preferências;
- clareza das explicações.

**Custos:**
- Estimativa: cerca de $0.005 por geração completa com o DeepSeek V4.1 Flash (cerca de 8K tokens de input e 6K de output), mais cerca de $0.004 de QA, ou seja, **menos de $0.01 por plano**. O escalamento para o Sonnet (cerca de $0.08) só acontece nos casos difíceis.
- Prompt caching do system prompt e da biblioteca de exercícios: o OpenRouter passa o `cache_control` aos modelos Anthropic, e o DeepSeek tem cache automática.
- Quota de gerações por nível.
- Failover entre modelos e providers via `models` do OpenRouter.

**Qualidade contínua:**
- eval set offline com perfis sintéticos e casos-limite;
- versionamento de prompts;
- métricas de pass-rate do QA e de rating do utilizador.

### B2. Guardrails contra prompt injection
- **Superfície de input reduzida:** o onboarding usa enums e sliders sempre que possível. Os campos livres (lesões, notas, preferências) têm limite de caracteres.
- **Separação dados/instruções:** o input do utilizador e os documentos do RAG entram sempre como *dados* delimitados (tags XML, por exemplo `<user_notes>`). O system prompt indica explicitamente que o conteúdo dentro dessas tags nunca é instrução. As instruções do operador vão sempre na mensagem `system`, nunca misturadas com o texto do utilizador.
- **Pré-filtro com o modelo leve:** classifica cada campo livre (injection, conteúdo fora do âmbito, red flags médicas) e bloqueia ou sanitiza antes de chegar ao Planner.
- **Saída estritamente estruturada:** o JSON Schema obriga o formato. O modelo não tem tools com efeitos colaterais, por isso uma injection não consegue "fazer" nada, só alterar o texto do plano, e isso é apanhado pela validação e pelo QA.
- **Validação pós-geração:** o QA também verifica se o plano "obedeceu" a instruções vindas do utilizador e não do sistema. Por exemplo, "ignora as alergias" ou "4000 kcal de défice".
- **Isolamento do RAG:** a memória é por utilizador, com Row Level Security no Postgres e filtro `user_id` obrigatório. O texto de um utilizador nunca entra no contexto de outro. O conhecimento global é curado e só escrito pelo admin.
- **Outras proteções:** não expor o system prompt, rate limiting, logging de tentativas e um red-team eval set com prompts de injection conhecidos, corrido em cada alteração de prompt.

### B3. RAG e realimentação por utilizador
Há duas camadas, ambas em Postgres (Supabase) com **pgvector**:
1. **Conhecimento global**, curado e partilhado:
   - biblioteca de exercícios (músculos, equipamento, contraindicações e variações);
   - base nutricional (USDA FoodData Central / Open Food Facts);
   - receitas validadas;
   - guias baseados em evidência (progressão, volume e proteína).

   O conhecimento global usa retrieval híbrido: filtros SQL (equipamento, alergénios) e semelhança vetorial.
2. **Memória do utilizador**, privada:
   - **Dados estruturados (SQL, não embeddings):** perfil, histórico de séries e cargas, e1RM, tendência do peso, adesão e exercícios ou refeições rejeitados ou trocados. Entram no prompt como um resumo calculado, por exemplo: "squat e1RM +5% em 4 semanas; adesão 80%; troca sempre lunges".
   - **Dados qualitativos (embeddings):** feedback pós-treino ("dói o joelho em lunges"), notas, ratings de refeições e resumos semanais gerados pelo modelo leve. São recuperados pelo top-k relevante para o plano em causa.

**Ciclo de realimentação (semanal ou a pedido):**
1. Agregar os logs da semana e o feedback.
2. O modelo leve extrai "factos de memória" (preferências, dores, gostos), que são guardados em tabela e embutidos como embeddings. Os factos antigos ou contraditórios são marcados como obsoletos.
3. O Planner recebe o plano anterior, as métricas e os factos relevantes, e propõe ajustes.
4. O QA avalia e o utilizador vê o diff explicado.
5. O rating do utilizador volta como sinal.

Sem fine-tuning no MVP: a personalização vem do contexto (RAG + memória), que é mais barato, auditável e permite apagar os dados, como o RGPD exige. O utilizador pode ver e apagar a memória ("o que a IA sabe sobre mim").

---

## C. `docs/BRAND_AND_MARKETING.md`

### C1. Nome da app
O critério é simples: o nome tem de comunicar treino + nutrição + adaptação, ser curto, pronunciável em EN e ter domínio e marca disponíveis. A pesquisa mostra que os nomes com "Rep", "Fit" e "Form" estão saturados (RepWise, Repd, Repped, FORMA, Form Coach, Fitify…), por isso evitamos essas raízes.

| Nome | Conceito | Notas |
|---|---|---|
| **Fuelift** (recomendado) | *fuel* + *lift*: a dieta e o treino numa só palavra, que é exatamente o diferenciador. | A pesquisa nas lojas não encontrou conflitos. É fácil de dizer e soletrar. Tagline: *"Train smart. Eat right. Adapts every week."* |
| **Kairo** | Do grego *kairos*, "o momento certo": o plano certo na altura certa. | É curto e premium. Não encontrei conflitos em fitness, mas é um nome mais abstrato e exige mais marketing para explicar. |
| **Tandem** | Treino e dieta a trabalhar juntos. | É uma palavra comum, difícil de registar como marca e com SEO difícil. |
| **Myos** | Do grego "músculo"; liga bem ao Body Map 3D. | A pronúncia é ambígua em EN. |

**Validação antes de decidir:**
- pesquisa de marca registada no EUIPO, no USPTO e no WIPO (classes 9, 41 e 44);
- disponibilidade do nome na App Store e na Google Play;
- domínio `.app` / `.com`;
- handles no Instagram e no Facebook.

Para não atrasar o prazo, esta validação faz-se no dia 0, de forma rápida e automática (pesquisa de marca, domínio, lojas e handles).

Até haver decisão, o nome de trabalho no código continua a ser "GymApp".

### C2. Posicionamento
- **Statement:** "For people who want real results without hiring a coach, Fuelift is the only app that builds your workouts and your meals together and adapts both every week, based on what you actually did."
- **Pilares de mensagem:**
  1. **Feito para ti:** o plano reflete o teu corpo, horário, equipamento e alergias.
  2. **Adapta-se:** o check-in semanal ajusta o plano e explica porquê.
  3. **Treino + comida num só plano:** inclui a lista de compras já feita.
  4. **Vês o progresso:** recordes e tendências (Body Map na v1.1).
- **Segmentos prioritários:**
  1. Intermédios de 20 a 35 anos focados em hipertrofia ou recomposição, que já usam um logger e uma app de calorias separadas e querem juntá-las.
  2. Iniciantes de ginásio que não sabem o que fazer.
  3. Perda de peso com treino de força.
- **Preço como argumento:** o Pro custa $119.99 por ano, contra cerca de $168 por ano do Fitbod e do MacroFactor juntos. Mensagem: "Stop paying for 2 apps".

### C3. Fabrico e publicação de anúncios (Meta: Instagram + Facebook), automatizados por um agente
**Funil:**
1. Anúncio (Reels, Stories ou Feed).
2. Quiz web de 60 segundos com o preview do plano.
3. Checkout Stripe com trial de 7 dias.
4. Uso na web ou download da app.

Os eventos são medidos pelo Meta Pixel e pela Conversions API: `Lead` no fim do quiz, `StartTrial` e `Purchase`, estes dois enviados a partir do webhook do Stripe.

**Fábrica de criativos (agente "Ads", issue E-27):**
1. **Copy:** o Claude gera, para cada ângulo, 5 hooks, o texto principal, o título e o CTA, seguindo o guia de escrita e as regras de conformidade da secção C6. Ângulos:
   - "AI built my plan in 60s";
   - "Workouts + meals in one plan";
   - "$40 high-protein grocery list";
   - "Stop paying for 2 apps";
   - "Plan that adapts every week".
2. **Imagens estáticas** (1:1, 4:5 e 9:16): templates HTML/CSS da marca com screenshots reais da app, gerados automaticamente a partir da versão web e renderizados para PNG com o Playwright.
3. **Vídeos curtos** (9:16, entre 8 e 15 s):
   - gravação automática da versão web com o Playwright (onboarding → plano gerado → lista de compras);
   - legendas, hook animado nos primeiros 2 s e música livre de direitos, montados com ffmpeg.
4. **QA dos criativos:** um revisor verifica as regras de conformidade, a legibilidade e as especificações da Meta (tamanhos, texto, duração) antes de publicar.

**Publicação (Meta Marketing API):**
- **Estrutura:** 1 campanha de vendas Advantage+ (segmentação ampla, mercados EN), 1 conjunto de anúncios e cerca de 10 a 15 anúncios, criados via API com UTMs.
- **Gastos:** tudo é criado em estado **PAUSED**. Ativar e definir o orçamento diário (sugestão: €30 a €50/dia no teste) é uma aprovação tua, porque envolve gastar dinheiro. Também me podes dar autorização explícita com um teto de gasto.
- **Agente diário agendado:**
  1. lê as métricas (CTR, CPM, custo por trial, ROAS);
  2. propõe, ou aplica dentro do teto autorizado, a pausa dos perdedores (por exemplo, CTR abaixo de 1% ou custo por trial acima de 1,5× a meta, depois de cerca de €20 gastos) e um aumento de 20% nos vencedores;
  3. gera 3 a 5 variações novas dos vencedores, com novo hook ou nova legenda, contra a fadiga criativa;
  4. publica um relatório diário numa issue "Ads report".

### C4. KPIs para decidir rápido
| Métrica | Meta inicial (a validar) | Decisão |
|---|---|---|
| CTR do anúncio | > 1% | Abaixo disso, mudar o hook. |
| Conclusão do quiz | > 50% | Abaixo disso, encurtar o quiz. |
| Custo por trial | < €8 a €12 | Controla o escalar. |
| Trial → pago | > 35% | Abaixo disso, rever o onboarding e o valor do plano. |

### C6. Conformidade no marketing
- Sem alegações de saúde enganosas nem resultados garantidos.
- Fotos de antes e depois só com consentimento e com o aviso "results vary".
- Cumprir as políticas de publicidade da Meta para saúde e fitness: nada de imagens que promovam uma autoimagem negativa nem alegações de perda de peso com prazos.
- Consentimento RGPD para emails e tracking.

---

## D. Equipa de agentes e automação (`docs/AGENT_OPERATIONS.md`)

### D1. Papéis
Os modelos de **desenvolvimento** (os agentes que constroem a app) são independentes dos modelos **dentro da app**, que passam pelo OpenRouter (secção B1). Os agentes correm em sessões Claude Code.

| Agente | Modelo | Execução | Função |
|---|---|---|---|
| **Orquestrador / PM** | Claude Opus 5.5 | Tarefa agendada **de hora a hora** (o mínimo permitido), sempre na mesma sessão para manter o contexto | Lê o backlog, escolhe as tasks prontas, lança os implementadores, acompanha o estado, faz a review e o merge, desbloqueia e reporta. Gasta poucos tokens e decide muito, por isso usa o modelo mais capaz. |
| **Implementadores** (até 4 em paralelo) | **Claude Sonnet 5.5**, o modelo mais barato | Uma sessão cloud nova por issue, lançada pelo orquestrador | Implementam uma issue num branch `feat/<n>-<slug>`, correm lint, typecheck e testes e abrem um PR para `main` com `Closes #n`. |
| **Revisor** | Claude Sonnet 5.5 | Sessão lançada pelo orquestrador para cada PR | Faz code review focado em bugs, segurança e critérios de aceitação. Pede alterações ou aprova. |
| **Tarefas triviais** (docs, seeds, copy) | Claude Haiku 5.5 | Igual aos implementadores | Mais barato para trabalho mecânico. |
| **Ads** | Claude Sonnet 5.5 | Tarefa agendada diária a partir do dia 3 | Fábrica e publicação de criativos e otimização (secção C3). |

Se preferires que o orquestrador também use um modelo mais barato (Sonnet 5.5), é só trocar a configuração. Recomendo o Opus 5.5 porque os erros de coordenação custam mais tempo do que os tokens que se poupam.

### D2. GitHub Projects
- **O que tens de fazer (cerca de 2 min):** as ferramentas de GitHub que tenho aqui criam issues, labels, milestones e PRs, mas não mexem nos campos do Projects (v2). Por isso:
  1. Cria o projeto "Fuelift MVP" (vista Board) ligado ao repositório.
  2. Ativa os workflows nativos: *Auto-add to project* (filtro `is:issue repo:Cyb3rWolf945/GymApp`), *Item closed → Done* e *Pull request merged → Done*.
- **O estado também fica nas labels**, que os agentes conseguem gerir:
  - `status:ready`, `status:in-progress`, `status:review`, `status:blocked`;
  - `day:1`, `day:2`, `day:3`;
  - `area:app`, `area:backend`, `area:ai`, `area:payments`, `area:ads`, `area:infra`;
  - `model:sonnet`, `model:haiku`;
  - `priority:must`, `priority:should`.

  No Board, agrupa por label ou por milestone.
- **Milestones:** "Day 1: Foundations", "Day 2: Core features" e "Day 3: Launch".
- **Formato de cada issue:**
  - contexto;
  - critérios de aceitação (checklist);
  - ficheiros e áreas;
  - `Depends on: #x, #y`;
  - comandos de verificação.

  O orquestrador só lança uma issue quando todas as dependências estão fechadas.

### D3. Ciclo do orquestrador (cada hora)
1. Lê as issues abertas, os PRs e o estado das sessões dos implementadores.
2. PR com CI verde e review aprovado: faz merge e fecha a issue. Isto **requer a tua autorização explícita** de merge automático, que a aprovação deste plano dá, para PRs com CI verde e review aprovado. Sem ela, os PRs ficam à espera do teu merge.
3. PR com CI falhado ou alterações pedidas: devolve o feedback à sessão do implementador.
4. Sessão falhada ou parada mais de 2 h: relança a issue ou marca-a como `status:blocked`.
5. Enquanto houver slots livres (máximo 4), lança as issues `status:ready` com as dependências satisfeitas, por prioridade (`must` antes de `should`) e por dia. Evita correr em paralelo duas issues da mesma área com ficheiros sobrepostos.
6. Atualiza uma issue fixa "MVP status" com o progresso, os bloqueios e o que precisa de ti (chaves, contas, decisões).

### D4. Infraestrutura para os agentes
- **CI no GitHub Actions** (é a primeira issue): instalação, lint, typecheck, testes unitários (Vitest), `expo export --platform web` e, no dia 3, os testes E2E com o Playwright na versão web.
- **`CLAUDE.md`:** stack, estrutura de pastas, comandos, Definition of Done ("testes passam, critérios de aceitação cumpridos, sem secrets, copy de acordo com o guia"), convenções de branch e commit e "não alterar ficheiros fora do âmbito da issue".
- **Ambiente cloud dos agentes:**
  - **Hosts de rede permitidos:** `openrouter.ai`, `*.supabase.co`, `api.stripe.com`, `graph.facebook.com`, `expo.dev` e `api.vercel.com`. A lista exata de hosts é aprovada por ti.
  - **Chaves:** guardadas como credenciais do ambiente (pedidas pelo formulário seguro, nunca no chat nem no repositório). Os agentes usam **chaves de teste** do Stripe até ao lançamento.
  - **Setup script:** instala as dependências.
- **Custos dos agentes:** cada implementador Sonnet custa tipicamente entre $1 e $5 por issue. São cerca de 35 issues mais as reviews, e a fatura final depende do tamanho real das tarefas.

## E. Backlog do MVP (issues a criar), em 3 dias
Os agentes trabalham 24 h por dia. Cada dia é um milestone. Formato: **ID. título** (dependências).

**Dia 1: fundações**
1. Scaffold do monorepo Expo universal (expo-router, TS, tema escuro, ESLint/Prettier) + CI no GitHub Actions. *(nenhuma)*
2. Projeto Supabase: schema de todas as entidades, RLS por `user_id`, migrations e tipos gerados. *(1)*
3. Seed da biblioteca de exercícios (cerca de 150, com músculos primários e secundários, equipamento e contraindicações) e de ingredientes e receitas base, com macros (USDA). Modelo: Haiku. *(2)*
4. Auth: magic link, Google e Apple, mais a sessão na app e na web. *(1, 2)*
5. Biblioteca de cálculos determinísticos (TDEE, macros, alvos por dia de treino), com testes. *(1)*
6. Pipeline de IA, parte 1: schemas (Zod → JSON Schema) do plano de treino e do plano alimentar, e Edge Function `generate-plan` assíncrona (GenerationJob) com cliente OpenRouter e perfis de modelos `dev` (grátis) e `prod` (os modelos são primeiro validados pela API de modelos e por um mini eval), com o Planner DeepSeek V4.1 Flash, escalamento para o Sonnet 5.5 e prompt caching. *(2, 3, 5)*
7. Pipeline de IA, parte 2: validador determinístico, QA Judge com GLM 5.3 Flash e a rubrica, loop de retry (máximo 2) e fallback. *(6)*
8. Guardrails: pré-filtro com o modelo leve, tags de dados, limites de input e red-team test set. *(6)*
9. Design system: componentes base e constantes de copy em EN segundo o guia de escrita. *(1)*

**Dia 2: funcionalidades principais**

10. Ecrãs de onboarding 1 a 13. *(4, 9)*
11. Ecrã de geração com progresso em realtime e preview do plano. *(7, 10)*
12. Home "Today" (treino e refeições do dia). *(11)*
13. Sessão de treino: registo de séries pré-preenchidas, temporizador de descanso, recordes pessoais e histórico. *(12)*
14. Vista do plano semanal e "Swap exercise". *(12)*
15. Plano alimentar, receitas e "Swap meal". *(12)*
16. Lista de compras: agregação, categorias e checkboxes. *(15)*
17. Stripe: produtos e preços Basic, Pro e Elite (mensal e anual), Checkout e Customer Portal. Webhooks assinados e idempotentes → tabela `entitlements` (com os eventos da secção 9), tolerância de 7 dias em `past_due`, verificação de acesso no servidor e job diário de reconciliação. *(2, 4)*
18. Paywall e gating por nível, com quotas de geração. *(11, 17)*

**Dia 3: lançamento**

19. Progresso: registo de peso, gráfico e recordes pessoais. Se houver tempo, mapa 2D de músculos (`should`). *(13)*
20. "Update my plan": regenera o plano com um resumo do histórico (memória estruturada). *(7, 13)* `should`
21. Páginas legais (privacidade, termos, disclaimer de saúde), consentimentos RGPD e exclusão de conta. *(4)*
22. Quiz web e landing page (reutilizam o onboarding), Meta Pixel e CAPI (Lead, StartTrial, Purchase). *(10, 17)*
23. Testes E2E com o Playwright na versão web: onboarding → plano → paywall → checkout (Stripe em modo de teste). *(18, 22)*
24. Deploy da web na Vercel com o domínio, Stripe em modo live (com a tua aprovação) e **`MODEL_PROFILE=prod` ativado apenas no ambiente de produção**, seguido de um smoke test com 3 perfis sintéticos. *(23)*
25. Builds EAS de iOS e Android, assets das lojas (screenshots automáticos e textos ASO) e submissão. *(23)*
26. Notificações push básicas (lembrete de treino). *(12)* `should`
27. Agente Ads: fábrica de criativos e publicação PAUSED via Marketing API, e tarefa diária agendada. *(24)*
28. Revisão final de segurança (RLS, secrets, guardrails) e checklist de lançamento. *(24)*

**O que eu faço nesta sessão depois da tua aprovação:**
1. Escrever o `CLAUDE.md`, o `README.md`, o `docs/SPEC.md` e o esqueleto do CI. Commit e push para o branch e criação do `main`.
2. Criar as labels, os milestones, as 35 issues e a issue "MVP status" via GitHub MCP.
3. Dar-te o checklist do dia 0 (contas, chaves e a configuração do GitHub Project) e configurar o ambiente cloud (rede e credenciais), com a tua aprovação em cada passo.
4. Criar a tarefa agendada de hora a hora do orquestrador e lançar já o 1.º ciclo, que começa pelas issues 1, 5 e 9, que não têm dependências entre si.

Os passos 1 a 4 levam cerca de 30 a 60 minutos. A partir daí o tempo vai para código.

---

## F. Backoffice de admin (`apps/admin`)

### F1. Abordagem técnica
- **Stack:** app separada em **Next.js + shadcn/ui + Recharts**, deployed na Vercel em `admin.<domínio>`. É o caminho mais rápido para tabelas e gráficos de dashboard, e os agentes podem construí-la em paralelo com a app principal. Partilha o `packages/shared` (tipos e schemas).
- **Acesso:**
  - login Supabase e role `admin`, guardado num custom claim e numa tabela `admins`;
  - 2FA obrigatório;
  - as queries com a service role correm só no servidor (server components e route handlers), nunca no browser.
- **RGPD:**
  - cada visualização de dados de saúde de um utilizador e cada ação de admin fica registada no `AdminAuditLog`;
  - as listas mostram dados mínimos (email mascarado) e o detalhe completo só aparece ao abrir o utilizador.
- **Fontes de dados:**
  - tabelas Supabase;
  - `AnalyticsEvent`: eventos próprios do funil, mais simples do que integrar já o PostHog;
  - `AiCallLog`: modelo, tokens, custo, latência, effort e resultado do QA, registado em cada chamada;
  - `GuardrailEvent`;
  - entitlements sincronizados do Stripe;
  - `AdInsightDaily`, preenchido pelo agente Ads através da Marketing API.

### F2. Ecrãs e dados
1. **Overview** (`must`):
   - MRR, subscrições ativas por nível (Basic, Pro, Elite), trials ativos, trial → pago, churn do mês, ARPU e receita de 7 e 30 dias;
   - novos utilizadores por dia;
   - receita líquida vs. custos totais de hoje e do mês, e margem (com resumo e link para o ecrã P&L);
   - gasto em ads e custo por trial.
2. **Custos e receita (P&L)** (`must`), para saberes a cada dia se a app dá lucro.
   - **Receita** (Stripe: webhooks e balance transactions):
     - bruta, reembolsos, comissões do Stripe, IVA cobrado e **receita líquida**;
     - MRR e ARR;
     - receita por nível e por plano mensal/anual;
     - novos vs. renovações;
     - previsão de 30 dias a partir das renovações agendadas.
   - **Custos variáveis** (automáticos):
     - **IA (OpenRouter):** custo real por chamada, registado no `AiCallLog` a partir do `usage` devolvido pelo OpenRouter e reconciliado diariamente com o saldo e uso da chave via API do OpenRouter. É mostrado por modelo, por tipo de tarefa (Planner, QA, filtro) e **por utilizador e por nível**.
     - **Ads (Meta):** gasto diário via `AdInsightDaily`.
     - **Comissões de pagamento:** Stripe, e as lojas a 15–30% quando houver IAP na v1.1.
   - **Custos fixos** (registados à mão numa tabela `CostEntry`, com recorrência mensal):
     - Supabase, Vercel e Expo/EAS;
     - domínio e email;
     - Apple Developer e Google Play, amortizados;
     - custo dos agentes de desenvolvimento.
   - **Indicadores:**
     - margem bruta (receita líquida − IA − comissões) e margem de contribuição (− ads);
     - resultado do mês e burn;
     - **ponto de equilíbrio** (quantos subscritores pagos por nível cobrem os custos fixos);
     - CAC, LTV, LTV/CAC e payback.
   - **Por utilizador e por nível:** ARPU vs. custo de IA por utilizador pago, para validar as quotas de geração de cada nível. Exemplo: "um utilizador Pro custa $0.40/mês de IA e paga $X".
   - **Gráficos:** receita vs. custos por dia e por mês (área empilhada), evolução do MRR e top 20 utilizadores por custo de IA (deteta abuso).
   - **Alertas** (email/push ao admin):
     - custo de IA diário acima de X;
     - custo de IA de um utilizador acima de Y% do preço do seu nível;
     - gasto em ads sem trials nas últimas 24 h;
     - falhas nos webhooks do Stripe.
3. **Funil** (`must`): quiz iniciado → quiz concluído → registo → onboarding concluído (com a quebra **por ecrã**, 1 a 13) → preview do plano → paywall → checkout → trial → pago, filtrável por origem (UTM, anúncio ou orgânico).
4. **Saúde da IA** (`must`):
   - gerações por dia;
   - latência p50/p95;
   - custo por geração, por utilizador e total;
   - QA pass rate à 1.ª tentativa, taxa de retries e de fallback;
   - falhas do validador por tipo (alergénio, macros, exercício inexistente);
   - recusas do modelo;
   - versão do prompt ativa.
5. **Segurança e guardrails** (`must`):
   - fila de revisão dos inputs bloqueados (suspeitas de injection e red flags médicas), com o texto, a decisão do filtro e as ações "aprovar", "manter bloqueio" e "contactar o utilizador";
   - tendência das tentativas.
6. **Utilizadores** (`must`):
   - pesquisa por email ou ID;
   - lista com nível, estado da subscrição, data de registo e última atividade;
   - detalhe com:
     - perfil do onboarding;
     - plano atual;
     - histórico de gerações com as notas do QA;
     - treinos registados e adesão;
     - pagamentos, com link para o Stripe.
   - ações:
     - dar um nível de cortesia (comp) com data de fim;
     - regenerar o plano;
     - reenviar o magic link;
     - **exportar ou apagar a conta** (pedidos RGPD).
7. **Anúncios** (`must`):
   - galeria de criativos com o estado (PAUSED, ACTIVE, rejeitado);
   - tabela por anúncio: gasto, impressões, CTR, CPM, custo por trial e ROAS;
   - recomendações do agente Ads, com os botões "aplicar" e "rejeitar". Isto concretiza a tua aprovação dos gastos.
8. **Engagement** (`should`):
   - DAU/WAU, treinos registados por dia e adesão média ao plano;
   - coortes de retenção D1, D7 e D30;
   - exercícios e refeições mais trocados (um sinal de qualidade dos planos).
9. **Conteúdo** (`should`): CRUD da biblioteca de exercícios, das receitas e dos ingredientes; versões de prompt (ver, comparar e ativar); resultados do red-team e do eval set.
10. **Operações** (`could`): links para o Sentry, para o GitHub Project e para a issue "MVP status"; estado dos webhooks do Stripe.

### F3. Issues adicionais no backlog (dias 2 e 3)
29. Instrumentação: tabelas `AnalyticsEvent`, `AiCallLog` e `GuardrailEvent`, com escrita em todos os pontos do funil e do pipeline de IA. *(2, 6)* Dia 2.
30. Scaffold de `apps/admin` (Next.js + shadcn): auth de admin, 2FA, `AdminAuditLog` e deploy na Vercel. *(1, 2, 4)* Dia 2.
31. Ecrãs Overview, Funil e Saúde da IA. *(29, 30, 17)* Dia 3.
32. Ecrãs Utilizadores (detalhe e ações RGPD) e Segurança/guardrails. *(30, 8, 21)* Dia 3.
33. Ecrã Anúncios e tabela `AdInsightDaily` (sincronização pelo agente Ads). *(30, 27)* Dia 3.
34. Ecrãs Engagement e Conteúdo. *(31)* Dia 3, `should`.
35. Ecrã Custos e receita (P&L): sincronização das balance transactions do Stripe, reconciliação diária com o OpenRouter, tabela `CostEntry`, métricas de margem, break-even e unit economics por nível, e alertas. *(29, 30, 17, 33)* Dia 3.

---

## Ficheiros (criados por mim)
- `CLAUDE.md`
- `README.md`
- `docs/SPEC.md`
- `.github/workflows/ci.yml`

O resto do código é criado pelos agentes, a partir das issues.

## Fontes da pesquisa (a citar nos documentos)
- [Trainera: Fitbod pricing 2026](https://trainera.fit/blogs/fitbod-pricing)
- [Calorix: MacroFactor price](https://calorix.ai/compare/macrofactor-price/) e [GymGod: MacroFactor Workouts review](https://gymgod.app/blog/macrofactor-workouts-review)
- [NutriScan: Noom pricing 2026](https://nutriscan.app/blog/posts/noom-pricing-2026-weight-vs-med-cost-breakdown-7a43207a71)
- [RevenueCat: State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps) e [Sahha: Health & fitness conversion benchmarks](https://sahha.ai/blog/health-app-monetization-first-month/)
- [Jefit: Fitbod vs Strong vs Jefit vs Hevy](https://www.jefit.com/blog/fitbod-vs-strong-vs-jefit-vs-hevy)
- [Fitbod review 2026 (Indie Hackers)](https://www.indiehackers.com/post/fitbod-app-review-2026-honest-take-after-real-testing-45d5f07a1b)
- [Boostcamp: best workout apps](https://www.boostcamp.app/best/workout-apps)
- [Fitia: MacroFactor alternatives](https://fitia.app/learn/article/best-macrofactor-alternatives-2026/)
- [Eat This Much (App Store)](https://apps.apple.com/us/app/eat-this-much-meal-planner/id981637806)
- [Duolingo: Voice](https://design.duolingo.com/writing/voice) e [Tone](https://design.duolingo.com/writing/tone)
- [Apple WWDC24: Add personality to your app through UX writing](https://developer.apple.com/videos/play/wwdc2024/10140/)
- [RevenueCat: onboarding too short (Noom)](https://www.revenuecat.com/blog/growth/why-your-onboarding-experience-might-be-too-short)
- [OpenRouter: Models API (filtros por structured_outputs)](https://openrouter.ai/docs/api_reference/models)
- [TeamDay: Top OpenRouter models (Nov 2026)](https://www.teamday.ai/blog/top-ai-models-openrouter-2026) e [Cheapest OpenRouter models (Nov 2026)](https://www.teamday.ai/blog/cheapest-openrouter-models-2026)
- [OfficeChai: top modelos no OpenRouter por tokens (Nov 2026)](https://officechai.com/ai/these-are-the-top-ai-models-on-openrouter-by-number-of-tokens-november-2026/)
- [Anthropic: Embeddings (Voyage AI)](https://platform.claude.com/docs/en/build-with-claude/embeddings)

## Verificação
- Documentos: rever o markdown (títulos, tabelas e IDs FR únicos). Confirmar o commit com `git log` e fazer push com `git push -u origin claude/youthful-cori-kwhfhu`, mais o push para `main`.
- Backlog: listar as issues criadas via MCP e confirmar as 35 issues, com labels, milestones e dependências corretas.
- Orquestrador: confirmar que a tarefa agendada aparece em `list_triggers` e que o 1.º ciclo lançou a sessão da issue 1, com `list_sessions children`.
- Durante os 3 dias: o CI tem de estar verde em cada PR, a issue "MVP status" é atualizada de hora a hora e, no fim, os testes E2E passam na versão web em produção.
