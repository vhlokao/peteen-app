/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Demo Data Cleanup — Lote B: higieniza os campos visíveis do TutorProfile
 * demo, do ProfessionalProfile demo e dos pets do tutor demo. Não altera
 * roles, serviços, preços, solicitações, reviews, disputas, parceiros,
 * Trust Engine ou qualquer entidade fora dessas três.
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 *
 * Uso:
 *   node --experimental-strip-types scripts/demo-cleanup-lote-b.ts --dry-run
 *   node --experimental-strip-types scripts/demo-cleanup-lote-b.ts
 *
 * Idempotente: cada campo só é escrito se o valor atual for exatamente o
 * valor "antes" esperado (checado explicitamente antes de qualquer UPDATE).
 * Se os dados já estiverem no estado alvo (ou em qualquer estado
 * inesperado), a execução aborta essa entidade sem tocar nela e informa
 * "sem alterações necessárias" ou "estado inesperado, pulando".
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

const TUTOR_DEMO_ID = "cmqism4el0004t4scd0tnxnmm";
const PROFESSIONAL_DEMO_ID = "cmqishhuf0001t4sckixc5mdg";

const PET_CELESTE_DUP_ID = "cmqnuq2tw0000wcscdytlro8e"; // "CELESTE" maiúsculo, arquivado, sem histórico
const PET_SABATH_ID = "cmqnuznad0003wcsc8kf8qf5s";
const PET_CHARLOTTE_JUNIOR_ID = "cmqisnb370005t4scuz9gjbdf";
const PET_CELESTE_ID = "cmqnv1d4k0005wcscgolmtqof";

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
  const mismatches = checks.filter((c) => current[c.field] !== c.expectedBefore);

  if (mismatches.length === checks.length && checks.every((c) => current[c.field] === c.after)) {
    console.info(`[${label}] já está no estado alvo — sem alterações necessárias.`);
    return;
  }

  if (mismatches.length > 0) {
    console.info(`[${label}] estado inesperado nos campos: ${mismatches.map((m) => String(m.field)).join(", ")} — pulando por segurança (dado pode já ter sido editado por outra via).`);
    for (const m of mismatches) {
      console.info(`  - ${String(m.field)}: esperado "${m.expectedBefore}", encontrado "${current[m.field]}"`);
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

async function main() {
  console.info(`=== Demo Data Cleanup — Lote B ${DRY_RUN ? "(DRY RUN)" : "(EXECUÇÃO REAL)"} ===\n`);

  await prisma.$transaction(async (tx) => {
    // ── TutorProfile demo ──────────────────────────────────────────────────
    const tutor = await tx.tutorProfile.findUniqueOrThrow({ where: { id: TUTOR_DEMO_ID } });

    await applyIfMatches(
      "TutorProfile.displayName",
      tutor,
      [{ field: "displayName", expectedBefore: "Moura vitor ho", after: "Camila Ferreira" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.tutorProfile.update({ where: { id: TUTOR_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "TutorProfile.city",
      tutor,
      [{ field: "city", expectedBefore: "carapicuiba dd", after: "Carapicuíba" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.tutorProfile.update({ where: { id: TUTOR_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "TutorProfile.neighborhood",
      tutor,
      [{ field: "neighborhood", expectedBefore: "centro", after: "Centro" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.tutorProfile.update({ where: { id: TUTOR_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "TutorProfile.phone",
      tutor,
      [{ field: "phone", expectedBefore: "1198067814444", after: "(11) 90000-0001" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.tutorProfile.update({ where: { id: TUTOR_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "TutorProfile.bio",
      tutor,
      [
        {
          field: "bio",
          expectedBefore: "sou dono da charlote a gata mais linda do mundo",
          after: "Tutora de dois pets levados para passear e cuidar bastante. Gosto de manter contato com quem cuida deles.",
        },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.tutorProfile.update({ where: { id: TUTOR_DEMO_ID }, data }))
    );

    // ── ProfessionalProfile demo ────────────────────────────────────────────
    const pro = await tx.professionalProfile.findUniqueOrThrow({ where: { id: PROFESSIONAL_DEMO_ID } });

    await applyIfMatches(
      "ProfessionalProfile.bio",
      pro,
      [
        {
          field: "bio",
          expectedBefore: "Sou cuidadora de animais",
          after:
            "Cuido de cães e gatos com atenção à rotina e ao comportamento de cada pet. Tenho experiência com passeios e cuidados em casa. Gosto de manter contato com os tutores durante todo o atendimento.",
        },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.professionalProfile.update({ where: { id: PROFESSIONAL_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "ProfessionalProfile.city",
      pro,
      [{ field: "city", expectedBefore: "carapicuiba", after: "Carapicuíba" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.professionalProfile.update({ where: { id: PROFESSIONAL_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "ProfessionalProfile.neighborhood",
      pro,
      [{ field: "neighborhood", expectedBefore: "centro", after: "Centro" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.professionalProfile.update({ where: { id: PROFESSIONAL_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "ProfessionalProfile.phone",
      pro,
      [{ field: "phone", expectedBefore: "11980667766", after: "(11) 90000-0002" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.professionalProfile.update({ where: { id: PROFESSIONAL_DEMO_ID }, data }))
    );

    await applyIfMatches(
      "ProfessionalProfile.specializations",
      { specializations: JSON.stringify(pro.specializations) } as Record<string, unknown>,
      [
        {
          field: "specializations",
          expectedBefore: JSON.stringify(["passeio", "cuidadora", "amorosoa", "temcasa"]),
          after: JSON.stringify(["Passeios", "Cuidados em casa", "Hospedagem"]),
        },
      ],
      async () => {
        if (!DRY_RUN) {
          await tx.professionalProfile.update({
            where: { id: PROFESSIONAL_DEMO_ID },
            data: { specializations: ["Passeios", "Cuidados em casa", "Hospedagem"] },
          });
        }
      }
    );

    // ── Pets do tutor demo ───────────────────────────────────────────────────

    const sabath = await tx.pet.findUniqueOrThrow({ where: { id: PET_SABATH_ID } });
    await applyIfMatches(
      "Pet(Sabath).breed",
      sabath,
      [{ field: "breed", expectedBefore: "GATO", after: null }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_SABATH_ID }, data }))
    );
    await applyIfMatches(
      "Pet(Sabath).description+notes",
      sabath,
      [
        { field: "description", expectedBefore: "bRINCALHONA", after: "Brincalhona e adora atenção." },
        { field: "notes", expectedBefore: "bRINCALHONA", after: "Brincalhona e adora atenção." },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_SABATH_ID }, data }))
    );
    await applyIfMatches(
      "Pet(Sabath).birthDate",
      { birthDate: sabath.birthDate?.toISOString() } as Record<string, unknown>,
      [{ field: "birthDate", expectedBefore: "2026-06-14T00:00:00.000Z", after: "2022-03-15T00:00:00.000Z" }],
      () => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_SABATH_ID }, data: { birthDate: new Date("2022-03-15T00:00:00.000Z") } }))
    );

    const celeste = await tx.pet.findUniqueOrThrow({ where: { id: PET_CELESTE_ID } });
    await applyIfMatches(
      "Pet(Celeste).breed",
      celeste,
      [{ field: "breed", expectedBefore: "Gato", after: "SRD" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CELESTE_ID }, data }))
    );
    await applyIfMatches(
      "Pet(Celeste).description+notes",
      celeste,
      [
        { field: "description", expectedBefore: "quietinha", after: "Quietinho, gosta de dormir bastante." },
        { field: "notes", expectedBefore: "quietinha", after: "Quietinho, gosta de dormir bastante." },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CELESTE_ID }, data }))
    );
    await applyIfMatches(
      "Pet(Celeste).birthDate",
      { birthDate: celeste.birthDate?.toISOString() } as Record<string, unknown>,
      [{ field: "birthDate", expectedBefore: "2026-06-21T00:00:00.000Z", after: "2024-06-21T00:00:00.000Z" }],
      () => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CELESTE_ID }, data: { birthDate: new Date("2024-06-21T00:00:00.000Z") } }))
    );

    const charlotteJr = await tx.pet.findUniqueOrThrow({ where: { id: PET_CHARLOTTE_JUNIOR_ID } });
    await applyIfMatches(
      "Pet(CharlotteJunior).weight",
      charlotteJr,
      [{ field: "weight", expectedBefore: 200, after: 4.5 }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CHARLOTTE_JUNIOR_ID }, data }))
    );
    await applyIfMatches(
      "Pet(CharlotteJunior).breed",
      charlotteJr,
      [{ field: "breed", expectedBefore: "frajola", after: "Frajola" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CHARLOTTE_JUNIOR_ID }, data }))
    );
    await applyIfMatches(
      "Pet(CharlotteJunior).description+notes",
      charlotteJr,
      [
        { field: "description", expectedBefore: "a charlote gosta de laiser", after: "Gosta de brincar com laser e é bem curiosa." },
        { field: "notes", expectedBefore: "a charlote gosta de laiser", after: "Gosta de brincar com laser e é bem curiosa." },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CHARLOTTE_JUNIOR_ID }, data }))
    );

    const celesteDup = await tx.pet.findUniqueOrThrow({ where: { id: PET_CELESTE_DUP_ID } });
    await applyIfMatches(
      "Pet(CELESTE-duplicado).name",
      celesteDup,
      [{ field: "name", expectedBefore: "CELESTE", after: "Luna" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CELESTE_DUP_ID }, data }))
    );
    await applyIfMatches(
      "Pet(CELESTE-duplicado).breed",
      celesteDup,
      [{ field: "breed", expectedBefore: "FELINA", after: "SRD" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CELESTE_DUP_ID }, data }))
    );
    await applyIfMatches(
      "Pet(CELESTE-duplicado).description+notes",
      celesteDup,
      [
        { field: "description", expectedBefore: "DADASDDAS", after: "Gata tranquila, prefere ambientes calmos." },
        { field: "notes", expectedBefore: "DADASDDAS", after: "Gata tranquila, prefere ambientes calmos." },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.pet.update({ where: { id: PET_CELESTE_DUP_ID }, data }))
    );
  });

  console.info(`\n=== ${DRY_RUN ? "Dry run concluído — nenhuma escrita realizada." : "Execução concluída."} ===`);
}

main()
  .catch((err) => {
    console.error("Falha na execução do Lote B:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
