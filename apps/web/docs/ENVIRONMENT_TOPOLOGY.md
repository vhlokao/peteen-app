# Topologia de ambientes — Peteen

Fonte de verdade sobre **quais ambientes existem, o que cada um usa e como o
código sabe em qual está rodando**.

**Nenhum secret aparece aqui.** Referências de projeto Supabase (`ref`) e URLs
públicas são identificadores, não credenciais — a `ref` de produção já é servida
no bundle público de `www.peteen.com.br`, por construção do `NEXT_PUBLIC_*`.
Chaves, senhas e connection strings **nunca** entram neste arquivo.

Criado em GATE-16-DEMO-ENV-FOUNDATION-003.

---

## O aviso que motiva este documento

> **`VERCEL_ENV=production` vai existir nos DOIS projetos Vercel.**

Um projeto Vercel dedicado ao DEMO, quando publicado, também recebe
`VERCEL_ENV=production` — é o estágio da plataforma, não a identidade do
negócio. Tratar `VERCEL_ENV` como identidade faria o DEMO se considerar
produção, e a consequência mais cara é no push: o sender do DEMO ficaria
elegível pelo caminho de legado a **entregar notificação no telefone de usuários
reais**.

Por isso existe `PETEEN_ENV`. É a única resposta confiável para "de qual Peteen
este deploy é".

Esse erro já aconteceu de outra forma e está registrado: relatórios dos Gates 14
e 15 apresentaram leituras do banco de DEMO como se fossem de PRODUÇÃO, porque
a topologia não estava escrita em lugar nenhum.

---

## Ambientes

| | PRODUÇÃO | DEMO |
|---|---|---|
| Aplicação | `www.peteen.com.br` | `peteen-demo.vercel.app` |
| Projeto Vercel | `peteen-app`, ligado ao Git | `peteen-demo`, **sem Git** (deploy manual) |
| Supabase (ref pública) | `aufnokufvhhtbrmtlclw` | o projeto que contém o dataset demo (`hxzlrfyel…`) |
| Banco | o do projeto de produção | o do projeto demo |
| `PETEEN_ENV` | **ausente** (= `production`, compatibilidade) | `demo` |
| `VERCEL_ENV` | `production` | `production` ⚠️ **igual** |
| VAPID | par de produção | **par próprio, gerado para o DEMO** |
| Dados | usuários reais | dataset demo curado |

### Como a produção foi identificada, sem credencial
`NEXT_PUBLIC_SUPABASE_URL` é público por construção. Baixando o bundle servido
por `www.peteen.com.br` aparece **uma única** referência Supabase:
`aufnokufvhhtbrmtlclw.supabase.co`. É o método para reconferir isso a qualquer
momento, e não exige acesso a nada.

---

## Identidade do ambiente

Resolvida por `lib/env/peteen-environment.ts`. Valores aceitos:

`production` · `demo` · `preview` · `development`

Ordem de resolução:

1. **`PETEEN_ENV` válida vence.** É o único jeito de distinguir o DEMO, cujo
   `VERCEL_ENV` também é `production`.
2. **`PETEEN_ENV` presente mas inválida → `development`, com erro no log.** Não
   cai de volta no mapa de `VERCEL_ENV`: um typo não pode virar `production`
   pelo caminho de trás.
3. **Sem `PETEEN_ENV` → mapa de `VERCEL_ENV`**, exatamente como antes. É o que
   preserva a produção atual, que não define a variável.
4. Nada disso → `development` (localhost, CI, container próprio).

**A troca é assimétrica de propósito.** Um typo em produção faz o push de
produção parar: visível, reclamável, revertido num deploy. Um typo que
resolvesse para `production` faria o DEMO acordar telefones reais: silencioso e
irreversível depois de entregue. Entre um erro barulhento e um invisível, o
código escolhe o barulhento.

---

## Política de VAPID

**DEMO tem par VAPID próprio. Nunca o de produção.** As duas metades importam:

- a **privada** de produção não pode existir fora dela;
- a **pública** define o `vapidKeyFingerprint` gravado em cada subscription, e é
  metade da identidade que o dispatcher usa para decidir a quem pode enviar.

Reaproveitar o par faria os fingerprints baterem entre ambientes. O eixo de
ambiente ainda bloquearia (há teste para isso), mas seria a última barreira em
vez da segunda — e barreira única é como se descobre que ela falhou.

---

## Isolamento de push

`runtimeEnvironment` é gravado em cada `PushSubscription` (coluna `VARCHAR(16)`
— `demo` coube **sem migration**). A regra de elegibilidade compara os dois
ambientes por igualdade, então:

- subscription `demo` × sender `production` → **bloqueado**, nos dois sentidos;
- bloqueado **mesmo se a chave VAPID for a mesma**;
- **legado (identidade ausente) em DEMO não é tentado.** A permissão de
  "descobrir enviando" (`legacy_producao`) é exclusiva de produção: uma linha
  sem identidade pode ser de um usuário real, e o DEMO não tem o direito de
  acordá-lo.

---

## Zero cópia de dados entre ambientes

Regra permanente, nas duas direções:

- **não copiar dados de PROD para DEMO** — dado de usuário real não vira material
  de demonstração;
- **não migrar dados de DEMO para PROD** — dado curado não vira histórico real;
- **zero writes em PROD** a partir de qualquer script operacional.

Os scripts de `scripts/` exigem confirmação explícita do banco de destino
(`--target=<ref>`) e recusam escrever sem ela — ver
`scripts/lib/target-db-guard.mjs`. `--dry-run` é garantia real: em modo dry-run
o script sequer recebe cliente capaz de escrever
(`scripts/lib/dry-run-clients.mjs`).

---

## O que se testa onde

| Tipo de teste | Onde | Por quê |
|---|---|---|
| Fluxos funcionais repetitivos, demonstração, testadores externos | **DEMO** | pode sujar dado à vontade |
| Smoke de deploy, guards, rotas públicas | **os dois** | cada deploy é independente |
| Push real em aparelho | **DEMO** | com VAPID de DEMO e contas de DEMO |
| Verificação final antes do piloto | **PROD** | somente leitura, sem criar dado de teste |
| Scripts de seed/cleanup | **DEMO**, com `--target` explícito | nunca em PROD |

---

## Estado — GATE-16-DEMO-ENV-FOUNDATION-003

**Fundação de código: PRONTA.** `PETEEN_ENV`, resolução conservadora,
`runtimeEnvironment: "demo"` e o isolamento de push estão implementados e
testados.

**Infraestrutura: NO AR.** `peteen-demo` existe, com as 12 variáveis aplicadas
**apenas ao target `production`** — deliberadamente nenhuma em `preview`, para
não repetir aqui o compartilhamento de nomes que `peteen-app` tem entre os dois
targets.

Provas colhidas no deploy:

| O que | Como foi provado |
|---|---|
| Ambiente resolvido | `GET /api/environment` → `{"environment":"demo"}` |
| Supabase isolado | bundle público do DEMO contém só `hxzlrfyel…`; a ref de PROD **não aparece** |
| Região efetiva | `X-Vercel-Id: gru1::gru1` |
| Credenciais são do DEMO | ref no host (URL/DB) e autenticação contra o projeto DEMO (chaves `sb_*`) |
| VAPID | par novo, exclusivo — distinto do de PROD e do de desenvolvimento |

**O que ainda falta, e depende de acesso ao Supabase:**

1. adicionar `https://peteen-demo.vercel.app` às Redirect URLs do Supabase **do
   projeto demo** — sem isso Magic Link e OAuth não completam;
2. decidir sobre conectar o projeto ao Git (ver abaixo);
3. QA físico de push com aparelho real.

### Git — decisão pendente, de propósito
O `peteen-demo` está **desconectado** do repositório. Deploy é manual:

```
VERCEL_ORG_ID=<team> VERCEL_PROJECT_ID=<projeto> npx vercel deploy --prod
```

Conectar ao `main` faria cada push publicar em PROD **e** DEMO. É o que mantém o
DEMO honesto como espelho de produção, e por isso é o destino provável — mas
muda o pipeline de produção, então exige decisão humana explícita, não é efeito
colateral de um gate.

### Região — dois campos diferentes, não confundir

Há **duas** respostas para "em que região isto roda", e elas discordam de
propósito:

| Campo | Onde vive | Valor |
|---|---|---|
| Região padrão do projeto | configuração do projeto na Vercel (API: `serverlessFunctionRegion`) | `iad1` |
| Região das funções do app | `apps/web/vercel.json` → `regions` | `gru1` |
| **Região efetiva em runtime** | header `X-Vercel-Id` da resposta | **`gru1`**, em PROD e DEMO |

`vercel.json` é versionado e viaja com o deploy, então vale para **qualquer**
projeto que use este repositório — PROD e DEMO recebem `gru1` pelo mesmo
arquivo. A região padrão do projeto é o que se aplica na ausência dessa
configuração, e aqui ela não se aplica.

Evidência, medida nos dois deploys:

```
peteen-demo.vercel.app   X-Vercel-Id: gru1::gru1::…
www.peteen.com.br        X-Vercel-Id: gru1::gru1::…
```

**A efetiva só se afirma com evidência do deployment real.** Um relatório
anterior deste gate declarou `iad1` como "a região" lendo só o campo da API —
era metade da verdade, e a metade errada.

### Cron
`vercel.json` está no repositório e vale para **qualquer** projeto Vercel que o
use — incluindo o DEMO. Se o cron for habilitado lá, ele roda
`/api/cron/expire-requests` contra o banco do DEMO com o `CRON_SECRET` do DEMO,
o que é correto e inofensivo. **Nada nesta missão altera o cron de produção.**
Se o plano do projeto DEMO não suportar cron, a expiração no DEMO passa a
depender só da sincronização lazy das telas — limitação aceitável, registrada.
