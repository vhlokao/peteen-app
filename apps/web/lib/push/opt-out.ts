/**
 * Opt-out DELIBERADO de push neste dispositivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ESTE ARQUIVO IMPEDE
 *
 * "Desativar" revoga a subscription no servidor e desinscreve no browser. Mas a
 * PERMISSÃO continua `granted` — o browser não a esquece. Sem nenhuma marca de
 * intenção, o estado resultante (permissão concedida, sem subscription) é
 * BYTE A BYTE o mesmo de um relogin, que é justamente o estado que a
 * reconciliação automática existe para consertar.
 *
 * O resultado seria absurdo e silencioso: a pessoa desligaria as notificações e,
 * segundos depois, o reconciliador as ligaria de volta sozinho — sem aviso, sem
 * clique, e sem nenhuma forma de ela impedir isso a não ser bloqueando o site no
 * navegador.
 *
 * Esta marca é o que distingue "perdi a subscription" de "eu não quero
 * subscription". É a mesma distinção que o logout já faz do outro lado: logout
 * NÃO grava esta marca, de propósito, porque sair da conta não é desligar
 * notificações — e é por isso que o push volta sozinho no próximo login.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE `localStorage` E NÃO O SERVIDOR
 *
 * No V0, "push ligado" é exatamente "existe subscription ativa para este
 * aparelho" — não existe tabela de preferência, e criar uma aqui seria criar
 * uma segunda fonte de verdade sobre o mesmo fato. A intenção é sobre ESTE
 * dispositivo, e o dispositivo é quem a guarda.
 *
 * `localStorage` (não `sessionStorage`): desligar notificações precisa
 * sobreviver a fechar o navegador. Uma preferência que evapora ao fechar a aba
 * não é uma preferência.
 *
 * CONSEQUÊNCIA ACEITA E CONHECIDA: a marca é do aparelho, não da conta. Se A
 * desativa e B entra no mesmo navegador, B começa vendo "desativadas" com o
 * botão de ativar — um clique a mais, num estado descrito corretamente. O
 * inverso (ignorar a marca por ser de outra conta) traria de volta o
 * religamento silencioso, que é muito pior.
 */

const CHAVE = "peteen:push:optout"

/** A pessoa desligou push neste aparelho de propósito? */
export function optOutLocalAtivo(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "1"
  } catch {
    // Modo privado / storage bloqueado. Sem marca, o comportamento volta a ser
    // o de reparo automático — aceitável: ali a preferência não teria como
    // sobreviver de nenhum jeito.
    return false
  }
}

/** Chamado por "Desativar". NUNCA pelo logout. */
export function marcarOptOutLocal(): void {
  try {
    window.localStorage.setItem(CHAVE, "1")
  } catch {
    // Ver optOutLocalAtivo.
  }
}

/**
 * Chamado quando a pessoa pede push de volta — e também quando o estado
 * observado prova que push está ativo apesar da marca (uma desativação que não
 * chegou a concluir deixaria a marca mentindo sobre a realidade).
 */
export function limparOptOutLocal(): void {
  try {
    window.localStorage.removeItem(CHAVE)
  } catch {
    // Ver optOutLocalAtivo.
  }
}
