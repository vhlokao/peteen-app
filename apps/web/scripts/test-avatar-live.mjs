// Bootstrap do gate `npm run test:avatar:live`.
//
// Existe só para setar AVATAR_LIVE_REQUIRED=1 de forma PORTÁVEL entre
// cmd.exe/PowerShell/bash: o prefixo `VAR=valor comando` de scripts npm
// funciona em bash mas não em cmd.exe (o shell padrão do npm no Windows), e o
// projeto não depende de `cross-env` — não vale introduzir a dependência só
// por isto. `spawnSync` com `env` explícito é o mesmo padrão já usado em
// lib/prisma/pg-timestamp-utc.test.ts para o mesmo tipo de problema (TZ por
// subprocesso).
import { spawnSync } from "node:child_process"

const r = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", "lib/storage/avatar-ownership-contract.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, AVATAR_LIVE_REQUIRED: "1" },
  }
)

process.exit(r.status ?? 1)
