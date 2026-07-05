/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Demo Data Cleanup — Lote D: corrige apenas textos visíveis de
 * ServiceRequest.notes e Review.comment (tutor demo Camila Ferreira).
 * Não altera status, datas, ownership, petId, serviceType, nota de review,
 * autor/destinatário, Dispute ou AuditLog — todos preservados como estão.
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 *
 * Uso:
 *   node --experimental-strip-types scripts/demo-cleanup-lote-d.ts --dry-run
 *   node --experimental-strip-types scripts/demo-cleanup-lote-d.ts
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

// ── Correções de ServiceRequest.notes (texto de teste/informal) ──────────────
const REQUEST_NOTE_FIXES: Array<{ id: string; before: string; after: string }> = [
  {
    id: "cmqisoyyh0006t4scv5r5azwa",
    before: "vamos trabaia mué",
    after: "Ele estava tranquilo, sem necessidade de cuidados especiais.",
  },
  {
    id: "cmqivx7fd000364scmt4vo4oz",
    before: "ssss",
    after: "Sem observações especiais.",
  },
  {
    id: "cmqixy09z000014scabtjm6x7",
    before: "teste de recorrencia",
    after: "Preferência por atendimento no período da tarde.",
  },
  {
    id: "cmqkv09ud0003dgsc68izfkun",
    before: "adsdadasd",
    after: "Ele fica um pouco ansioso com barulho, por favor ter calma.",
  },
  {
    id: "cmqwqeaes0004woscd3uo2ryw",
    before: "VAMOS LÁ",
    after: "Vamos lá!",
  },
  {
    id: "cmqwqgqat0007wosc62vkjymm",
    before: "GGFG",
    after: "Prefiro que seja no fim da tarde.",
  },
];

// ── Correções de Review.comment (capitalização/ortografia, nota preservada) ──
const REVIEW_COMMENT_FIXES: Array<{ id: string; before: string; after: string }> = [
  {
    id: "cmqitg0o600006osc8iddbdzn",
    before: "O BICHO MANJA",
    after: "Ela cuidou muito bem do meu pet e manteve tudo organizado.",
  },
  {
    id: "cmqiw067k000464scq9wb71tl",
    before: "legal mas falta experiencia",
    after: "Legal, mas falta experiência.",
  },
  {
    id: "cmqmk8gp90003l8scdhrs1rox",
    before: "ADOREI O ATENDIMENTO OBRIGADO MAIS UMA VEZ",
    after: "Adorei o atendimento, obrigada mais uma vez!",
  },
  {
    id: "cmqnwpp5700013cscj112l7q4",
    before: "gostei mas precis mlehorar",
    after: "Gostei, mas precisa melhorar um pouco.",
  },
  {
    id: "cmqwqftyf0005wosc7ydkcfgi",
    before: "FOI QUASE LÁ",
    after: "Foi quase lá.",
  },
];

async function main() {
  console.info(`=== Demo Data Cleanup — Lote D ${DRY_RUN ? "(DRY RUN)" : "(EXECUÇÃO REAL)"} ===\n`);

  await prisma.$transaction(async (tx) => {
    for (const fix of REQUEST_NOTE_FIXES) {
      const req = await tx.serviceRequest.findUniqueOrThrow({ where: { id: fix.id } });
      await applyIfMatches(
        `ServiceRequest(${fix.id}).notes`,
        req,
        [{ field: "notes", expectedBefore: fix.before, after: fix.after }],
        (data) => (DRY_RUN ? Promise.resolve() : tx.serviceRequest.update({ where: { id: fix.id }, data }))
      );
    }

    for (const fix of REVIEW_COMMENT_FIXES) {
      const rv = await tx.review.findUniqueOrThrow({ where: { id: fix.id } });
      await applyIfMatches(
        `Review(${fix.id}).comment`,
        rv,
        [{ field: "comment", expectedBefore: fix.before, after: fix.after }],
        (data) => (DRY_RUN ? Promise.resolve() : tx.review.update({ where: { id: fix.id }, data }))
      );
    }
  });

  console.info(`\n=== ${DRY_RUN ? "Dry run concluído — nenhuma escrita realizada." : "Execução concluída."} ===`);
}

main()
  .catch((err) => {
    console.error("Falha na execução do Lote D:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
