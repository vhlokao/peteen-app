/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Demo Data Cleanup — Lote E.1: remove dados pessoais reais (telefone,
 * domínio e handle de rede social de um membro da equipe) e branding
 * alheio ao Peteen dos registros de Partner. Não toca em TrustConnection,
 * verification, roles, ownership ou qualquer engine — só campos de
 * contato do Partner demo e nome/cidade/contato do Partner legado
 * aprovado.
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 *
 * Uso:
 *   node --experimental-strip-types scripts/demo-cleanup-lote-e1.ts --dry-run
 *   node --experimental-strip-types scripts/demo-cleanup-lote-e1.ts
 *
 * IMPORTANTE — por que este script NÃO usa comparação exata com o valor
 * "antes": os campos phone/website/instagram/businessName tratados aqui
 * continham dado pessoal real. Embutir esse valor literal no código-fonte
 * (mesmo só para uma checagem de igualdade) o gravaria permanentemente no
 * histórico do Git, o que anularia o propósito desta missão. Por isso, a
 * estratégia é: "campo já está no valor-alvo seguro? Se não, sanitizar
 * (substituir/anular), seja qual for o valor atual." Isso ainda é
 * idempotente (reexecução detecta o valor-alvo e não faz nada), só não
 * distingue "estado inesperado" de "estado sujo original" para esses
 * campos específicos — o que é aceitável aqui porque qualquer valor
 * diferente do alvo deve mesmo ser substituído. Para os campos city
 * ("teste" -> valor neutro) — que não contêm dado pessoal — mantém-se a
 * checagem exata de antes/depois, igual aos scripts dos lotes anteriores.
 *
 * Segurança: nenhum valor sensível é impresso por completo no console —
 * apenas mascarado. O snapshot pré-mutação (fora do Git) é o único lugar
 * onde os valores originais completos ficam registrados.
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

const PARTNER_DEMO_ID = "cmqmmphxj0000kcscahv2xx5h"; // Love Pet Shop
const PARTNER_LEGACY_ORPHAN_ID = "cmqlyxkpf0000wosc2iqgecy9"; // Pet Shop central carapicuiba (ativo, sem login)
const PARTNER_LEGACY_ABANDONED_ID = "cmqmo00cm0002pkscua4mqzgs"; // Partner com onboarding abandonado

function maskPhone(value: unknown): string {
  if (typeof value !== "string" || value.length < 4) return "(vazio)";
  return `${"*".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}

function maskUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "(vazio)";
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : "(mascarado)";
}

const MASKED_FIELDS = new Set(["phone", "website", "instagram"]);

function maskForLog(field: string, value: unknown): string {
  if (value === null || value === undefined) return "(vazio)";
  if (!MASKED_FIELDS.has(field)) return String(value);
  if (field === "phone") return maskPhone(value);
  return maskUrl(value);
}

/**
 * Sanitiza um campo sensível: se já estiver no valor-alvo, não faz nada.
 * Caso contrário, substitui pelo valor-alvo, sem exigir (nem imprimir) o
 * valor original completo.
 */
async function sanitizeSensitiveField<T extends Record<string, unknown>>(
  label: string,
  current: T,
  field: keyof T,
  after: unknown,
  update: (data: Record<string, unknown>) => Promise<unknown>
): Promise<void> {
  if (current[field] === after) {
    console.info(`[${label}] já está no estado alvo — sem alterações necessárias.`);
    return;
  }

  console.info(`[${label}] alteração planejada: "${maskForLog(String(field), current[field])}" -> "${maskForLog(String(field), after)}"`);

  if (DRY_RUN) {
    console.info(`[${label}] DRY RUN — nenhuma escrita realizada.`);
    return;
  }

  await update({ [field]: after });
  console.info(`[${label}] aplicado.`);
}

type FieldCheck<T> = {
  field: keyof T;
  expectedBefore: unknown;
  after: unknown;
};

/** Checagem exata de antes/depois — só para campos que não contêm dado pessoal (ex: city "teste"). */
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
      console.info(`  - ${String(c.field)}: encontrado "${current[c.field]}"`);
    }
    return;
  }

  console.info(`[${label}] alteração planejada:`);
  for (const c of checks) {
    console.info(`  - ${String(c.field)}: "${c.expectedBefore}" -> "${c.after}"`);
  }

  if (DRY_RUN) {
    console.info(`[${label}] DRY RUN — nenhuma escrita realizada.`);
    return;
  }

  const data: Record<string, unknown> = {};
  for (const c of checks) data[c.field as string] = c.after;
  await update(data);
  console.info(`[${label}] aplicado.`);
}

async function main() {
  console.info(`=== Demo Data Cleanup — Lote E.1 ${DRY_RUN ? "(DRY RUN)" : "(EXECUÇÃO REAL)"} ===\n`);

  await prisma.$transaction(async (tx) => {
    // ── Partner demo: contatos fictícios/nulos ──────────────────────────────
    const demo = await tx.partner.findUniqueOrThrow({ where: { id: PARTNER_DEMO_ID } });

    await sanitizeSensitiveField("Partner(demo).phone", demo, "phone", "(11) 90000-0003", (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_DEMO_ID }, data })
    );
    await sanitizeSensitiveField("Partner(demo).website", demo, "website", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_DEMO_ID }, data })
    );
    await sanitizeSensitiveField("Partner(demo).instagram", demo, "instagram", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_DEMO_ID }, data })
    );

    // ── Partner legado ativo/órfão: remove contatos pessoais, mantém nome e ativo ──
    const orphan = await tx.partner.findUniqueOrThrow({ where: { id: PARTNER_LEGACY_ORPHAN_ID } });

    await sanitizeSensitiveField("Partner(legado-orfao).phone", orphan, "phone", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ORPHAN_ID }, data })
    );
    await sanitizeSensitiveField("Partner(legado-orfao).website", orphan, "website", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ORPHAN_ID }, data })
    );
    await sanitizeSensitiveField("Partner(legado-orfao).instagram", orphan, "instagram", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ORPHAN_ID }, data })
    );

    // ── Partner legado abandonado: neutraliza identidade + contatos + cidade "teste" ──
    const abandoned = await tx.partner.findUniqueOrThrow({ where: { id: PARTNER_LEGACY_ABANDONED_ID } });

    await sanitizeSensitiveField("Partner(legado-abandonado).businessName", abandoned, "businessName", "Parceiro legado de QA", (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ABANDONED_ID }, data })
    );
    await applyIfMatches(
      "Partner(legado-abandonado).city",
      abandoned,
      [{ field: "city", expectedBefore: "teste", after: "Não informado" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ABANDONED_ID }, data }))
    );
    await sanitizeSensitiveField("Partner(legado-abandonado).phone", abandoned, "phone", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ABANDONED_ID }, data })
    );
    await sanitizeSensitiveField("Partner(legado-abandonado).website", abandoned, "website", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ABANDONED_ID }, data })
    );
    await sanitizeSensitiveField("Partner(legado-abandonado).instagram", abandoned, "instagram", null, (data) =>
      DRY_RUN ? Promise.resolve() : tx.partner.update({ where: { id: PARTNER_LEGACY_ABANDONED_ID }, data })
    );
  });

  console.info(`\n=== ${DRY_RUN ? "Dry run concluído — nenhuma escrita realizada." : "Execução concluída."} ===`);
}

main()
  .catch((err) => {
    console.error("Falha na execução do Lote E.1:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
