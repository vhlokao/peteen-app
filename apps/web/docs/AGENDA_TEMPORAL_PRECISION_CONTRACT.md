# Contrato de Precisão Temporal de Agendamentos — Peteen

**Status:** regra técnica permanente (obrigatória).
**Escopo:** Agenda Foundation V0.3 em diante — toda exibição de `ServiceRequest.scheduledAt` e `ServiceRequest.endAt`.
**Fonte única:** `lib/date/zoned-datetime.ts` e `modules/service-request/domain/schedule-precision.ts`.
**Complementa:** `ENGINEERING_RULES.md` (§ Precisão Temporal de Agendamentos).

## Regra oficial

A formatação de `scheduledAt` **depende obrigatoriamente** de `scheduledHasTime`.
A precisão nunca é inferida do valor armazenado — só do flag.

### Request com precisão apenas de data — `scheduledHasTime = false`

- `scheduledAt` **não** representa um horário real; é uma **data civil histórica**.
- A data deve ser extraída/formatada em **UTC**.
- **Não** converter para `America/Sao_Paulo`.
- **Não** exibir horário.
- **Não** inferir precisão pela hora armazenada.

**Motivo:** existem registros legados ancorados tanto em **12:00 UTC** quanto em **00:00 UTC**.
Converter os de 00:00 UTC para BRT (−03:00) **desloca o dia para a véspera**. Renderizar
em UTC recupera o dia gravado para ambos os padrões.

### Request com horário real — `scheduledHasTime = true`

- `scheduledAt` representa um **instante real**.
- Deve ser convertido e exibido em **`America/Sao_Paulo`**.
- O horário **pode** ser exibido.
- `endAt`, quando confiável, segue a **mesma** política.

## Regra resumida

```
date-only → UTC                para preservar o dia gravado
timed     → America/Sao_Paulo  para representar o horário local real
```

## Timestamps de EVENTO — regra irmã

`scheduledAt` é ambíguo e depende de `scheduledHasTime`. Timestamps de **evento**
(`createdAt`, `acceptedAt`, `startedAt`, `completedAt`, `occurredAt`, `AuditLog`)
não têm essa ambiguidade: são sempre instantes reais. Formatá-los exige o mesmo
cuidado com fuso, mas **não** exige o flag de precisão.

Usar `formatEventInstant(instant, options)` de `lib/date/zoned-datetime.ts`.
O `timeZone` é injetado pelo helper — o chamador não consegue esquecê-lo.

**Incidente que originou a regra (23/08/2026, Android físico):** a timeline
"Etapas do atendimento" formatava com `Intl.DateTimeFormat("pt-BR", {...})` sem
`timeZone`, dentro de um **Server Component**. O runtime da Vercel é UTC, então
o relógio UTC saía impresso como se fosse local — um aceite às 16:06 BRT
aparecia como 19:06. Exatamente +3h, para todos os usuários.

**Por que fuso fixo e não o do aparelho:** Server Component não conhece o fuso
do browser — nenhum código do cliente rodou quando o HTML é gerado. Formatar
pelo aparelho exigiria mover a renderização para o cliente, e servidor e browser
produziriam strings diferentes para o mesmo nó (hydration mismatch em toda tela
com horário). O mesmo defeito já existia, latente, na Care Timeline: Client
Component é renderizado no servidor também, e o SSR saía em UTC.

## Fonte única — não duplicar

Usar sempre os helpers centrais. **Não** criar formatação local paralela em componentes.

- `lib/date/zoned-datetime.ts`
  - `scheduledDayTimeZone(scheduledHasTime)` → fuso correto para o dia.
  - `formatScheduledCivilDate(instant, scheduledHasTime, options)` → dia civil em pt-BR.
  - `formatZonedTime(instant, timeZone?)` → horário de parede.
  - `zonedCivilDateTimeToInstant(date, time, timeZone?)` → civil → instante UTC (criação).
  - `formatEventInstant(instant, options, timeZone?)` → timestamp de evento (ver seção acima).
- `modules/service-request/domain/schedule-precision.ts`
  - `getSchedulePrecision`, `canDisplayScheduledTime`, `canDisplayEndTime`.

## Proibições

Não:

- inferir legado por 00:00 UTC;
- inferir legado por 12:00 UTC;
- inferir precisão por `createdAt`;
- usar segundos como sentinela;
- chamar `toLocaleDateString`/`toLocaleString` sem `timeZone` explícito;
- formatar `scheduledAt` diretamente no componente;
- tratar todo `scheduledAt` como instante real;
- exibir 09:00 ou 21:00 fictícios para registros legados.

## Superfícies atualmente cobertas

- card de solicitação do profissional (`modules/professional-crm/components/professional-request-card.tsx`);
- card de solicitação do tutor (`modules/tutor-portal/components/tutor-request-card.tsx`);
- próximo atendimento (`modules/professional-crm/components/professional-next-appointment-card.tsx`);
- detalhe profissional (`app/(professional)/requests/[id]/page.tsx`);
- detalhe tutor (`app/(tutor)/tutor/requests/[requestId]/page.tsx`);
- agrupamento da Agenda (`modules/professional-crm/domain/agenda-grouping.ts`);
- listagem Admin (`app/(admin)/admin/requests/page.tsx`);
- detalhe Admin (`app/(admin)/admin/requests/[requestId]/page.tsx`).

## Obrigação futura

Toda **nova** tela que exibir data ou horário de uma solicitação **deve** usar o contrato
de precisão temporal central (helpers acima). Qualquer tela que renderize `scheduledAt`
sem passar por eles pode reintroduzir o bug de deslize de dia.

Adicionar teste de regressão cobrindo:

1. legado 12:00 UTC;
2. legado 00:00 UTC;
3. horário real 09:00 BRT — ainda que possua o mesmo timestamp da âncora legada de 12:00 UTC;
4. horário real próximo da meia-noite;
5. intervalo que atravessa a meia-noite.

Suíte de referência: `lib/date/agenda-temporal.test.ts` (`npm run test:agenda`).

---

*Esta documentação não contém dados pessoais, IDs reais nem credenciais.*
