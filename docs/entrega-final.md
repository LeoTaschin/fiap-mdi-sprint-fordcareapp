# Entrega final — gerar o APK e verificar os fluxos

Fecha os critérios **1** (APK com todos os fluxos sem erros) e **4** (build via EAS instalando em device) da rubrica de Mobile. Tarefas `1.2`, `3.5` e `3.6` do backlog.

Rode tudo no **seu terminal, no macOS**, dentro da pasta do projeto.

## Passo 0 — Reinstalar as dependências ⚠️

O `package.json` chegou a ficar com versões incoerentes (Expo 46 com Expo Router 5 e React Native 0.87). Já foi restaurado para o conjunto do **Expo SDK 51 / React Native 0.74.5**, junto com um `package-lock.json` novo, mas a pasta `node_modules` da sua máquina ainda tem a árvore misturada. Antes de qualquer coisa:

```bash
rm -rf node_modules
npm ci
npm test          # tem que dar 101 testes verdes
npm run typecheck # tem que sair vazio
```

Se os dois passarem, a árvore está sã e o build pode seguir. Se `npm ci` reclamar do lock, use `npm install`.

---

## Parte 1 — Gerar o APK

### 1. Entrar na conta Expo

```bash
npx eas login
npx eas whoami      # confirma o usuário
```

### 2. Criar o projeto no EAS

```bash
npx eas init
```

Grava `extra.eas.projectId` no `app.json`. Rode **uma vez só** — rodar de novo cria outro projeto e o `eas.json` usa `appVersionSource: "remote"`, que depende desse id para controlar o `versionCode`.

### 3. Publicar as variáveis de ambiente ⚠️

**Este é o passo que as pessoas esquecem.** O `.env` está no `.gitignore`, e o EAS respeita o `.gitignore` ao enviar o projeto para o servidor de build. Sem esta etapa o APK é gerado normalmente, instala, abre — e **todo login e toda leitura de dados falham**, porque `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` chegam vazias no bundle.

```bash
npx eas env:create
```

O comando é interativo. Responda:

| Pergunta | Resposta |
|---|---|
| Scope | `Project-wide` |
| Name | `EXPO_PUBLIC_SUPABASE_URL` |
| Value | o valor que está no seu `.env` |
| Environments | marque `preview` **e** `production` |
| Visibility | `Plain text` |

Repita para `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

`Plain text` está correto aqui: as duas variáveis têm o prefixo `EXPO_PUBLIC_`, ou seja, são embutidas no bundle e qualquer pessoa consegue lê-las abrindo o APK. Quem protege os dados é a Row Level Security, não o segredo da chave. O que **não** pode acontecer é a chave ir para o GitHub — por isso ela fica no EAS e não no `eas.json`.

Conferir antes de buildar:

```bash
npx eas env:list
```

### 4. Buildar

```bash
npx eas build -p android --profile preview
```

O perfil `preview` já está configurado para `.apk` (o `production` gera o mesmo, com `autoIncrement`). A fila costuma levar 15–25 min no plano gratuito. Ao final o terminal mostra um link; o mesmo link fica em `expo.dev` → projeto → Builds.

### 5. Instalar no aparelho

- **Android físico:** abra o link do build no navegador do celular e instale. Vai pedir para autorizar "instalar apps de fontes desconhecidas".
- **Emulador:** `adb install caminho/para/o.apk`

### Se o build falhar

Leia o log pelo link — o EAS mostra qual fase quebrou.

| Sintoma | Causa provável |
|---|---|
| Falha em *Prebuild* | `app.json` inválido, ou um asset referenciado que não existe |
| Falha em *Install dependencies* | `package-lock.json` fora de sincronia — rode `npm install` e refaça o commit |
| Falha em *Run gradlew* | conflito de plugin nativo; o log aponta o módulo |
| Build passa mas o app abre e nada carrega | a Parte 1.3 não foi feita |

---

## Parte 2 — Roteiro de verificação no aparelho

Critério 1 da rubrica é *"todos os fluxos funcionando **sem erros**"*. Percorra a lista no APK instalado, não no Expo Go — comportamento de permissão e de notificação muda entre os dois.

Use uma conta nova, para exercitar o caminho de quem nunca usou o app.

### Entrada

- [ ] Onboarding aparece nas três telas e o botão "Pular" funciona
- [ ] Criar conta com e-mail novo → cai no cadastro de veículo
- [ ] Cadastro rejeita VIN com menos de 17 caracteres, e também com as letras I, O ou Q
- [ ] Cadastro aceita um VIN válido (ex: `9BFZH54P8M8123456`) e entra no app
- [ ] Fechar e reabrir o app mantém a sessão (token no `expo-secure-store`)

### Home e Copiloto

- [ ] O carro cadastrado aparece com a cor e o modelo certos
- [ ] O card do Copiloto mostra um número real de km/mês, não um texto genérico
- [ ] Tocar na recomendação abre o agendamento com o serviço já marcado
- [ ] Atualizar o KM na Home recalcula as pendências

### Manutenção

- [ ] Pendências listam só os serviços do veículo selecionado
- [ ] Filtros por categoria e por rede oficial / fora da rede funcionam
- [ ] Tocar num item do histórico expande e recolhe

### Serviço fora da rede — **o fluxo que mais quebrou**

- [ ] Registrar uma revisão geral fora da rede, com KM igual ao atual
- [ ] A tela de revisão mostra veículo, serviços, local e data antes de confirmar
- [ ] Ao confirmar, o botão **para de girar** (não fica travado)
- [ ] A pendência de revisão **some** da Home e da tela de Manutenção
- [ ] O registro aparece no histórico marcado como *fora da rede*, com **+0 pts**
- [ ] Repetir com um segundo veículo — a pendência do primeiro **não** pode mudar

### Agendamento

- [ ] Fluxo de três etapas: veículo → serviços e concessionária → revisão
- [ ] Com a permissão de localização concedida, as concessionárias saem ordenadas por distância e mostram os km
- [ ] **Negando** a permissão, a lista aparece na ordem padrão e nada quebra
- [ ] O agendamento criado aparece na aba Agendamentos e abre no detalhe
- [ ] Confirmar a revisão credita os pontos e gera o registro no histórico

### Passaporte e pontos

- [ ] O Passaporte mostra chassi, fabricante, ano-modelo e o percentual na rede oficial
- [ ] A linha do tempo distingue visualmente rede oficial de fora da rede
- [ ] Compartilhar o passaporte abre a folha de compartilhamento do sistema
- [ ] Resgatar um benefício **debita** os pontos e **não** rebaixa o nível
- [ ] Tentar resgatar sem saldo mostra mensagem clara, sem travar

### Notificações e erros

- [ ] O app pede permissão de notificação e agenda o lembrete sem erro
- [ ] Ativar o modo avião e tentar salvar algo → mensagem "Sem conexão", não uma tela branca
- [ ] Nenhuma mensagem de erro expõe nome de tabela, política RLS ou stack trace

### Antes de entregar

- [ ] Limpar os registros de teste no Supabase
- [ ] Marcar `1.2`, `3.5` e `3.6` como concluídas em `docs/sprint3-backlog.md`
- [ ] Colocar o link do build (ou o `.apk`) onde a instrução do Teams pedir
