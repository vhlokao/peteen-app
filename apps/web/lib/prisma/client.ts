import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient — Prisma 7 com driver adapter pg.
 *
 * Prisma 7 usa o engine "client" (WebAssembly) por padrão,
 * que requer um driver adapter para a conexão real ao banco.
 * Usamos @prisma/adapter-pg com o pool de conexões do `pg`.
 *
 * A URL de conexão usa o Supabase Transaction Pooler (porta 6543, pgbouncer)
 * para runtime. Migrations usam DIRECT_URL (porta 5432, conexão direta).
 *
 * NUNCA instanciar PrismaClient fora deste arquivo.
 * Importar: import { prisma } from "@/lib/prisma/client"
 */

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure .env.local with your Supabase connection string."
    );
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

/** Delegates adicionados após hot-reload — se ausentes, o client em cache está stale. */
const REQUIRED_DELEGATES = ["partner", "trustConnection", "region", "neighborhood", "verificationRequest"] as const;

/** Campos exigidos no model Partner — invalida cache após `prisma generate` (Etapa 6.1+). */
const REQUIRED_PARTNER_FIELDS = ["onboardingStatus", "verificationStatus"] as const;

function partnerModelHasField(
  fieldName: string,
  fields: ReadonlyArray<{ name: string }> | undefined
): boolean {
  return fields?.some((f) => f.name === fieldName) ?? false;
}

function getPartnerFieldsFromDmmf(): ReadonlyArray<{ name: string }> | undefined {
  return Prisma.dmmf.datamodel.models.find((m) => m.name === "Partner")?.fields;
}

function getPartnerFieldsFromClient(client: PrismaClient): ReadonlyArray<{ name: string }> | undefined {
  const runtime = client as unknown as {
    _runtimeDataModel?: { models?: Record<string, { fields?: Array<{ name: string }> }> };
  };
  return runtime._runtimeDataModel?.models?.Partner?.fields;
}

function isPrismaClientStale(client: PrismaClient): boolean {
  const record = client as unknown as Record<string, unknown>;
  if (REQUIRED_DELEGATES.some((key) => record[key] === undefined)) {
    return true;
  }

  // Hot-reload mantém PrismaClient antigo em globalThis mesmo após `prisma generate`.
  // Compara campos do DMMF atual vs runtime embutido na instância cacheada.
  const dmmfFields = getPartnerFieldsFromDmmf();
  const clientFields = getPartnerFieldsFromClient(client);

  for (const field of REQUIRED_PARTNER_FIELDS) {
    const expectedInDmmf = partnerModelHasField(field, dmmfFields);
    const presentInClient = partnerModelHasField(field, clientFields);
    if (expectedInDmmf && !presentInClient) {
      return true;
    }
  }

  return false;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance = globalForPrisma.prisma;
if (!prismaInstance || isPrismaClientStale(prismaInstance)) {
  prismaInstance = createPrismaClient();
}

export const prisma: PrismaClient = prismaInstance;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
