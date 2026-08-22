import type { Metadata } from "next"

/**
 * Metadata compartilhado das ÁREAS PRIVADAS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UMA CONSTANTE, E NÃO O OBJETO REPETIDO EM CADA LAYOUT
 *
 * Seis layouts precisam da mesma regra (auth, onboarding, tutor, professional,
 * partner, admin). Repetir o literal seis vezes é o tipo de duplicação que
 * diverge no primeiro ajuste: alguém acrescenta `nocache` em um e esquece dos
 * outros cinco, e ninguém percebe porque o efeito é invisível na tela.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `follow: false` JUNTO COM `index: false`
 *
 * `noindex` sozinho ainda autoriza o crawler a seguir os links da página e
 * descobrir outras rotas internas. Numa área autenticada não há link que valha
 * a pena seguir, então negar os dois é estritamente melhor e não custa nada.
 *
 * `googleBot` é declarado explicitamente porque o Google respeita diretivas
 * específicas dele acima da genérica quando ambas existem — deixar só a
 * genérica funciona, mas ser explícito remove a dúvida na revisão.
 *
 * Isto NÃO substitui o /robots.txt: `Disallow` pede para não rastrear,
 * `noindex` impede de indexar. Ver o comentário em app/robots.ts.
 */
export const PRIVATE_AREA_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}
