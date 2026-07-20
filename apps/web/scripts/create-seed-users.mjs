/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Cria 3 usuários de QA (Supabase Auth + User + persona de negócio) com
 * senha FIXA (não aleatória — objetivo é permitir login manual repetido
 * durante o teste, ao contrário de create-isolated-admin.mjs que gera
 * senha aleatória de uso único).
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita.
 * NUNCA rodar contra um banco de produção sem revisão e aprovação explícita.
 *
 * Uso:
 *   node scripts/create-seed-users.mjs
 *
 * Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
 *
 * Idempotente: se o email já existir como User, a persona inteira
 * (Auth + profile + registros relacionados) é pulada e logada como
 * "já existe" — nenhuma tentativa de recriar ou atualizar.
 *
 * Nota (mesma do create-isolated-admin.mjs): o projeto tem um trigger no
 * Postgres que sincroniza auth.users -> public.users automaticamente assim
 * que o Auth user é criado — por isso o User é gravado via upsert por
 * authId em vez de create puro.
 *
 * Nota de implementação: este script é .mjs puro (sem loader de TypeScript),
 * então não importa os repositories de apps/web/modules/**\/*.ts (usam alias
 * "@/..." que não resolve fora do Next/tsconfig). Em vez disso, espelha
 * exatamente o mapeamento de campos de cada repository usado como referência
 * (citado no comentário de cada bloco) via Prisma direto — mesmo padrão já
 * adotado em create-isolated-admin.mjs para User/AdminProfile.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Bloqueado: este script não deve rodar em ambiente de produção.");
  process.exit(1);
}

const SEED_PASSWORD = "PeteenSeed2026!";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Cria Auth user + User (upsert por authId) + persona de negócio dentro de
 * uma única transação Prisma. Em caso de falha na transação após o Auth
 * user já ter sido criado, reverte deletando o Auth user (mesmo padrão do
 * create-isolated-admin.mjs).
 */
async function createSeedPersona({ label, email, activePrimaryRole, createPersonaRecords }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info(`[${label}] já existe (User id=${existing.id}, email=${email}) — pulando.`);
    return;
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    console.error(`[${label}] Falha ao criar usuário no Supabase Auth:`, createErr?.message);
    return;
  }

  const authId = created.user.id;
  console.info(`[${label}] Supabase Auth user criado. authId:`, authId);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { authId },
        create: {
          authId,
          email,
          activePrimaryRole,
          onboardingCompletedAt: new Date(),
        },
        update: {
          email,
          activePrimaryRole,
          onboardingCompletedAt: new Date(),
        },
      });

      await createPersonaRecords(tx, user);
    });

    console.info(`[${label}] User + persona criados com sucesso. email:`, email);
  } catch (txErr) {
    console.error(
      `[${label}] Falha ao criar registros no Prisma — revertendo o usuário criado no Supabase Auth.`,
      txErr
    );
    await supabaseAdmin.auth.admin.deleteUser(authId).catch((e) => {
      console.error(`[${label}] Falha ao reverter o usuário do Supabase Auth. Remoção manual necessária. authId:`, authId, e);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR
// Espelha: modules/tutor/infrastructure/repository.ts → createTutorProfileRecord
//          modules/pets/infrastructure/repository.ts  → createPetRecord
// ─────────────────────────────────────────────────────────────────────────────
async function seedTutor() {
  await createSeedPersona({
    label: "TUTOR",
    email: "tutor.seed@peteen.test",
    activePrimaryRole: "TUTOR",
    createPersonaRecords: async (tx, user) => {
      const tutorProfile = await tx.tutorProfile.create({
        data: {
          userId: user.id,
          displayName: "Camila Seed",
          bio: null,
          phone: null,
          neighborhood: null,
          city: "Carapicuíba",
          state: "SP",
          lat: null,
          lng: null,
        },
      });

      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      await tx.pet.create({
        data: {
          tutorId: tutorProfile.id,
          name: "Bolinha",
          species: "DOG",
          breed: "Vira-lata",
          birthDate: threeYearsAgo,
          hasSpecialNeeds: false,
          isActive: true,
        },
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFISSIONAL
// Espelha: modules/professional/infrastructure/repository.ts →
//          createProfessionalProfileRecord, createServiceRecord
// ─────────────────────────────────────────────────────────────────────────────
async function seedProfessional() {
  await createSeedPersona({
    label: "PROFISSIONAL",
    email: "profissional.seed@peteen.test",
    activePrimaryRole: "PROFESSIONAL",
    createPersonaRecords: async (tx, user) => {
      const professionalProfile = await tx.professionalProfile.create({
        data: {
          userId: user.id,
          displayName: "João Seed",
          bio: "Profissional de teste para QA do Peteen. Cuido de pets com carinho.",
          phone: "11999990001",
          neighborhood: null,
          city: "Carapicuíba",
          state: "SP",
          lat: null,
          lng: null,
          avatarUrl: null,
          serviceTypes: ["PET_SITTING"],
          specializations: [],
        },
      });

      await tx.service.create({
        data: {
          professionalId: professionalProfile.id,
          name: "Serviço Seed",
          description: null,
          serviceType: "PET_SITTING",
          priceMin: 50,
          priceMax: 50,
          isActive: true,
        },
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PARCEIRO
// Espelha: modules/partners/infrastructure/repository.ts → createPartner
// PartnerProfile não tem repository de criação no projeto (só leitura em
// partner-portal) — criado direto via Prisma, vinculado por linkedPartnerId.
// ─────────────────────────────────────────────────────────────────────────────
async function seedPartner() {
  await createSeedPersona({
    label: "PARCEIRO",
    email: "parceiro.seed@peteen.test",
    activePrimaryRole: "PARTNER",
    createPersonaRecords: async (tx, user) => {
      const partner = await tx.partner.create({
        data: {
          businessName: "Pet Shop Seed",
          slug: "pet-shop-seed",
          category: "PET_SHOP",
          city: "Carapicuíba",
          state: "SP",
          phone: "11999990002",
          isVerified: false,
          isActive: true,
          onboardingStatus: "COMPLETED",
          onboardingCompletedAt: new Date(),
          verificationStatus: "NONE",
        },
      });

      await tx.partnerProfile.create({
        data: {
          userId: user.id,
          displayName: "Pet Shop Seed",
          type: "PET_SHOP",
          phone: "11999990002",
          city: "Carapicuíba",
          state: "SP",
          isVerified: false,
          linkedPartnerId: partner.id,
        },
      });
    },
  });
}

try {
  await seedTutor();
  await seedProfessional();
  await seedPartner();

  console.info("\n=== SEED CONCLUÍDO ===");
  console.info("Tutor:         tutor.seed@peteen.test / PeteenSeed2026!");
  console.info("Profissional:  profissional.seed@peteen.test / PeteenSeed2026!");
  console.info("Parceiro:      parceiro.seed@peteen.test / PeteenSeed2026!");
} finally {
  await prisma.$disconnect();
}
