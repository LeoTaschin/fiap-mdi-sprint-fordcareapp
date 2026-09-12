# FordCare — Backlog da Sprint 3

**Desafio:** Ford 02 — Impulsionando o VIN Share na América do Sul
**Disciplina:** Mobile Development and IoT · **Responsável:** Leonardo Taschin (RM 554583)
**Entrega:** 27/09 · **Sprint 4 (pitch):** 11/10

---

## Como ler este backlog

| Campo | Valores |
|---|---|
| **Prioridade** | `MUST` (critério direto da rubrica) · `SHOULD` (feedback da Ford / alto retorno) · `COULD` (bônus) |
| **Pontos** | Poker Scrum — 1, 2, 3, 5, 8 |
| **Dep.** | Tarefa que precisa estar pronta antes |

**Total: 57 pontos.** `MUST` = 26 · `SHOULD` = 21 · `COULD` = 10.
Os 26 pontos de `MUST` garantem a nota da rubrica. Os 47 de `MUST + SHOULD` entregam a nota **e** respondem aos três pontos levantados pela Ford.

### Os 4 critérios da rubrica de Mobile (Sprint 3)

1. Versão final e publicável em **APK**, com todos os fluxos do desafio funcionando **sem erros**
2. **Identidade visual consolidada** — consistência de componentes, cores, tipografia e UX em todas as telas
3. Produto finalizado — **código organizado, README completo, demonstração visual de todas as telas**
4. Build final via **Expo EAS Build**, instalando e executando em dispositivo ou emulador

Não há critério de "inovação" nesta rubrica. A nota vem de terminar bem.

---

**Legenda:** `[x]` concluída · `[~]` parcial, com bloqueio anotado na própria tarefa · `[ ]` aberta.

Situação em 09/09: **12 concluídas, 1 parcial, 3 abertas.** Entrega da Sprint 3 em 27/09.

---

## ÉPICO 1 — Desbloquear e limpar (Semana 1)

> Tudo aqui é esforço baixo com impacto direto na rubrica. As tarefas 1.3 a 1.6 são independentes entre si e podem ser distribuídas no grupo.

### [x] 1.1 — Corrigir template literals em `utils/formatKm.ts` · `MUST` · 1 pt
Linhas 14 e 40 estão sem as crases, o que gera `SyntaxError` e impede o bundler de subir. `VehicleCard`, `AlertCard` e `MaintenanceItem` importam `formatKm`.

**Critério de aceite:** `npx expo start` sobe sem erro e a Home renderiza o card do veículo.
**BDD:** *Dado* um clone limpo do repositório, *quando* eu rodo `npm install && npx expo start`, *então* o app compila e abre sem erro de sintaxe.

---

### [~] 1.2 — Criar `eas.json` e rodar build APK de teste · `MUST` · 5 pts · **Dep. 1.1**
Rodar já na primeira semana, mesmo com o app como está. O objetivo é descobrir cedo os problemas de conta Expo, `projectId`, credenciais Android e fila de build. Remover também o `googleMapsApiKey` placeholder do `app.json`.

**Critério de aceite:** um APK gerado pelo EAS instala e abre em device ou emulador.
**BDD:** *Dado* o projeto configurado, *quando* eu rodo `eas build -p android --profile preview`, *então* recebo um APK instalável.
**Status:** `eas.json` criado com os perfis de build. Falta rodar `npx eas login`, `eas init` e `eas build -p android --profile preview` — é o único passo que exige a conta Expo do Leo.


---

### [x] 1.3 — Comprimir os 47 MB de PNG dos carros · `MUST` · 2 pts
20 imagens em `assets/Carros` a ~2,3 MB cada. Converter para WebP (~150 KB) derruba o APK de 60 MB+ para algo instalável.

**Critério de aceite:** `assets/Carros` abaixo de 5 MB e todos os modelos/cores ainda renderizando na Home.

---

### [x] 1.4 — Remover código e dependências mortos · `MUST` · 2 pts
`firebase` e `react-native-maps` do `package.json` (zero imports no projeto), `contexts/VehicleContext.tsx` (órfão, 102 linhas), e atualizar o `CLAUDE.md`, que ainda documenta Firebase e uma estrutura de pastas que não existe mais.

**Critério de aceite:** nenhuma dependência não utilizada no `package.json`; documentação bate com o código.

**Status:** `firebase` e `react-native-maps` fora do `package.json`, `contexts/VehicleContext.tsx` e os hooks órfãos removidos, `CLAUDE.md` sem nenhuma menção a Firebase. As quatro dependências que não aparecem em import direto (`expo-font`, `expo-linking`, `expo-system-ui`, `react-native-screens`) são exigências do Expo Router e do Expo — remover quebraria a navegação.

---

### [x] 1.5 — Ligar ordenação de concessionárias por distância · `COULD` · 2 pts
`getDealershipsNearby` já está implementado em `services/location.ts` e ninguém chama. Ligar na tela de agendamento ordena por proximidade e passa a justificar a permissão `ACCESS_FINE_LOCATION` — que hoje é pedida sem uso e pesa contra na auditoria de permissões da entrega de Cybersecurity.

**Critério de aceite:** com permissão concedida, a lista aparece ordenada por distância; com permissão negada, cai na ordem padrão sem quebrar.

**Status:** `getDealershipsNearby` ligado no `components/DealershipPicker.tsx`. Com permissão concedida a lista sai ordenada por distância e mostra os km de cada concessionária; negada, cai na ordem padrão sem quebrar o fluxo.

---

### [x] 1.6 — Consertar as features de fachada do Perfil · `MUST` · 3 pts
`handleResgate` só abre um `Alert`: não debita pontos nem persiste. "Indicar amigo +100 pts" está anunciado em `HOW_TO_EARN` e não existe. Implementar ou remover da UI — deixar como está lê como fluxo quebrado.

**Critério de aceite:** nenhum botão do app abre um alerta vazio ou deixa de fazer o que anuncia.

**Status:** o resgate passou a debitar de verdade, via RPC `resgatar_beneficio` com `FOR UPDATE` (`services/benefits.ts`) — dois aparelhos do mesmo usuário não resgatam o mesmo saldo duas vezes. "Convidar um amigo" virou `Share.share` nativo, sem promessa de pontos que não existem.

---

## ÉPICO 2 — Inovação: resposta aos 3 pontos da Ford (Semana 2)

### [x] 2.1 — Notificação proativa do alerta a vencer · `SHOULD` · 3 pts
Melhor relação custo/benefício do projeto. `expo-notifications` já está instalado e já é usado em `agendamento/novo.tsx`. Agendar lembrete local para o alerta prestes a vencer, com o texto do Copiloto. É o "lead de serviço proativo" que a Ford pediu na apresentação.

**Critério de aceite:** ao se aproximar do vencimento de um alerta, o usuário recebe notificação local com CTA para agendar.
**Responde a:** *"sugestão personalizada com IA que checa o status do veículo"*

---

### [x] 2.2 — Copiloto, camadas 1 e 2 · `SHOULD` · 5 pts
**Camada 1 (sinais):** km/mês derivado do histórico, idade do veículo, alertas vencidos e a vencer, dias desde o último serviço na rede.
**Camada 2 (score):** risco de evasão 0–100 por heurística explicável, com pesos declarados em `constants/`.
Substituir o card "Diagnóstico" da Home pelo card "Copiloto": uma recomendação priorizada, o porquê visível, estimativa de custo e CTA que leva ao agendamento com os serviços já pré-selecionados.

**Critério de aceite:** a Home mostra uma recomendação priorizada com justificativa numérica; o CTA abre o agendamento pré-preenchido.
**Responde a:** *"sugestão personalizada com IA"* · **Integração:** ponto de plug do modelo do time de ML.

---

### [x] 2.3 — Passaporte do VIN (escopo reduzido) · `SHOULD` · 8 pts
`utils/vin.ts` com validação offline: 17 caracteres, sem I/O/Q, WMI nas posições 1–3, código de ano na posição 10; dígito verificador da posição 9 como **aviso**, nunca bloqueio (não é obrigatório no Brasil). Campo `vin` no cadastro de veículo e coluna `vin` em `maintenances`. Tela "Passaporte" com linha do tempo do VIN e selo de continuidade. Sem refazer RLS — o modelo completo fica documentado como evolução para a Sprint 4.

**Critério de aceite:** VIN inválido é rejeitado com mensagem clara; a tela Passaporte lista o histórico ancorado no VIN.
**Responde a:** *"histórico de revisão após troca de dono"* — e ao nome do desafio.

---

### [ ] 2.4 — Fluxo de transferência de propriedade · `COULD` · 5 pts · **Dep. 2.3**
Dono atual gera código de transferência com expiração; comprador informa o código e herda o histórico técnico do VIN (serviços, datas, km, concessionária) **sem nenhum dado pessoal** do dono anterior.

**Critério de aceite:** após a transferência, o comprador vê o histórico técnico completo e nenhum dado do vendedor.
**Responde a:** feedback nº 2 · **Integração:** gancho de pseudonimização para a entrega de Cybersecurity.
**Candidata a corte** se o cronograma apertar — o Passaporte sozinho já demonstra a ideia.

**Status:** cortada conscientemente, como o próprio card previa. O Passaporte do Veículo já demonstra a tese — o histórico vive no chassi e sobrevive à troca de dono. A transferência ativa é evolução natural para a Sprint 4 e entra no pitch como próximo passo, não como dívida.

---

## ÉPICO 3 — Acabamento e entrega (Semana 3)

> É aqui que a nota de Mobile é efetivamente ganha.

### [x] 3.1 — Narrativa dentro do produto · `SHOULD` · 5 pts
Onboarding de 3 telas antes do login: *o problema* (fora da rede se perde garantia, peça original e histórico) → *a solução* (passaporte + copiloto) → *o ganho* (pontos e valor de revenda). Card "Histórico na rede oficial: X%" no Perfil, traduzindo o VIN Share em benefício para o cliente.

**Critério de aceite:** um avaliador que abre o app pela primeira vez entende o problema de negócio sem ler o README.
**Responde a:** *"contar melhor a ideia do app"* · Alimenta o pitch da Sprint 4.

---

### [x] 3.2 — Passada de consistência visual · `MUST` · 5 pts
Critério literal da rubrica. Corrigir o padding inferior da Home (o card de atalhos fica escondido atrás da TabBar flutuante), padronizar tokens de cor e tipografia, garantir estados de loading e erro em todas as telas.

**Critério de aceite:** todas as telas usam os mesmos tokens de `constants/theme.ts`; nenhum conteúdo fica encoberto pela TabBar.

---

### [x] 3.3 — Testes automatizados das funções puras · `COULD` · 3 pts · **Dep. 2.3**
Jest com preset `jest-expo` configurado em `package.json`. **101 testes verdes** em 6 suítes cobrindo `utils/vin.ts`, `utils/alerts.ts` (`computeAlerts`, `historicoDoVeiculo`, `descreverAlerta`), `utils/copiloto.ts`, `constants/serviceCategories.ts`, `utils/safeError.ts` e os formatadores. Cobertura de 91% em statements nos arquivos testados.

Rodar com `npm test`, `npm run test:coverage` e `npm run typecheck`.

Dois bugs reais viraram teste de regressão: o desempate por quilometragem entre serviços do mesmo dia e a ordenação do `ERROR_MAP` — o padrão amplo de RLS capturava "violates" antes da regra de chave duplicada e devolvia a mensagem errada.

**Critério de aceite:** ✅ suíte roda verde e a evidência entra na entrega de Testing/QA.

---

### [x] 3.4 — Reescrever README e recapturar todas as telas · `MUST` · 3 pts
Critério literal. Reescrever a partir do problema de negócio (VIN Share) e não da lista de features, corrigir a stack (Supabase, não Firebase), incluir as telas novas e recapturar todos os screenshots.

**Critério de aceite:** README cobre problema, solução, stack, como rodar e demonstração visual de **todas** as telas.

**Status:** README reescrito a partir do problema de negócio (VIN Share), stack corrigida para Supabase. As **22 telas** do app foram recapturadas na build atual (390 x 844, densidade 2x) — inclusive boas-vindas, login, cadastro de conta, detalhe do agendamento e as duas telas de revisão dos fluxos de três etapas, que a V1 não cobria. Todos os links do README resolvem e nenhuma rota do `app/` ficou de fora. Os screenshots da V1 foram movidos para `_to_delete/screenshots-v1/`. Peso da pasta caiu de 8,6 MB para 2,0 MB.

---

### [ ] 3.5 — Gerar o APK final e testar a instalação · `MUST` · 3 pts · **Dep. 3.2, 3.4**
Build de produção via EAS, instalar em device físico ou emulador, confirmar que abre e roda. Entregar o link ou arquivo conforme a instrução no Teams.

**Critério de aceite:** APK instalado em device real percorre todos os fluxos sem crash.

---

### [ ] 3.6 — Verificação final — percorrer todos os fluxos · `MUST` · 2 pts · **Dep. 3.5**
Varredura caçando erro: cadastro, login, cadastro de veículo com VIN, atualizar KM, alertas, agendamento nas 3 etapas, confirmação de revisão, histórico, transferência, resgate de benefício, notificação. Conferir os 4 critérios da rubrica um a um.

**Critério de aceite:** nenhum botão abre alerta vazio ou deixa de fazer o que anuncia; os 4 critérios conferidos e assinados.

---

## Release plan

| Semana | Período | Épico | Pontos |
|---|---|---|:--:|
| 1 | 04/09 – 12/09 | Desbloquear e limpar | 15 |
| 2 | 13/09 – 20/09 | Inovação | 21 |
| 3 | 21/09 – 27/09 | Acabamento e entrega | 21 |

**Sprint 4 (11/10):** pitch + vídeo técnico, máx. 6 min. Levar o modelo completo do Passaporte (RLS por VIN, herança pseudonimizada) e a camada 3 do Copiloto como evolução, mesmo que não implementados.

---

## Fora de escopo nesta sprint

Decidido explicitamente para proteger o cronograma:

- Dashboard completo de concessionária
- OCR de quilometragem pela câmera
- Mapa com `react-native-maps` — a dependência será **removida**
- Chat livre com modelo de linguagem
- Camada IoT com hardware OBD-II/BLE — entra como **arquitetura e documento** na entrega de Cybersecurity, que é onde IoT é de fato cobrado; a rubrica de Mobile da Sprint 3 não pede IoT
