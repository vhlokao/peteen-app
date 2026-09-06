/**
 * Tipos do guard de destino.
 *
 * O guard é `.mjs` (e não `.ts`) porque precisa ser importado tanto pelos
 * scripts `.ts`, que rodam com `--experimental-strip-types`, quanto pelos `.mjs`
 * (`create-seed-users`, `create-isolated-admin`), que rodam em Node puro e não
 * conseguiriam importar TypeScript. Esta declaração dá tipagem ao primeiro
 * grupo sem obrigar o segundo a compilar nada.
 */

export declare class DestinoNaoConfirmadoError extends Error {
  constructor(mensagem: string)
}

export type AlvoDoBanco = {
  /** Host da conexão. Nunca contém credencial. */
  host: string
  /** Referência do projeto, quando extraível; senão o próprio host. */
  ref: string
}

export declare function identificarAlvo(databaseUrl: unknown): AlvoDoBanco | null

export declare function exigirDestinoConfirmado(params: {
  databaseUrl: string | undefined
  argv?: readonly string[]
}): { alvo: AlvoDoBanco; dryRun: boolean }
