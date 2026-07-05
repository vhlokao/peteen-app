/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Demo Data Cleanup — Lote E: higieniza o Partner demo ("Love Pet Shops
 * cents" → "Love Pet Shop"), o PartnerProfile vinculado, o texto de cidade
 * de um Partner legado ainda ativo (Pet Shop central) e o campo
 * denormalizado `sourceName` das TrustConnection existentes (só texto de
 * exibição — não toca em weight, isActive, connectionType ou targetId,
 * portanto não altera Trust Engine, Ranking, Recommendation Engine nem
 * peso reputacional). Não exclui nenhuma TrustConnection. Não toca no
 * Partner com onboarding abandonado (já inativo, invisível ao público pela
 * própria regra de isActive) — classificado só em documentação (ver
 * docs/DEMO_DATASET_MANIFEST.md; nome/contatos pessoais desse registro
 * foram tratados separadamente no Lote E.1).
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 *
 * Uso:
 *   node --experimental-strip-types scripts/demo-cleanup-lote-e.ts --dry-run
 *   node --experimental-strip-types scripts/demo-cleanup-lote-e.ts
 *
 * Idempotente: cada campo só é escrito se o valor atual for exatamente o
 * valor "antes" esperado. Se já estiver no estado alvo, ou em qualquer
 * estado inesperado, a execução pula essa entidade sem alterá-la.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Bloqueado: este script não deve rodar em ambiente de produção.");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PARTNER_DEMO_ID = "cmqmmphxj0000kcscahv2xx5h"; // Love Pet Shops cents
const PARTNER_PROFILE_DEMO_ID = "pp_test_love_pet";
const PARTNER_LEGACY_PETSHOP_ID = "cmqlyxkpf0000wosc2iqgecy9"; // Pet Shop central carapicuiba (QA/legado, ainda ativo)

type FieldCheck<T> = {
  field: keyof T;
  expectedBefore: unknown;
  after: unknown;
};

async function applyIfMatches<T extends Record<string, unknown>>(
  label: string,
  current: T,
  checks: FieldCheck<T>[],
  update: (data: Record<string, unknown>) => Promise<unknown>
): Promise<void> {
  const allAlreadyAfter = checks.every((c) => current[c.field] === c.after);
  const allStillBefore = checks.every((c) => current[c.field] === c.expectedBefore);

  if (allAlreadyAfter) {
    console.info(`[${label}] já está no estado alvo — sem alterações necessárias.`);
    return;
  }

  if (!allStillBefore) {
    console.info(`[${label}] estado inesperado — pulando por segurança.`);
    for (const c of checks) {
      console.info(`  - ${String(c.field)}: esperado "${c.expectedBefore}" ou "${c.after}", encontrado "${current[c.field]}"`);
    }
    return;
  }

  const data: Record<string, unknown> = {};
  for (const c of checks) data[c.field as string] = c.after;

  console.info(`[${label}] alteração planejada:`);
  for (const c of checks) {
    console.info(`  - ${String(c.field)}: "${c.expectedBefore}" -> "${c.after}"`);
  }

  if (DRY_RUN) {
    console.info(`[${label}] DRY RUN — nenhuma escrita realizada.`);
    return;
  }

  await update(data);
  console.info(`[${label}] aplicado.`);
}

const TRUST_CONNECTION_SOURCE_NAME_FIXES: Array<{ id: string; before: string; after: string }> = [
  { id: "cmqlxhqnn000084sc5x4xhmlt", before: "Pet shop Moura", after: "Pet Shop Moura" },
  { id: "cmqlxk0s7000284sc2761tceg", before: "VETERINARIO VERTIGEM", after: "Veterinário Vertigem" },
  { id: "cmqmmrcil0003kcscv5cs7gc2", before: "Love Pet", after: "Love Pet Shop" },
  { id: "cmqmmrcwg0005kcscu9xk4x18", before: "Love Pet", after: "Love Pet Shop" },
  { id: "cmqswb3t30000m4sc8pehi7oj", before: "Love Pet Shops cents", after: "Love Pet Shop" },
  { id: "cmqwqo0hf00009gsceigpm0wu", before: "Love Pet Shops cents", after: "Love Pet Shop" },
  { id: "cmr5z2bs20001xosc5zb4tsdc", before: "Love Pet Shops cents", after: "Love Pet Shop" },
];

async function main() {
  console.info(`=== Demo Data Cleanup — Lote E ${DRY_RUN ? "(DRY RUN)" : "(EXECUÇÃO REAL)"} ===\n`);

  await prisma.$transaction(async (tx) => {
    // ── Partner demo: Love Pet Shops cents -> Love Pet Shop ──────────────────
    const partner = await tx.partner.findUniqueOrThrow({ where: { id: PARTNER_DEMO_ID } });

    await applyIfMatches(
      "Partner(demo).businessName",
      partner,
      [{ field: "businessName", expectedBefore: "Love Pet Shops cents", after: "Love Pet Shop" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_DEMO_ID }, data }))
    );
    await applyIfMatches(
      "Partner(demo).description",
      partner,
      [
        {
          field: "description",
          expectedBefore: "testando parceiro onboarding Love Pet Shops cents",
          after: "Loja de produtos e serviços para pets em Carapicuíba, parceira da rede Peteen para indicar profissionais de confiança.",
        },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_DEMO_ID }, data }))
    );
    await applyIfMatches(
      "Partner(demo).city",
      partner,
      [{ field: "city", expectedBefore: "Carapicuiba", after: "Carapicuíba" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_DEMO_ID }, data }))
    );

    // ── PartnerProfile demo ────────────────────────────────────────────────
    const partnerProfile = await tx.partnerProfile.findUniqueOrThrow({ where: { id: PARTNER_PROFILE_DEMO_ID } });
    await applyIfMatches(
      "PartnerProfile(demo).city",
      partnerProfile,
      [{ field: "city", expectedBefore: "Carapicuiba", after: "Carapicuíba" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.partnerProfile.update({ where: { id: PARTNER_PROFILE_DEMO_ID }, data }))
    );

    // ── Partner legado ainda ativo: só corrige a cidade visível ──────────────
    const legacyPartner = await tx.partner.findUniqueOrThrow({ where: { id: PARTNER_LEGACY_PETSHOP_ID } });
    await applyIfMatches(
      "Partner(legado-PetShopCentral).city",
      legacyPartner,
      [{ field: "city", expectedBefore: "carapicuiba", after: "Carapicuíba" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_PETSHOP_ID }, data }))
    );

    // ── TrustConnection.sourceName — só texto de exibição, sem tocar weight/isActive/connectionType/targetId ──
    for (const fix of TRUST_CONNECTION_SOURCE_NAME_FIXES) {
      const tc = await tx.trustConnection.findUniqueOrThrow({ where: { id: fix.id } });
      await applyIfMatches(
        `TrustConnection(${fix.id}).sourceName`,
        tc,
        [{ field: "sourceName", expectedBefore: fix.before, after: fix.after }],
        (data) => (DRY_RUN ? Promise.resolve() : tx.trustConnection.update({ where: { id: fix.id }, data }))
      );
    }
  });

  console.info(`\n=== ${DRY_RUN ? "Dry run concluído — nenhuma escrita realizada." : "Execução concluída."} ===`);
}

main()
  .catch((err) => {
    console.error("Falha na execução do Lote E:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
