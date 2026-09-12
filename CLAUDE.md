# FordCare — Contexto do Projeto

> Arquivo de contexto para uso no Claude Code. Cole este conteúdo no início de qualquer sessão para dar contexto completo do projeto.

---

## O que é o FordCare

FordCare é um app mobile desenvolvido como Sprint avaliativa da FIAP (Mobile Development & IoT — 3º ano de Engenharia de Software), em parceria com a Ford. O app responde ao **Desafio 02 — Impulsionando o VIN Share na América do Sul**, cujo objetivo é aumentar a retenção de clientes no pós-venda das concessionárias Ford.

O VIN Share representa a porcentagem de veículos Ford que utilizam a rede oficial para manutenções. O FordCare combate a evasão para mecânicas não autorizadas através de alertas inteligentes, agendamento facilitado e um programa de pontos que recompensa fidelidade.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | React Native + Expo (SDK 51+) |
| Navegação | Expo Router (file-based) |
| Estado global | Context API + useReducer |
| Persistência local | AsyncStorage |
| Backend / Auth | Supabase (PostgreSQL + Auth + Row Level Security) |
| Token em repouso | expo-secure-store (Keychain / EncryptedSharedPreferences) |
| Geolocalização | expo-location |
| Notificações | expo-notifications |
| Estilização | StyleSheet nativo + Expo Google Fonts |
| Fontes | Barlow Condensed (display) + Barlow (body) |

---

## Identidade Visual

| Token | Valor |
|---|---|
| Azul Ford (primário) | `#003478` |
| Azul Ford claro | `#0057A8` |
| Amarelo (ação/destaque) | `#F5A623` |
| Verde (sucesso/ok) | `#1E8A44` |
| Vermelho (erro/urgente) | `#D62B2B` |
| Fundo | Branco `#FFFFFF` |
| Texto principal | `#111111` |
| Texto secundário | `#666680` |

Botões primários: fundo `#003478`, texto branco, bordas arredondadas (pill style).
Botões de ação destacada: fundo `#F5A623`, texto escuro.

---

## Estrutura de Pastas

```
fordcare/
├── app/
│   ├── index.tsx                  → Splash / Onboarding
│   ├── auth/
│   │   ├── login.tsx              → Tela de Login
│   │   └── cadastro.tsx           → Tela de Cadastro de Conta
│   ├── veiculo/
│   │   └── cadastro.tsx           → Cadastro do Veículo (first-run)
│   └── (tabs)/
│       ├── _layout.tsx            → Layout da Tab Bar
│       ├── home.tsx               → Home — Painel do Veículo
│       ├── manutencoes.tsx        → Manutenções (Alertas + Histórico)
│       ├── agendamento.tsx        → Mapa + Agendamento
│       └── perfil.tsx             → Perfil + Pontos + Benefícios
├── components/
│   ├── VehicleCard.tsx            → Card principal do veículo na Home
│   ├── AlertCard.tsx              → Card de alerta de manutenção
│   ├── MaintenanceItem.tsx        → Item do histórico de manutenções
│   ├── DealershipCard.tsx         → Card de concessionária no mapa
│   ├── PointsBadge.tsx            → Badge de pontos do usuário
│   ├── BenefitCard.tsx            → Card de benefício para resgate
│   └── ui/
│       ├── Button.tsx             → Botão reutilizável (variantes: primary, secondary, ghost)
│       ├── Input.tsx              → Input com floating label e estado de erro
│       ├── Toast.tsx              → Feedback de sucesso/erro
│       └── BottomSheet.tsx        → Modal bottom sheet reutilizável
├── contexts/
│   └── UserContext.tsx            → Estado global: perfil, veículos, manutenções
├── services/
│   ├── supabase.ts                → Client Supabase com SecureStore como storage
│   ├── auth.ts                    → Login, cadastro, logout
│   ├── vehicle.ts                 → CRUD de veículos
│   ├── maintenance.ts             → CRUD de manutenções + pontuação
│   ├── agendamentos.ts            → CRUD de agendamentos
│   ├── auditLog.ts                → Trilha de auditoria de ações críticas
│   ├── location.ts                → Geolocalização e concessionárias próximas
│   └── notifications.ts           → Agendamento de notificações locais
├── constants/
│   ├── maintenanceRules.ts        → Regras de alertas por km e tempo
│   ├── theme.ts                   → Cores, espaçamentos, tipografia
│   └── fordDealerships.ts         → Dataset estático de concessionárias Ford SP
├── hooks/
│   ├── useAlerts.ts               → Computa alertas por tipo de serviço
│   ├── useUser.ts                 → Re-export do UserContext
│   └── useAuth.ts                 → Hook de sessão Supabase
└── utils/
    ├── formatKm.ts                → Formata "38540" → "38.540 km" (+ datas)
    ├── formatDate.ts              → Formata datas em pt-BR
    ├── generateReport.ts          → Texto do card de diagnóstico da Home
    ├── safeError.ts               → Sanitiza erros antes de exibir
    └── daysSince.ts               → Calcula dias desde uma data
```

---

## Modelo de Dados (Supabase / PostgreSQL)

Tabelas relacionais com Row Level Security por `user_id`.

```
profiles          id (uuid, = auth.users.id) · name · email · points · level · created_at
vehicles          id · user_id → profiles · brand · model · color · year
                  current_km · last_service_km · last_service_date · created_at
maintenances      id · user_id → profiles · vehicle_id → vehicles · type · date
                  km · dealership · notes · points_earned · created_at
agendamentos      id · user_id → profiles · vehicle_id → vehicles · vehicle_model
                  vehicle_color · vehicle_year · dealership_id · dealership_name
                  problems (jsonb) · status · created_at
audit_logs        id · user_id · action · resource · status · metadata (jsonb) · created_at
                  (política dupla: usuário só insere, nunca lê nem edita)
```

Ver `supabase/audit_logs.sql` para o DDL da trilha de auditoria.

---

## Lógica de Alertas

```ts
// constants/maintenanceRules.ts
export const MAINTENANCE_RULES = [
  { type: "Troca de Óleo",    intervalKm: 10000, intervalDays: 180, points: 100 },
  { type: "Revisão Geral",    intervalKm: 20000, intervalDays: 365, points: 200 },
  { type: "Rodízio de Pneus", intervalKm: 10000, intervalDays: 180, points: 100 },
  { type: "Filtro de Ar",     intervalKm: 15000, intervalDays: 270, points: 80  },
]

// Status de cada alerta
// "urgente"  → km ou dias já ultrapassados
// "atencao"  → faltam menos de 1.500 km ou 30 dias
// "ok"       → dentro do prazo
```

---

## Fluxo de Navegação

```
Splash (index.tsx)
  ↓
  ├── [novo usuário] → Cadastro de Conta → Cadastro do Veículo → Home
  └── [já tem conta] → Login → Home

Home (tabs)
  ├── Tab 1: Home          → Painel + alertas rápidos + atalhos
  ├── Tab 2: Manutenções   → Aba Alertas / Aba Histórico + FAB registrar
  ├── Tab 3: Agendar       → Mapa + bottom sheet de agendamento
  └── Tab 4: Perfil        → Dados do usuário + pontos + benefícios + configurações
```

---

## Telas e Copy

### 01 — Splash
- **App name:** FordCare
- **Tagline:** Seu Ford. Sempre em dia.
- **Subtítulo:** Manutenção inteligente, concessionárias próximas e benefícios exclusivos para quem cuida do seu Ford na rede oficial.
- **Botão primário:** Começar agora →
- **Link:** Já tenho conta. Entrar

### 02 — Cadastro de Conta
- **Título:** Crie sua conta
- **Subtítulo:** Leva menos de 1 minuto. Seus dados ficam seguros com a gente.
- **Campos:** Nome completo · E-mail · Senha · Confirmar senha
- **Botão:** Criar conta
- **Erros:** "Este campo é obrigatório" / "As senhas não coincidem" / "Esse e-mail já está cadastrado. Que tal fazer login?"

### 03 — Login
- **Título:** Bem-vindo de volta
- **Subtítulo:** Seu Ford está esperando por você.
- **Campos:** E-mail · Senha
- **Links:** Esqueci minha senha · Não tem conta? Cadastre-se grátis
- **Erro:** E-mail ou senha incorretos. Tente novamente.

### 04 — Cadastro do Veículo
- **Título:** Qual é o seu Ford?
- **Subtítulo:** Essas informações nos ajudam a calcular quando seu veículo precisa de atenção.
- **Campos:** Modelo · Ano · KM atual · Data da última revisão · KM da última revisão
- **Botão:** Salvar e acessar o app →
- **Skip:** Pular por agora (você pode adicionar depois)

### 05 — Home
- **Saudação:** Olá, [Nome] 👋
- **Subtítulo do card:** Veja como está seu [Modelo]
- **Status:** ● Veículo em dia / ● Atenção necessária / ● Revisão urgente
- **Atalhos:**
  - 📅 Agendar revisão — *Encontre uma concessionária perto de você*
  - 🔧 Ver histórico — *Todas as manutenções do seu Ford*
  - 📍 Atualizar km — *Mantenha seus alertas sempre precisos*
  - ⭐ Meus pontos — *[saldo] pts · Nível [nível]*

### 06 — Manutenções
- **Título:** Manutenções
- **Subtítulo:** Acompanhe a saúde do seu Ford e nunca perca uma revisão.
- **Abas:** Alertas · Histórico
- **Chips de filtro:** Todos · Revisão · Óleo · Pneus · Filtro
- **FAB:** + Registrar serviço
- **Estado vazio (alertas):** ✓ Tudo em dia! Seu Ford está ótimo por enquanto.
- **Estado vazio (histórico):** Nenhuma revisão registrada ainda. Registre sua primeira manutenção e comece a acumular pontos.

### 07 — Registrar Manutenção (Bottom Sheet)
- **Título:** Registrar serviço
- **Subtítulo:** Registre revisões na rede oficial e ganhe pontos FordCare.
- **Tipos:** 🛢️ Troca de óleo · 🔧 Revisão geral · 🔄 Pneus · 💨 Filtro de ar · ⚙️ Outro
- **Preview pontos:** Você vai ganhar +[X] pontos com esse registro 🎉
- **Botão:** Registrar serviço
- **Toast:** ✓ Serviço registrado! +[X] pontos adicionados.

### 08 — Agendamento
- **Título:** Concessionárias Ford
- **Subtítulo:** Encontre a mais próxima de você
- **Busca:** Buscar por nome ou bairro…
- **GPS negado:** Não conseguimos sua localização. Busque pelo seu CEP ou cidade.
- **Bottom sheet título:** Agendar visita
- **Bottom sheet subtítulo:** Escolha o melhor dia e a gente cuida do resto.
- **Campos:** Data preferida · Tipo de serviço
- **Botão:** Confirmar agendamento
- **Toast:** ✓ Agendado! Você receberá um lembrete no dia anterior.

### 09 — Perfil + Pontos
- **Título:** Seu perfil
- **Subtítulo:** Seus pontos, benefícios e configurações da conta.
- **Card pontos:** Saldo: [X] pts · Nível: [nível] · Faltam [X] pts para [próximo nível]
- **Link:** Como ganhar mais pontos →
- **Como ganhar:** Revisão +200pts · Óleo +100pts · Indicar amigo +100pts · Completar perfil +50pts
- **Resgates:** 10% desconto (500pts) · Lavagem grátis (300pts) · Revisão grátis (1500pts)
- **Configurações:** Meu veículo · Notificações · Sair da conta
- **Toast resgate:** ✓ Benefício resgatado! Apresente na concessionária.

### 10 — Atualizar KM (Bottom Sheet)
- **Título:** Atualizar km
- **Subtítulo:** Mantenha o km atualizado para alertas precisos.
- **KM exibido:** KM atual: [X] km
- **Botão:** Atualizar quilometragem
- **Erro:** O novo km não pode ser menor que o atual ([X] km)
- **Toast:** ✓ Quilometragem atualizada para [X] km
- **Alerta pós-update:** ⚠️ Nova atualização: [serviço] agora está vencido. Agendar?

---

## Critérios de Avaliação — Sprint 3 (entrega 27/09)

Os quatro objetivos da rubrica de Mobile Development and IoT:

1. Versão final e publicável em **APK**, com todos os fluxos do desafio Ford funcionando **sem erros**
2. **Identidade visual consolidada** — consistência de componentes, cores, tipografia e UX em todas as telas
3. Produto finalizado — **código organizado, README completo, demonstração visual de todas as telas**
4. Build final via **Expo EAS Build**, instalando e executando em dispositivo ou emulador

Não há critério de "inovação" nesta rubrica: a nota vem de terminar bem.
Backlog detalhado da sprint em `docs/sprint3-backlog.md`.

---

## Requisitos do Repositório

- **Nome:** `fiap-mdi-sprint-fordcare`
- **Visibilidade:** Público
- **Branch principal:** `main` sempre funcional
- **Commits:** Descritivos — proibido "fix", "update", "asdfsdf"
- **Todos os membros** devem ter commits relevantes

---

## Instruções para o Claude Code

Ao receber tarefas de desenvolvimento deste projeto, considere sempre:

1. **Expo Router** para navegação — não use React Navigation diretamente
2. **Supabase Auth** para autenticação — não implemente auth manual
3. **Context API** para estado global — não use Redux ou Zustand
4. **AsyncStorage** para cache local; **expo-secure-store** para o token de sessão
5. **expo-notifications** para lembretes — configure no app.json
6. **TypeScript** em todos os arquivos
7. Identidade visual Ford: use sempre os tokens de `constants/theme.ts` (primária `#133A7C`) — nunca cores hardcoded
8. Todos os textos em **português brasileiro**
9. Feedbacks visuais obrigatórios em operações assíncronas (loading, erro, sucesso)
10. Componentes reutilizáveis em `/components` — evite duplicação de código