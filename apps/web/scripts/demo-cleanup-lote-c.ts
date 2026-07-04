/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Demo Data Cleanup — Lote C: higieniza os Service records do
 * ProfessionalProfile demo (Maria Eduarda) e a disponibilidade semanal já
 * persistida. Não toca em ServiceRequest (não há FK entre Service e
 * ServiceRequest no schema — a ligação é só por serviceType, então nenhuma
 * edição aqui afeta histórico), Review, Trust Score/Events/Connections,
 * TutorProfessionalRelationship, roles ou qualquer outra entidade.
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 *
 * Uso:
 *   node --experimental-strip-types scripts/demo-cleanup-lote-c.ts --dry-run
 *   node --experimental-strip-types scripts/demo-cleanup-lote-c.ts
 *
 * Idempotente: cada campo só é escrito se o valor atual for exatamente o
 * valor "antes" esperado. Se os dados já estiverem no estado alvo, ou em
 * qualquer estado inesperado, a execução pula essa entidade sem alterá-la.
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

const PROFESSIONAL_DEMO_ID = "cmqishhuf0001t4sckixc5mdg";
const SERVICE_PASSEIO_ID = "cmqisifem0002t4scxb897j3e";
const SERVICE_CUIDADOS_CASA_ID = "cmqrgfvix0000okscpnx2l6f1";

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
  // Classifica cada campo independentemente: já está no valor alvo? ainda no
  // valor original? nenhum dos dois (estado inesperado)? Campos onde
  // expectedBefore === after (nenhuma mudança real necessária naquele campo
  // específico, dentro de um grupo com outros campos que mudam) satisfazem
  // ambas as condições e não quebram nenhum dos dois ramos abaixo.
  const allAlreadyAfter = checks.every((c) => current[c.field] === c.after);
  const allStillBefore = checks.every((c) => current[c.field] === c.expectedBefore);

  if (allAlreadyAfter) {
    console.info(`[${label}] já está no estado alvo — sem alterações necessárias.`);
    return;
  }

  if (!allStillBefore) {
    const unexpected = checks.filter((c) => current[c.field] !== c.expectedBefore && current[c.field] !== c.after);
    console.info(`[${label}] estado inesperado — pulando por segurança.`);
    for (const c of unexpected.length > 0 ? unexpected : checks) {
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

async function main() {
  console.info(`=== Demo Data Cleanup — Lote C ${DRY_RUN ? "(DRY RUN)" : "(EXECUÇÃO REAL)"} ===\n`);

  await prisma.$transaction(async (tx) => {
    // ── Service 1: "cuidadora de gatos profissional" -> "Passeio individual" ──
    const svc1 = await tx.service.findUniqueOrThrow({ where: { id: SERVICE_PASSEIO_ID } });

    await applyIfMatches(
      "Service(Passeio).name",
      svc1,
      [{ field: "name", expectedBefore: "cuidadora de gatos profissional", after: "Passeio individual" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_PASSEIO_ID }, data }))
    );
    await applyIfMatches(
      "Service(Passeio).description",
      svc1,
      [
        {
          field: "description",
          expectedBefore: "dadasdasd",
          after: "Passeio individual para o seu cão, no ritmo dele. Bom para o dia a dia ou para quem tem rotina puxada durante a semana.",
        },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_PASSEIO_ID }, data }))
    );
    await applyIfMatches(
      "Service(Passeio).price",
      svc1,
      [
        { field: "priceMin", expectedBefore: 202, after: 35 },
        { field: "priceMax", expectedBefore: 202, after: 60 },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_PASSEIO_ID }, data }))
    );
    // isActive já é true — sem alteração necessária, não incluído como check.

    // ── Service 2: "Cuidador de PÍTBULL" (GROOMING, inativo) -> reaproveitado
    //    como "Cuidados em casa" (HOME_CARE, ativo) — 0 requests históricas
    //    ligadas a esta categoria (ligação é só por serviceType, sem FK) ──
    const svc2 = await tx.service.findUniqueOrThrow({ where: { id: SERVICE_CUIDADOS_CASA_ID } });

    await applyIfMatches(
      "Service(CuidadosCasa).name",
      svc2,
      [{ field: "name", expectedBefore: "Cuidador de PÍTBULL", after: "Cuidados em casa" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_CUIDADOS_CASA_ID }, data }))
    );
    await applyIfMatches(
      "Service(CuidadosCasa).description",
      svc2,
      [
        {
          field: "description",
          expectedBefore: "dssds",
          after: "Visita para alimentar, dar atenção e manter a rotina do pet enquanto você está fora de casa.",
        },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_CUIDADOS_CASA_ID }, data }))
    );
    await applyIfMatches(
      "Service(CuidadosCasa).serviceType",
      svc2,
      [{ field: "serviceType", expectedBefore: "GROOMING", after: "HOME_CARE" }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_CUIDADOS_CASA_ID }, data }))
    );
    await applyIfMatches(
      "Service(CuidadosCasa).price",
      svc2,
      [
        { field: "priceMin", expectedBefore: 100, after: 40 },
        { field: "priceMax", expectedBefore: 100, after: 80 },
      ],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_CUIDADOS_CASA_ID }, data }))
    );
    await applyIfMatches(
      "Service(CuidadosCasa).isActive",
      svc2,
      [{ field: "isActive", expectedBefore: false, after: true }],
      (data) => (DRY_RUN ? Promise.resolve() : tx.service.update({ where: { id: SERVICE_CUIDADOS_CASA_ID }, data }))
    );

    // ── Service 3 (novo): "Hospedagem familiar" — só cria se ainda não existir ──
    const existingHospedagem = await tx.service.findFirst({
      where: { professionalId: PROFESSIONAL_DEMO_ID, name: "Hospedagem familiar" },
    });
    if (existingHospedagem) {
      console.info("[Service(Hospedagem)] já existe — sem alterações necessárias.");
    } else {
      console.info("[Service(Hospedagem)] criação planejada: name=Hospedagem familiar, serviceType=BOARDING, priceMin=80, priceMax=160, isActive=true");
      if (DRY_RUN) {
        console.info("[Service(Hospedagem)] DRY RUN — nenhuma escrita realizada.");
      } else {
        const created = await tx.service.create({
          data: {
            professionalId: PROFESSIONAL_DEMO_ID,
            name: "Hospedagem familiar",
            description:
              "Hospedagem na casa da cuidadora, com companhia e ambiente familiar. Indicado para viagens ou períodos em que o tutor não pode ficar com o pet.",
            serviceType: "BOARDING",
            priceMin: 80,
            priceMax: 160,
            isActive: true,
          },
        });
        console.info(`[Service(Hospedagem)] criado. id=${created.id}`);
      }
    }

    // ── Disponibilidade semanal (weekday 0=Segunda ... 6=Domingo) ──────────────
    const availabilityTargets: Array<{ weekday: number; expectedBefore: { startTime: string; endTime: string; isActive: boolean }; after: { startTime: string; endTime: string; isActive: boolean } }> = [
      { weekday: 0, expectedBefore: { startTime: "09:00", endTime: "22:00", isActive: true }, after: { startTime: "09:00", endTime: "18:00", isActive: true } },
      { weekday: 1, expectedBefore: { startTime: "00:00", endTime: "00:00", isActive: false }, after: { startTime: "09:00", endTime: "18:00", isActive: true } },
      { weekday: 2, expectedBefore: { startTime: "00:00", endTime: "00:00", isActive: false }, after: { startTime: "09:00", endTime: "18:00", isActive: true } },
      // weekday 3 (Quinta-feira) já está em 09:00-18:00 ativa — nenhuma mudança necessária, fora do loop de propósito.
      { weekday: 4, expectedBefore: { startTime: "00:00", endTime: "00:00", isActive: false }, after: { startTime: "09:00", endTime: "18:00", isActive: true } },
      { weekday: 5, expectedBefore: { startTime: "09:00", endTime: "18:00", isActive: true }, after: { startTime: "09:00", endTime: "13:00", isActive: true } },
      { weekday: 6, expectedBefore: { startTime: "09:00", endTime: "18:00", isActive: true }, after: { startTime: "00:00", endTime: "00:00", isActive: false } },
    ];

    for (const target of availabilityTargets) {
      const row = await tx.professionalAvailability.findUniqueOrThrow({
        where: { professionalProfileId_weekday: { professionalProfileId: PROFESSIONAL_DEMO_ID, weekday: target.weekday } },
      });
      await applyIfMatches(
        `Availability(weekday=${target.weekday})`,
        row,
        [
          { field: "startTime", expectedBefore: target.expectedBefore.startTime, after: target.after.startTime },
          { field: "endTime", expectedBefore: target.expectedBefore.endTime, after: target.after.endTime },
          { field: "isActive", expectedBefore: target.expectedBefore.isActive, after: target.after.isActive },
        ],
        (data) =>
          DRY_RUN
            ? Promise.resolve()
            : tx.professionalAvailability.update({
                where: { professionalProfileId_weekday: { professionalProfileId: PROFESSIONAL_DEMO_ID, weekday: target.weekday } },
                data,
              })
      );
    }
  });

  console.info(`\n=== ${DRY_RUN ? "Dry run concluído — nenhuma escrita realizada." : "Execução concluída."} ===`);
}

main()
  .catch((err) => {
    console.error("Falha na execução do Lote C:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
