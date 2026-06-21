// Prisma 7 — configuração do CLI (generate, migrate, studio)
// A URL de conexão para o runtime está em lib/prisma/client.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL para migrations (conexão direta, sem pgbouncer)
    // DATABASE_URL para runtime (via pgbouncer no prisma/client.ts)
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
