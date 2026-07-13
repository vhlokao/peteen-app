import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Peteen — Encontre quem cuida do seu pet com confiança",
  description:
    "Profissionais com histórico real de atendimentos, avaliações de tutores e recomendação de parceiros locais. Grátis para tutores.",
}

/**
 * Home pública do Peteen.
 *
 * Princípios aplicados:
 * - Copy emocional: fala com a ansiedade do tutor antes de falar do produto.
 * - Confiança como produto: nenhuma menção a preço/distância/raio.
 * - Mobile-first, CTAs no thumb zone, alvos ≥ 44px.
 * - Imagens em /public/images/home (nomes sem acento — ver instruções de rename).
 */
export default function HomePage() {
  return (
    <main className="bg-[#FAFAF8] text-[#1A1A1A]">
      {/* ═══════════ NAV ═══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-[#16244F]/85 px-6 py-3.5 backdrop-blur-md lg:px-20">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white">
          <span className="size-2 rounded-full bg-[#E07A5F]" aria-hidden="true" />
          <span className="text-lg">Peteen</span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="#profissional"
            className="hidden px-3 py-2 text-[13px] font-medium text-white/60 transition-colors hover:text-white sm:inline-block"
          >
            Sou profissional
          </a>
          <Link
            href="/login"
            className="rounded-full bg-white px-4.5 py-2 text-[13px] font-semibold text-[#1D2F6F] transition-transform hover:-translate-y-px"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section
        aria-labelledby="hero-title"
        className="relative min-h-screen overflow-hidden flex items-center"
      >
        {/* Foto como fundo completo — mobile */}
        <div
          className="absolute inset-0 z-0 lg:hidden"
          style={{
            backgroundImage: "url('/images/home/hero_mobile_background.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Foto como fundo completo — desktop */}
        <div
          className="absolute inset-0 z-0 hidden lg:block"
          style={{
            backgroundImage: "url('/images/home/hero_desktop_background.webp')",
            backgroundSize: "cover",
            backgroundPosition: "right center",
          }}
        />

        {/* Overlay gradiente — texto legível à esquerda, foto visível à direita */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#16244F]/90 via-[#1D2F6F]/70 to-transparent" />

        {/* Selo flutuante — apenas desktop, perto do lado direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-10 top-28 z-20 hidden lg:flex xl:right-20"
        >
          <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#40916C]/15">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6.5l2.5 2.5 5-5.5"
                  stroke="#40916C"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-sm font-bold tracking-tight text-[#1D2F6F]">100% confiança</span>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="relative z-20 mx-auto w-full max-w-6xl px-6 pb-20 pt-28 lg:px-20">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[#40916C]" aria-hidden="true" />
            Rede de confiança para cuidados pet
          </div>

          <h1
            id="hero-title"
            className="mb-6 max-w-2xl font-heading text-[clamp(40px,6vw,70px)] font-extrabold leading-[1.05] tracking-tight text-white"
          >
            Quem cuida do seu pet quando{" "}
            <span className="text-[#6EC6FF]">você não pode?</span>
          </h1>

          <p className="mb-10 max-w-md text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/60">
            No Peteen, você encontra profissionais com{" "}
            <strong className="font-semibold text-white/90">histórico real de atendimentos</strong>,
            avaliações de tutores como você e recomendação de quem conhece de perto.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/discover"
              className="inline-flex min-h-[56px] items-center gap-2.5 rounded-2xl bg-white px-8 text-base font-bold text-[#1D2F6F] shadow-[0_8px_32px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5"
            >
              Encontrar profissional
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a href="#profissional" className="text-sm font-medium text-white/45 transition-colors hover:text-white/85">
              Trabalha com pets?{" "}
              <span className="underline decoration-white/20 underline-offset-4">Crie seu perfil</span>
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {["Perfis verificados","Avaliações reais","Parceiros locais","Grátis para tutores"].map((item) => (
              <div
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm"
              >
                <span className="flex size-3.5 items-center justify-center rounded-full bg-[#40916C]/25">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path d="M1.5 4l2 2 3.5-3.5" stroke="#40916C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAIXA DE CONFIANÇA ═══════════ */}
      <div
        role="list"
        aria-label="Compromissos do Peteen"
        className="border-b border-[#2C4893]/5 bg-white px-6 py-6"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {[
            "Perfis verificados",
            "Avaliações de tutores reais",
            "Recomendação de parceiros locais",
            "Grátis para tutores",
          ].map((item) => (
            <div key={item} role="listitem" className="flex items-center gap-2 text-[13px] font-medium text-[#6B6B63]">
              <span
                aria-hidden="true"
                className="flex size-[18px] items-center justify-center rounded-full bg-[#40916C]/10"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5.5l2 2 4-4.5"
                    stroke="#40916C"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ COMO FUNCIONA ═══════════ */}
      <section aria-labelledby="how-title" className="bg-[#FAFAF8] px-6 py-20 lg:px-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#E07A5F]">
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-[#E07A5F]" />
            Como funciona
          </p>
          <h2
            id="how-title"
            className="mb-4 max-w-lg text-[clamp(27px,5vw,40px)] font-extrabold leading-tight tracking-tight text-[#1D2F6F]"
          >
            Três passos entre você e a tranquilidade
          </h2>
          <p className="mb-12 max-w-md text-base leading-relaxed text-[#6B6B63]">
            Do primeiro clique até o pet em boas mãos — tudo registrado, tudo transparente.
          </p>

          <div role="list" className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {[
              {
                num: "01",
                title: "Busque na sua cidade",
                desc: (
                  <>
                    Digite onde seu pet mora e veja profissionais que atendem na sua região — com serviços ativos
                    e perfis completos. <strong className="font-semibold text-[#1A1A1A]">Sem cadastro obrigatório para explorar.</strong>
                  </>
                ),
              },
              {
                num: "02",
                title: "Conheça a história",
                desc: (
                  <>
                    Avaliações de tutores reais, <strong className="font-semibold text-[#1A1A1A]">quantos clientes voltaram</strong>,
                    selos conquistados e recomendações de pet shops e clínicas da sua vizinhança. Tudo verificável.
                  </>
                ),
              },
              {
                num: "03",
                title: "Solicite com segurança",
                desc: (
                  <>
                    A solicitação acontece dentro da plataforma: status claro, histórico registrado e avaliação ao
                    final. <strong className="font-semibold text-[#1A1A1A]">Você sabe o que aconteceu, quando e com quem.</strong>
                  </>
                ),
              },
            ].map((step) => (
              <div
                key={step.num}
                role="listitem"
                className="rounded-[20px] border border-[#2C4893]/[0.07] bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(44,72,147,0.1)]"
              >
                <span
                  aria-hidden="true"
                  className="mb-5 block text-5xl font-extrabold leading-none tracking-tight text-transparent [-webkit-text-stroke:1.5px_#2C4893]"
                >
                  {step.num}
                </span>
                <h3 className="mb-2.5 text-xl font-bold tracking-tight text-[#1D2F6F]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#6B6B63]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ POR QUE CONFIAR ═══════════ */}
      <section
        aria-labelledby="proof-title"
        className="relative overflow-hidden bg-[#1D2F6F] px-6 py-20 lg:px-20 lg:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 size-[460px] rounded-full bg-[#2C4893]/60 blur-3xl"
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6EC6FF]">
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-[#6EC6FF]" />
            Por que o Peteen é diferente
          </p>
          <h2
            id="proof-title"
            className="mb-4 max-w-lg text-[clamp(27px,5vw,40px)] font-extrabold leading-tight tracking-tight text-white"
          >
            Aqui, confiança não está à venda
          </h2>
          <p className="mb-12 max-w-md text-base leading-relaxed text-white/55">
            Nenhum profissional paga para aparecer primeiro. Nenhum selo pode ser comprado. O que você vê é o que
            foi conquistado.
          </p>

          <div role="list" className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path
                      d="M11 2L4 5.5v5.5c0 4.1 3 7.9 7 9 4-1.1 7-4.9 7-9V5.5L11 2z"
                      stroke="#6EC6FF"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7.5 11l2.5 2.5 4.5-4.5"
                      stroke="#6EC6FF"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                bg: "bg-[#6EC6FF]/10",
                title: "Histórico que não mente",
                desc: (
                  <>
                    Cada atendimento fica registrado. Cada avaliação vem de um serviço real concluído.{" "}
                    <strong className="font-semibold text-white/90">Um perfil no Peteen é uma história verificável</strong>{" "}
                    — não uma promessa.
                  </>
                ),
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path
                      d="M11 19.5c-1-.8-7-5.3-7-10a7 7 0 0 1 14 0c0 4.7-6 9.2-7 10z"
                      stroke="#E07A5F"
                      strokeWidth="1.5"
                    />
                    <circle cx="11" cy="9.5" r="2.5" stroke="#E07A5F" strokeWidth="1.5" />
                  </svg>
                ),
                bg: "bg-[#E07A5F]/12",
                title: "A vizinhança confirma",
                desc: (
                  <>
                    Pet shops, clínicas e ONGs da sua cidade recomendam profissionais que conhecem pessoalmente.{" "}
                    <strong className="font-semibold text-white/90">É a validação de quem vê o trabalho de perto</strong>{" "}
                    — todos os dias.
                  </>
                ),
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path
                      d="M4 11c0 3.9 3.1 7 7 7s7-3.1 7-7-3.1-7-7-7"
                      stroke="#40916C"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path d="M4 7V4h3" stroke="#40916C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 11l2 2 4-4" stroke="#40916C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
                bg: "bg-[#40916C]/12",
                title: "Quem volta, comprova",
                desc: (
                  <>
                    Quando um tutor contrata o mesmo profissional pela terceira vez, isso diz mais que qualquer
                    estrela. <strong className="font-semibold text-white/90">A recorrência aparece no perfil</strong> —
                    porque confiança que se repete é confiança de verdade.
                  </>
                ),
              },
            ].map((card) => (
              <div
                key={card.title}
                role="listitem"
                className="rounded-[20px] border border-white/10 bg-white/[0.05] p-7 backdrop-blur-sm transition-colors hover:border-white/[0.16] hover:bg-white/[0.08]"
              >
                <div className="mb-3.5 flex items-center gap-3.5">
                  <div className={`flex size-11 items-center justify-center rounded-[13px] ${card.bg}`}>{card.icon}</div>
                  <h3 className="text-lg font-bold tracking-tight text-white">{card.title}</h3>
                </div>
                <p className="text-sm leading-[1.75] text-white/60">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CATEGORIAS ═══════════ */}
      <section aria-labelledby="cat-title" className="bg-[#E8EEF6] px-6 py-20 lg:px-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#E07A5F]">
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-[#E07A5F]" />
            Serviços
          </p>
          <h2
            id="cat-title"
            className="mb-4 max-w-lg text-[clamp(27px,5vw,40px)] font-extrabold leading-tight tracking-tight text-[#1D2F6F]"
          >
            O que seu pet precisa hoje?
          </h2>
          <p className="mb-12 max-w-md text-base leading-relaxed text-[#6B6B63]">
            Cada serviço com profissionais dedicados e histórico próprio.
          </p>

          <div role="list" className="grid grid-cols-2 gap-3.5 lg:grid-cols-5 lg:gap-4">
            {[
              { emoji: "🐕", name: "Passeio", desc: "Energia gasta, patas felizes", href: "/discover?serviceType=walk" },
              { emoji: "🏠", name: "Pet Sitting", desc: "Cuidado no conforto de casa", href: "/discover?serviceType=pet_sitting" },
              { emoji: "🌙", name: "Hospedagem", desc: "Viaje tranquilo, ele fica bem", href: "/discover?serviceType=boarding" },
              { emoji: "🎓", name: "Adestramento", desc: "Educação com paciência", href: "/discover?serviceType=training" },
              { emoji: "💙", name: "Cuidado em Casa", desc: "Atenção para quem precisa mais", href: "/discover?serviceType=home_care" },
            ].map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                role="listitem"
                className="group relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-[#2C4893]/[0.06] bg-white p-5.5 transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(44,72,147,0.12)]"
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-[14px] bg-[#E8EEF6] text-2xl"
                >
                  {cat.emoji}
                </span>
                <p className="text-base font-bold tracking-tight text-[#1D2F6F]">{cat.name}</p>
                <p className="text-[13px] leading-snug text-[#6B6B63]">{cat.desc}</p>
                <span
                  aria-hidden="true"
                  className="absolute right-5 top-5 text-[#2C4893] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DEPOIMENTO ═══════════ */}
      <section aria-labelledby="voice-title" className="bg-[#FAFAF8] px-6 py-20 lg:px-20 lg:py-24">
        <h2 id="voice-title" className="sr-only">
          Depoimento de tutora
        </h2>
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[24px] shadow-[0_16px_56px_rgba(44,72,147,0.14)]">
            <Image
              src="/images/home/mulher_com_cachorro_horizontal.png"
              alt="Tutora abraçando seu cachorro shih tzu, ambos felizes"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>

          <div className="text-center lg:text-left">
            <span aria-hidden="true" className="mb-6 block font-serif text-7xl leading-[0.6] text-[#E07A5F]">
              &ldquo;
            </span>
            <blockquote>
              <p className="mb-8 text-[clamp(19px,4vw,28px)] font-bold leading-[1.4] tracking-tight text-[#1D2F6F]">
                Eu li as avaliações, vi que outros tutores voltavam sempre com ela, e resolvi confiar. Hoje a Mel
                late de alegria quando a Paula chega.
              </p>
            </blockquote>
            <div className="flex items-center justify-center gap-3.5 lg:justify-start">
              <div>
                <p className="text-[15px] font-semibold text-[#1A1A1A]">Ana Carolina M.</p>
                <p className="text-[13px] text-[#6B6B63]">Tutora da Mel · Carapicuíba, SP</p>
              </div>
            </div>
            <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-[#40916C]/15 bg-[#40916C]/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#40916C]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2.5 6.5l2.5 2.5 4.5-5"
                  stroke="#40916C"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Cliente recorrente há 4 meses
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ PROFISSIONAL ═══════════ */}
      <section
        id="profissional"
        aria-labelledby="pro-title"
        className="relative overflow-hidden bg-gradient-to-br from-[#16244F] to-[#1D2F6F] px-6 py-20 lg:px-20 lg:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-32 size-[460px] rounded-full bg-[#E07A5F]/[0.08] blur-3xl"
        />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#E07A5F]/25 bg-[#E07A5F]/12 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#E07A5F]">
              Para quem cuida
            </div>
            <h2
              id="pro-title"
              className="mb-4 max-w-lg text-[clamp(27px,5.5vw,44px)] font-extrabold leading-[1.1] tracking-tight text-white"
            >
              Seu trabalho fala.
              <br />O Peteen faz ele <em className="not-italic text-[#E07A5F]">ser ouvido</em>.
            </h2>
            <p className="mb-10 max-w-md text-base leading-relaxed text-white/55">
              Você não precisa cobrar menos para aparecer mais. No Peteen, sua reputação é construída pelo que
              você entrega — e ela trabalha por você.
            </p>

            <div role="list" className="mb-10 border-t border-white/10">
              {[
                {
                  num: "01",
                  title: "Um perfil que conta sua história",
                  desc: "Avaliações reais, atendimentos registrados e selos conquistados com trabalho — não comprados.",
                },
                {
                  num: "02",
                  title: "Clientes que voltam viram prova",
                  desc: "A recorrência aparece no seu perfil. Quem fez um bom trabalho uma vez, mostra. Quem fez três, convence.",
                },
                {
                  num: "03",
                  title: "A vizinhança indica você",
                  desc: "Pet shops e clínicas parceiras podem recomendar seu trabalho — e isso aparece para todos os tutores da região.",
                },
              ].map((benefit) => (
                <div key={benefit.num} role="listitem" className="flex gap-4 border-b border-white/10 py-5">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 text-[13px] font-bold tracking-wide text-[#E07A5F]">
                    {benefit.num}
                  </span>
                  <div>
                    <p className="mb-1 text-base font-bold tracking-tight text-white">{benefit.title}</p>
                    <p className="text-[13.5px] leading-relaxed text-white/50">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="inline-flex min-h-[54px] items-center gap-2.5 rounded-2xl bg-white px-7 text-[15px] font-bold text-[#1D2F6F] shadow-[0_8px_28px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.3)]"
            >
              Criar meu perfil grátis
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8h10M8.5 3.5 13 8l-4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[28px] border border-white/10 lg:max-w-none">
            <Image
              src="/images/home/cuidadora_com_cachorro_vertical.png"
              alt="Profissional pet sorrindo enquanto cuida de um golden retriever"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section aria-labelledby="final-title" className="bg-[#FAFAF8] px-6 py-24 text-center lg:py-28">
        <div aria-hidden="true" className="relative mx-auto mb-8 flex size-16 items-center justify-center">
          <span className="absolute size-16 animate-ping rounded-full border border-[#E07A5F]/30 [animation-duration:3s]" />
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="22" fill="#E07A5F" opacity="0.15" />
            <ellipse cx="22" cy="25" rx="7.5" ry="8" fill="#E07A5F" opacity="0.9" />
            <ellipse cx="12" cy="18.5" rx="4.5" ry="5" fill="#E07A5F" opacity="0.9" />
            <ellipse cx="19" cy="14.5" rx="4.5" ry="5" fill="#E07A5F" opacity="0.9" />
            <ellipse cx="26.5" cy="14.5" rx="4.5" ry="5" fill="#E07A5F" opacity="0.9" />
            <ellipse cx="33" cy="18.5" rx="4.5" ry="5" fill="#E07A5F" opacity="0.9" />
          </svg>
        </div>

        <h2
          id="final-title"
          className="mx-auto mb-4 max-w-xl text-[clamp(25px,6vw,42px)] font-extrabold leading-[1.1] tracking-tight text-[#1D2F6F]"
        >
          Ele confia em você.
          <br />
          Você pode confiar no Peteen.
        </h2>
        <p className="mx-auto mb-11 max-w-sm text-base leading-relaxed text-[#6B6B63]">
          Encontre alguém que cuida do seu pet como você cuidaria. Grátis, sem compromisso.
        </p>
        <div className="flex flex-col items-center gap-3.5 sm:flex-row sm:justify-center">
          <Link
            href="/discover"
            className="inline-flex min-h-[58px] items-center gap-2.5 rounded-2xl bg-[#2C4893] px-9 text-base font-bold text-white shadow-[0_8px_32px_rgba(44,72,147,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#1D2F6F] hover:shadow-[0_16px_48px_rgba(44,72,147,0.4)]"
          >
            Encontrar profissional
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 8h10M8.5 3.5 13 8l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <a href="#profissional" className="px-2 py-2.5 text-sm font-medium text-[#6B6B63] transition-colors hover:text-[#2C4893]">
            Trabalho com pets →
          </a>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer role="contentinfo" className="bg-[#16244F] px-6 py-12 lg:px-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <span className="size-2 rounded-full bg-[#E07A5F]" aria-hidden="true" />
              Peteen
            </Link>
            <p className="max-w-[280px] text-[13px] leading-relaxed text-white/30">
              Rede de confiança para cuidados pet. Construída atendimento por atendimento, no Brasil.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/discover" className="text-[13px] text-white/40 transition-colors hover:text-white/80">
              Encontrar profissional
            </Link>
            <a href="#profissional" className="text-[13px] text-white/40 transition-colors hover:text-white/80">
              Sou profissional
            </a>
            <Link href="/login" className="text-[13px] text-white/40 transition-colors hover:text-white/80">
              Entrar
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-white/5 pt-7 text-xs text-white/[0.18]">
          © 2026 Peteen · Todos os direitos reservados
        </p>
      </footer>
    </main>
  )
}
