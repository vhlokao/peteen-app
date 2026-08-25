/**
 * Módulo: invite
 * Camada: domain — regras puras do funil de aquisição por convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE MÓDULO MEDE — E O QUE ELE NÃO PROVA
 *
 * A landing pública `/p/[professionalId]` existe para testar a hipótese de que
 * profissionais são um canal de entrada de tutores. Cada visita vira uma linha
 * de `InviteVisit`, e o funil (aberto → cadastrou → criou pet → pediu
 * atendimento → concluiu) é preenchido a partir de eventos REAIS de domínio.
 *
 * ATRIBUIÇÃO É POR LANDING ABERTA, NÃO POR REMETENTE. Não há como observar
 * quem enviou a mensagem — qualquer pessoa pode encaminhar o link de qualquer
 * profissional. A leitura correta da métrica é "conversão originada pela
 * landing de X", nunca "X enviou o convite". Confundir os dois transformaria
 * um número honesto de canal numa suposta prova de esforço individual.
 *
 * NADA AQUI TOCA TRUST. Abrir link, cadastrar ou criar pet não são sinais de
 * confiança — são eventos de aquisição. O Trust Engine continua lendo apenas
 * TrustEvents e conclusões reais de ServiceRequest.
 */

/** Nome do cookie first-party que guarda a chave anônima do visitante. */
export const VISITOR_KEY_COOKIE = "peteen_vk"

/**
 * Tamanho da chave em bytes de entropia (vira 32 caracteres hex).
 * Não é segredo — não autoriza nada. É só um identificador estável o
 * suficiente para não contar o mesmo F5 dez vezes.
 */
export const VISITOR_KEY_BYTES = 16

/** Teto da coluna (VarChar(64)) — recusa antes de chegar ao banco. */
export const VISITOR_KEY_MAX_LENGTH = 64

/**
 * Retenção do cookie. 90 dias cobre com folga a janela realista entre receber
 * um convite no WhatsApp e decidir contratar, sem virar rastreamento de longo
 * prazo.
 */
export const VISITOR_KEY_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

/**
 * Uma chave válida é exatamente o que NÓS geramos: hex minúsculo de
 * comprimento fixo. Qualquer outra coisa vinda do cookie (editado à mão,
 * herdado de outro sistema, com PII colada dentro) é descartada e uma nova é
 * emitida — o cookie é entrada não confiável como qualquer outra.
 */
export function isValidVisitorKey(value: string | null | undefined): value is string {
  if (!value) return false
  if (value.length !== VISITOR_KEY_BYTES * 2) return false
  if (value.length > VISITOR_KEY_MAX_LENGTH) return false
  return /^[0-9a-f]+$/.test(value)
}

/**
 * Gera uma chave anônima nova.
 *
 * ALEATÓRIA, NÃO DERIVADA. Nada de IP, user-agent, idioma, resolução ou
 * qualquer combinação disso — fingerprint identifica a pessoa, e o que
 * precisamos é só distinguir "mesma aba voltando" de "visita nova".
 * `crypto.getRandomValues` existe tanto no Node quanto no Edge runtime.
 */
export function generateVisitorKey(): string {
  const bytes = new Uint8Array(VISITOR_KEY_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// ─────────────────────────────────────────────────────────────────────────────
// Semântica do OPEN — VISITANTE ÚNICO, não page view
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uma linha de `InviteVisit` significa UM VISITANTE ÚNICO da landing daquele
 * profissional — nunca um contador de aberturas.
 *
 * `openedAt` é a PRIMEIRA abertura daquele `visitorKey` para aquele
 * profissional, e NUNCA é atualizado depois. Nem F5, nem o retorno vindo do
 * login, nem uma releitura dias depois movem o carimbo ou criam linha nova.
 *
 * POR QUE NÃO CONTAR ABERTURAS: o topo do funil é a base de toda taxa de
 * conversão da tela de backoffice. Se ele inflasse com recarregamentos — e o
 * fluxo de convite tem recarregamento embutido, porque a pessoa volta à
 * landing depois de autenticar —, a conversão apareceria artificialmente
 * baixa e a hipótese de aquisição seria julgada com um denominador falso.
 *
 * Consequência deliberada: NÃO existem `openCount` nem `lastOpenedAt`. Medir
 * page view é outra pergunta, com outro custo de privacidade, e não é a
 * pergunta desta rodada.
 */
export const OPEN_SEMANTICS = "unique_visitor" as const

/**
 * Rótulos do backoffice. "Opens" seria ambíguo — lê-se como número de
 * aberturas, que é justamente o que esta métrica NÃO é.
 */
export const UNIQUE_VISITS_LABEL = "Visitas únicas" as const
export const UNIQUE_VISITS_HINT = "Pessoas que abriram a landing" as const

// ─────────────────────────────────────────────────────────────────────────────
// Retenção
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retenção máxima de `InviteVisit`: 180 dias a partir de `openedAt`.
 *
 * Cobre com folga o piloto e a análise de conversão, e evita guardar
 * identificadores pseudônimos indefinidamente sem necessidade — mesmo sendo
 * anônimos, não há razão para mantê-los para sempre.
 *
 * SEM SCHEDULER NESTA RODADA (decisão deliberada: não criar infraestrutura
 * de cron só para isto). O purge é uma operação segura e idempotente, a ser
 * executada por rotina operacional futura:
 *
 *   DELETE FROM invite_visits WHERE "openedAt" < now() - interval '180 days';
 *
 * Nada anterior a esse prazo deve ser apagado enquanto a análise do piloto
 * estiver ativa.
 */
export const INVITE_VISIT_RETENTION_DAYS = 180

/** Data de corte do purge — tudo com `openedAt` anterior pode ser removido. */
export function inviteVisitPurgeCutoff(
  now: Date,
  retentionDays: number = INVITE_VISIT_RETENTION_DAYS
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Atribuição
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uma Request só marca `requestCreatedAt` na visita quando os DOIS lados
 * batem: é do usuário que converteu naquela visita E é para o profissional
 * daquela landing.
 *
 * Sem a segunda checagem, um tutor que chegou pela landing de A e depois
 * contratou B creditaria a conversão para A — o número viraria "quantos
 * tutores entraram e contrataram alguém", não "quantos a landing de A
 * converteu". A mesma regra vale para a conclusão do atendimento.
 */
export function shouldAttributeRequest(
  visit: { professionalId: string; convertedUserId: string | null },
  request: { professionalId: string; tutorUserId: string }
): boolean {
  if (visit.convertedUserId === null) return false
  if (visit.convertedUserId !== request.tutorUserId) return false
  return visit.professionalId === request.professionalId
}

// ─────────────────────────────────────────────────────────────────────────────
// Funil
// ─────────────────────────────────────────────────────────────────────────────

export type InviteFunnelStage =
  | "opened"
  | "signed_up"
  | "pet_created"
  | "request_created"
  | "service_completed"

export type InviteVisitTimestamps = {
  signedUpAt: Date | null
  petCreatedAt: Date | null
  requestCreatedAt: Date | null
  serviceCompletedAt: Date | null
}

/**
 * Estágio mais avançado que esta visita alcançou.
 *
 * Lê de trás para frente porque os marcos são cumulativos, mas NÃO exige que
 * os anteriores estejam preenchidos: um tutor que já tinha pet cadastrado
 * pula `petCreatedAt` e vai direto para a Request. Exigir a cadeia completa
 * classificaria essa pessoa — uma conversão de sucesso — como se tivesse
 * parado no cadastro.
 */
export function resolveFunnelStage(visit: InviteVisitTimestamps): InviteFunnelStage {
  if (visit.serviceCompletedAt) return "service_completed"
  if (visit.requestCreatedAt) return "request_created"
  if (visit.petCreatedAt) return "pet_created"
  if (visit.signedUpAt) return "signed_up"
  return "opened"
}

export type InviteFunnelCounts = {
  opened: number
  signedUp: number
  petCreated: number
  requestCreated: number
  serviceCompleted: number
}

/**
 * Contagem CUMULATIVA por estágio — cada nível conta todos que chegaram
 * naquele ponto OU além. É assim que um funil se lê: "20 abriram, 8
 * cadastraram, 3 pediram atendimento", e não 20/8/3 como fatias disjuntas.
 */
export function countFunnel(visits: InviteVisitTimestamps[]): InviteFunnelCounts {
  const counts: InviteFunnelCounts = {
    opened: visits.length,
    signedUp: 0,
    petCreated: 0,
    requestCreated: 0,
    serviceCompleted: 0,
  }

  for (const visit of visits) {
    if (visit.signedUpAt) counts.signedUp++
    if (visit.petCreatedAt) counts.petCreated++
    if (visit.requestCreatedAt) counts.requestCreated++
    if (visit.serviceCompletedAt) counts.serviceCompleted++
  }

  return counts
}

/**
 * Taxa de conversão de abertura até um estágio, em % com 1 casa.
 * Zero aberturas devolve 0 — nunca NaN/Infinity numa tela de backoffice.
 */
export function conversionRate(opened: number, reached: number): number {
  if (opened <= 0) return 0
  return Math.round((reached / opened) * 1000) / 10
}

// ─────────────────────────────────────────────────────────────────────────────
// Link e destino pós-login
// ─────────────────────────────────────────────────────────────────────────────

/** Caminho canônico da landing pública de um profissional. */
export function buildInviteLandingPath(professionalId: string): string {
  return `/p/${professionalId}`
}

/**
 * Mensagem sugerida ao compartilhar. Curta, em primeira pessoa e sem tom de
 * anúncio — quem recebe precisa reconhecer a pessoa que enviou, não a
 * plataforma.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NÃO CONTÉM O LINK — E ISSO É O PONTO
 *
 * Antes a mensagem terminava com a própria URL, e o chamador ainda passava
 * essa mesma URL no campo `url` de `navigator.share()`. O WhatsApp concatena
 * `text` e `url`, então o profissional compartilhava o link DUAS VEZES —
 * confirmado em teste físico.
 *
 * A Web Share API separa os dois campos de propósito: `text` é o corpo, `url`
 * é o link, e é o `url` que permite ao destino montar prévia. Quem escreve a
 * mensagem não deve embutir o endereço; quem compartilha passa os dois campos
 * separados. Mesma divisão que `ShareButton` (perfil público) já usava.
 *
 * Constante e não função porque o texto é fixo: é em primeira pessoa ("meu
 * perfil"), então não interpola nome, e não interpola mais a URL. A versão
 * anterior recebia `professionalName` sem nunca usá-lo.
 */
export const INVITE_SHARE_MESSAGE =
  "Oi! Este é meu perfil na Peteen. Por aqui você cadastra seu pet e pode solicitar um atendimento comigo."
