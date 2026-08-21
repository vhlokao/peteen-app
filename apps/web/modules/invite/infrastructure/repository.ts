/**
 * Módulo: invite
 * Camada: infrastructure — persistência do funil de convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TUDO AQUI É BEST-EFFORT
 *
 * Nenhuma função deste arquivo pode derrubar um fluxo de usuário. Um tutor
 * cadastrando o pet, criando uma solicitação ou abrindo a landing não pode
 * ver erro porque a MEDIÇÃO falhou — a medição existe para nós, não para
 * ele. Toda função captura a própria exceção e segue.
 *
 * Isso também é o que permite o código ser publicado ANTES da migration ser
 * aplicada: sem a tabela, cada chamada falha silenciosamente e o produto
 * continua inteiro; quando a tabela existir, a medição começa a valer sem
 * nenhum outro deploy.
 */

import { prisma } from "@/lib/prisma/client"

/**
 * Registra o VISITANTE ÚNICO de uma landing de convite.
 *
 * Uma linha = um visitante daquele profissional, nunca um contador de
 * aberturas. `openedAt` guarda a PRIMEIRA abertura e nunca é atualizado —
 * ver OPEN_SEMANTICS em domain/invite-visit.ts para o porquê (um topo de
 * funil inflado por refresh falsificaria toda taxa de conversão da tela).
 *
 * `createMany + skipDuplicates` em vez de `findUnique` + `create`: resolve o
 * caso "já existe" numa única ida ao banco e é imune à corrida entre duas
 * abas abertas ao mesmo tempo — o índice único
 * `(visitorKey, professionalId)` decide, e a segunda simplesmente não
 * insere. Nenhum UPDATE é emitido em nenhum caminho, então não há como o
 * carimbo se mover por engano.
 */
export async function recordInviteOpen(
  visitorKey: string,
  professionalId: string
): Promise<void> {
  try {
    await prisma.inviteVisit.createMany({
      data: [{ visitorKey, professionalId }],
      skipDuplicates: true,
    })
  } catch (err) {
    console.error("[recordInviteOpen]", err)
  }
}

/**
 * Liga as visitas anônimas de uma chave ao usuário que agora as detém.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ASSOCIAÇÃO ≠ CADASTRO — SÃO DOIS FATOS DIFERENTES
 *
 * `convertedUserId` responde "de quem é esta visita?" e passa a existir assim
 * que dá para observar — inclusive quando quem abriu o convite JÁ era usuário.
 * `signedUpAt` responde "esta visita gerou um tutor NOVO?" e só é escrito no
 * cadastro de verdade (ver `markSignedUp`).
 *
 * Misturar os dois quebraria os dois lados: um tutor existente que abre um
 * convite e contrata nunca teria a Request atribuída (a atribuição exige
 * `convertedUserId`), e ao mesmo tempo carimbar `signedUpAt` para ele
 * inflaria a métrica de aquisição com alguém que já estava no produto.
 *
 * Atualiza TODAS as visitas ainda não associadas daquela chave — um mesmo
 * visitante pode ter aberto a landing de mais de um profissional antes de
 * decidir. Cada landing mantém o próprio número.
 */
export async function associateVisitorWithUser(
  visitorKey: string,
  userId: string
): Promise<void> {
  try {
    await prisma.inviteVisit.updateMany({
      where: { visitorKey, convertedUserId: null },
      data: { convertedUserId: userId },
    })
  } catch (err) {
    console.error("[associateVisitorWithUser]", err)
  }
}

/**
 * Marca `signedUpAt` nas visitas já associadas a este usuário — só onde
 * ainda está vazio, para que nada reescreva a data do cadastro original.
 *
 * Chamado exclusivamente da criação do TutorProfile: é o único momento em
 * que um tutor NOVO passa a existir.
 */
export async function markSignedUp(userId: string): Promise<void> {
  try {
    await prisma.inviteVisit.updateMany({
      where: { convertedUserId: userId, signedUpAt: null },
      data: { signedUpAt: new Date() },
    })
  } catch (err) {
    console.error("[markSignedUp]", err)
  }
}

/**
 * Marca a criação do primeiro pet nas visitas já convertidas neste usuário.
 * Só preenche onde ainda está vazio — o marco é do PRIMEIRO pet, e cadastrar
 * um segundo depois não deve reescrever a data.
 */
export async function markPetCreated(userId: string): Promise<void> {
  try {
    await prisma.inviteVisit.updateMany({
      where: { convertedUserId: userId, petCreatedAt: null },
      data: { petCreatedAt: new Date() },
    })
  } catch (err) {
    console.error("[markPetCreated]", err)
  }
}

/**
 * Marca a criação de uma Request — SÓ na visita cujo profissional é o mesmo
 * da Request. É a trava de atribuição: um tutor que chegou pela landing de A
 * e contratou B não credita nada para A.
 */
export async function markRequestCreated(
  userId: string,
  professionalId: string
): Promise<void> {
  try {
    await prisma.inviteVisit.updateMany({
      where: { convertedUserId: userId, professionalId, requestCreatedAt: null },
      data: { requestCreatedAt: new Date() },
    })
  } catch (err) {
    console.error("[markRequestCreated]", err)
  }
}

/** Mesma trava de atribuição da Request, para a conclusão do atendimento. */
export async function markServiceCompleted(
  userId: string,
  professionalId: string
): Promise<void> {
  try {
    await prisma.inviteVisit.updateMany({
      where: { convertedUserId: userId, professionalId, serviceCompletedAt: null },
      data: { serviceCompletedAt: new Date() },
    })
  } catch (err) {
    console.error("[markServiceCompleted]", err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura — backoffice
// ─────────────────────────────────────────────────────────────────────────────

export type InviteFunnelRow = {
  professionalId: string
  displayName: string
  signedUpAt: Date | null
  petCreatedAt: Date | null
  requestCreatedAt: Date | null
  serviceCompletedAt: Date | null
}

/**
 * Visitas com o nome do profissional, para a visão operacional do backoffice.
 *
 * NÃO seleciona `visitorKey` nem `convertedUserId`: o backoffice precisa saber
 * SE converteu, não QUEM é a pessoa — expor a chave do visitante ou o id do
 * usuário transformaria uma métrica de canal num rastro individual, sem
 * nenhum ganho para a pergunta "este canal converte?".
 */
export async function findInviteFunnelRows(): Promise<InviteFunnelRow[]> {
  try {
    const rows = await prisma.inviteVisit.findMany({
      select: {
        professionalId: true,
        signedUpAt: true,
        petCreatedAt: true,
        requestCreatedAt: true,
        serviceCompletedAt: true,
        professional: { select: { displayName: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 2000,
    })

    return rows.map((row) => ({
      professionalId: row.professionalId,
      displayName: row.professional.displayName,
      signedUpAt: row.signedUpAt,
      petCreatedAt: row.petCreatedAt,
      requestCreatedAt: row.requestCreatedAt,
      serviceCompletedAt: row.serviceCompletedAt,
    }))
  } catch (err) {
    console.error("[findInviteFunnelRows]", err)
    return []
  }
}
