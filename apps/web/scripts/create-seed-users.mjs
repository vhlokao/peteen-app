/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Cria 3 usuários de QA (Supabase Auth + User + persona de negócio) com
 * senha FIXA (não aleatória — objetivo é permitir login manual repetido
 * durante o teste, ao contrário de create-isolated-admin.mjs que gera
 * senha aleatória de uso único).
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita — e agora exige confirmação do banco de
 * destino, então a proteção deixou de depender da disciplina de quem roda.
 *
 * Uso:
 *   # 1. SEMPRE primeiro: mostra o destino e o plano, sem escrever nada.
 *   node scripts/create-seed-users.mjs --dry-run
 *
 *   # 2. Só então, confirmando explicitamente o banco de destino:
 *   node scripts/create-seed-users.mjs --target=<ref>
 *
 * Sem `--dry-run` e sem `--target`, a execução é BLOQUEADA — ver
 * scripts/lib/target-db-guard.mjs.
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
 * Nota de implementação: este script é .mjs puro, então não importa os
 * repositories de apps/web/modules/**\/*.ts diretamente (usam alias "@/..."
 * que não resolve fora do Next/tsconfig). Em vez disso, espelha exatamente o
 * mapeamento de campos de cada repository usado como referência (citado no
 * comentário de cada bloco) via Prisma direto — mesmo padrão já adotado em
 * create-isolated-admin.mjs para User/AdminProfile.
 *
 * EXCEÇÃO DELIBERADA — localização: escrever city/state/neighborhood direto no
 * Prisma fazia o seed BURLAR a normalização que todo cadastro real atravessa
 * (`normalizeLocationInput`), podendo semear grafias que o fluxo de produto
 * nunca produziria — e que depois aparecem como bairros duplicados
 * ("centro" vs "Centro") nas agregações territoriais. Por isso o helper real é
 * carregado via jiti, com o mesmo alias "@" do runtime: uma cópia da regra aqui
 * poderia divergir da original sem ninguém perceber.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import path from "path";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { exigirDestinoConfirmado } from "./lib/target-db-guard.mjs";
import { protegerPrisma, protegerSupabaseAdmin } from "./lib/dry-run-clients.mjs";
import { criarPersonaSemente } from "./lib/seed-persona.mjs";

// GATE-16: o guard anterior checava NODE_ENV/VERCEL_ENV, que são undefined em
// execução local — ou seja, nunca disparava justamente onde este script roda.
// O que importa é o BANCO de destino. Ver scripts/lib/target-db-guard.mjs.
// O guard decide o MODO. Daqui para baixo ninguém reinterpreta a flag: o modo
// vira cliente protegido, e em dry-run o script não recebe capacidade de
// escrever.
let MODO;
try {
  MODO = exigirDestinoConfirmado({
    databaseUrl: process.env.DATABASE_URL,
    argv: process.argv,
  });
  console.info(
    `[destino] ${MODO.alvo.host} (ref: ${MODO.alvo.ref})${MODO.dryRun ? " — DRY RUN, nada será escrito" : " — CONFIRMADO para escrita"}`
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const SEED_PASSWORD = "PeteenSeed2026!";

// Helper REAL de normalização de localização, carregado do domínio via jiti —
// nunca uma reimplementação. Se a regra mudar em modules/location, o seed
// acompanha automaticamente.
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(import.meta.dirname, "..") },
});
const { normalizeLocationInput } = await jiti.import("@/modules/location/index.ts");

/**
 * Aplica a normalização de produção sobre os campos de localização do seed.
 * Usar em TODO bloco que escreve city/state/neighborhood.
 */
function comLocalizacaoNormalizada({ city, state, neighborhood }) {
  return normalizeLocationInput({ city, state, neighborhood });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prismaReal = new PrismaClient({ adapter });

const supabaseReal = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Em dry-run, o resto do arquivo NÃO recebe cliente capaz de escrever: leituras
// passam, mutações lançam. É a rede embaixo do desvio explícito — se alguém
// acrescentar uma escrita nova e esquecer de checar o modo, o resultado é erro
// ruidoso, nunca um registro criado em silêncio.
const prisma = protegerPrisma(prismaReal, { dryRun: MODO.dryRun });
const supabaseAdmin = protegerSupabaseAdmin(supabaseReal, { dryRun: MODO.dryRun });

/**
 * Adaptador fino para `criarPersonaSemente` (scripts/lib/seed-persona.mjs).
 *
 * A orquestração saiu deste arquivo porque ele tem efeitos no topo (dotenv,
 * guard, Prisma, jiti) e não podia ser importado por um teste — e sem importar,
 * não havia como PROVAR que --dry-run não escreve. Agora a garantia é testada
 * com espiões, em vez de afirmada no comentário.
 */
async function createSeedPersona({ label, email, activePrimaryRole, createPersonaRecords }) {
  return criarPersonaSemente({
    prisma,
    supabaseAdmin,
    label,
    email,
    senha: SEED_PASSWORD,
    activePrimaryRole,
    criarRegistrosDaPersona: createPersonaRecords,
    dryRun: MODO.dryRun,
  });
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
          ...comLocalizacaoNormalizada({
            city: "Carapicuíba",
            state: "SP",
            neighborhood: null,
          }),
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
          ...comLocalizacaoNormalizada({
            city: "Carapicuíba",
            state: "SP",
            neighborhood: null,
          }),
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
          ...comLocalizacaoNormalizada({ city: "Carapicuíba", state: "SP" }),
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
          ...comLocalizacaoNormalizada({ city: "Carapicuíba", state: "SP" }),
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

  if (MODO.dryRun) {
    console.info("\n=== DRY RUN CONCLUÍDO — nenhuma escrita realizada ===");
    console.info(`Para executar de verdade: --target=${MODO.alvo.ref}`);
    // A senha do seed NÃO é impressa em dry-run: não existe conta para acessar,
    // e segredo que ninguém vai usar só vira material para vazar em log.
  } else {
    console.info("\n=== SEED CONCLUÍDO ===");
    console.info(`Tutor:         tutor.seed@peteen.test / ${SEED_PASSWORD}`);
    console.info(`Profissional:  profissional.seed@peteen.test / ${SEED_PASSWORD}`);
    console.info(`Parceiro:      parceiro.seed@peteen.test / ${SEED_PASSWORD}`);
  }
} finally {
  // Desconecta pelo cliente REAL: o proxy de dry-run existe só para barrar
  // escrita, e encerrar a conexão não deve passar por ele.
  await prismaReal.$disconnect();
}
