/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Pre-Real-Test Fix Pack — Lote F.1: higiene de texto de exibição
 * (displayName/city) de três ProfessionalProfile legítimos mas com
 * capitalização/typo de teste ("Vitor hugo oliveira", "Carlos delarosa",
 * "MARIA LUIZA oliveria"), encontrados na auditoria de elegibilidade do
 * Discovery (missão "Pre-Real-Test Fix Pack").
 *
 * Não exclui, não desativa e não altera Trust Score, verificação, serviços
 * ou qualquer outro campo desses perfis — só corrige nome/cidade para o
 * formato de exibição correto, preservando o histórico (reviews, requests,
 * relationships) intacto. "VAMOS LÁ GAROTAO" (0 serviços ativos) não é
 * tocado aqui: já fica fora do Discovery pela nova regra de elegibilidade
 * (services: { some: { isActive: true } }) e não é um nome de pessoa real
 * corrigível por capitalização — ver docs/DEMO_DATASET_MANIFEST.md.
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 *
 * Uso:
 *   node --experimental-strip-types scripts/demo-cleanup-lote-f1.ts --dry-run
 *   node --experimental-strip-types scripts/demo-cleanup-lote-f1.ts
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

const PROFESSIONAL_TEXT_FIXES: Array<{
  id: string;
  displayName: { before: string; after: string };
  city: { before: string; after: string };
}> = [
  {
    id: "cmqhgfd0200015kscjr9yxmpy",
    displayName: { before: "Vitor hugo oliveira", after: "Vitor Hugo Oliveira" },
    city: { before: "são paulo", after: "São Paulo" },
  },
  {
    id: "cmqwm8977000158scu6ift5eq",
    displayName: { before: "Carlos delarosa", after: "Carlos Delarosa" },
    city: { before: "carapicuiba", after: "Carapicuíba" },
  },
  {
    id: "cmqivs4p6000164scya3o7u66",
    displayName: { before: "MARIA LUIZA oliveria", after: "Maria Luiza Oliveira" },
    city: { before: "São Paulo", after: "São Paulo" }, // já correta — mantida por completude
  },
];

async function main() {
  console.info(`=== Demo Data Cleanup — Lote F.1 ${DRY_RUN ? "(DRY RUN)" : "(EXECUÇÃO REAL)"} ===\n`);

  await prisma.$transaction(async (tx) => {
    for (const fix of PROFESSIONAL_TEXT_FIXES) {
      const pro = await tx.professionalProfile.findUniqueOrThrow({ where: { id: fix.id } });

      await applyIfMatches(
        `ProfessionalProfile(${fix.id}).displayName`,
        pro,
        [{ field: "displayName", expectedBefore: fix.displayName.before, after: fix.displayName.after }],
        (data) => (DRY_RUN ? Promise.resolve() : tx.professionalProfile.update({ where: { id: fix.id }, data }))
      );

      if (fix.city.before !== fix.city.after) {
        await applyIfMatches(
          `ProfessionalProfile(${fix.id}).city`,
          pro,
          [{ field: "city", expectedBefore: fix.city.before, after: fix.city.after }],
          (data) => (DRY_RUN ? Promise.resolve() : tx.professionalProfile.update({ where: { id: fix.id }, data }))
        );
      } else {
        console.info(`[ProfessionalProfile(${fix.id}).city] já está no estado alvo — sem alterações necessárias.`);
      }
    }
  });

  console.info(`\n=== ${DRY_RUN ? "Dry run concluído — nenhuma escrita realizada." : "Execução concluída."} ===`);
}

main()
  .catch((err) => {
    console.error("Falha na execução do Lote F.1:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
