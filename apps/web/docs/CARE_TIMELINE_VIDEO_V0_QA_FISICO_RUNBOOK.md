# Care Timeline Video V0 — QA Físico — Runbook de Execução

Base: DDL de vídeo aplicada e implementação publicada (não commitada ainda —
aguardando este QA). Dois buckets (`care-media` 5 MB, `care-media-video` 50
MB), enum `CareMediaType` com `VIDEO`, detector ISOBMFF, `Range` de 64 bytes
na validação, player nativo sem autoplay.

**Este documento é executado por um humano com aparelhos físicos.** Não tenho
câmera, Android ou iPhone reais — só um browser de preview neste ambiente, que
não reproduz hardware nem o comportamento real de Chrome/Safari mobile. Meu
papel aqui é (a) fornecer este roteiro e (b) correlacionar cada evento gerado
com `CareMedia`/`CareUpdate`/`PushDelivery` no banco, conforme os testes forem
sendo executados.

**Regra de ouro:** nada será corrigido durante a primeira rodada. Primeiro
registrar o comportamento real, consolidar os achados, só depois decidir o que
mexer.

---

## Baseline registrado antes do teste

| | |
|---|---|
| `care_media` por tipo | `PHOTO: 16`, `VIDEO: 0` |
| `care_updates` total | 31 |
| Contas seed disponíveis | `tutor.seed@peteen.test`, `profissional.seed@peteen.test` (senha `PeteenSeed2026!`) |

**O número que importa é `VIDEO = 0`.** Se depois do teste ele for maior que
zero, o pipeline de vídeo funcionou de fato — mesmo critério usado no QA da
Care Timeline de fotos.

---

## 0. Pré-requisito — NENHUMA Request está em `IN_PROGRESS`

Verificado no banco: todas as requests entre as contas seed estão
`COMPLETED`, `CANCELLED_BY_TUTOR` ou `EXPIRED`. A autorização de upload
(`authorizeCareMediaUpload`) exige `status === "IN_PROGRESS"` — sem isso, o
picker de mídia nem aparece.

**Antes de qualquer teste de vídeo:**

- [ ] Tutor cria uma nova solicitação com o profissional seed
- [ ] Profissional aceita
- [ ] Profissional inicia o atendimento (leva a `IN_PROGRESS`)
- [ ] Anotar o `requestId` (aparece na URL) — vou usá-lo para correlacionar

Se preferir usar contas reais em vez das seed, tudo abaixo funciona igual —
só me avise qual `requestId` usar.

---

## 1. Android — Profissional

Aparelho: ______________ | Versão Android: ______ | Chrome: ______

### A. "Gravar vídeo"

- [ ] Botão "Gravar vídeo" aparece (só quando não há foto/vídeo já selecionado
      na atualização)
- [ ] Toca → abre a câmera (ou pede permissão primeiro)
- [ ] Grava vídeo curto (5–10s)
- [ ] Confirma a seleção
- [ ] Preview aparece na tela do picker (primeiro frame, sem tocar áudio)
- [ ] Publica o CareUpdate

Esperado, sem exceção:
- [ ] sem crash, sem reload da página
- [ ] indicador de envio ("enviando…") visível durante o upload
- [ ] botão de publicar protegido contra duplo toque
- [ ] publicação conclui
- [ ] vídeo aparece na timeline do profissional depois de publicar

### B. "Escolher vídeo"

- [ ] Seleciona um MP4 ou MOV real da galeria, < 60s, < 50 MB
- [ ] Publica

### C. Duração > 60s

- [ ] Seleciona um vídeo real conhecidamente maior que 60s

Esperado:
- [ ] bloqueado **antes** do upload — mensagem: *"Este vídeo é muito longo. O
      limite é 60 segundos."*
- [ ] nada deve aparecer no bucket para este arquivo (eu confirmo pelo log —
      ver seção de correlação)

### D. Rede lenta

- [ ] Ativa throttling real (modo avião ligando/desligando, ou 3G forçado nas
      configurações de desenvolvedor) e publica um vídeo de 20–40 MB

Esperado:
- [ ] a tela continua compreensível (não trava, não parece quebrada)
- [ ] não permite novo envio em cima do que já está em voo
- [ ] se a conexão cair no meio, o erro é recuperável — dá para tentar de novo
      sem perder a seleção

---

## 2. Tutor — Playback

Segundo usuário real, aparelho separado se possível.

- [ ] Abre a Care Timeline da mesma Request
- [ ] Vídeo aparece na atualização correta
- [ ] **Não toca sozinho** ao abrir a tela (sem autoplay)
- [ ] Timeline não trava nem demora para renderizar por causa do vídeo
- [ ] Player é responsivo (não estoura a largura da tela)
- [ ] Play só começa quando o tutor toca
- [ ] Seek (arrastar a barra) funciona
- [ ] Pause funciona
- [ ] Áudio funciona
- [ ] Tela cheia funciona, se o browser oferecer o controle
- [ ] Dá refresh na página → vídeo continua acessível (URL assinada nova)

Também confirmar:
- [ ] Um usuário **sem acesso** a esta Request (outra conta) não consegue
      abrir o vídeo — me avise se quiser que eu tente reproduzir isso via
      `authorizeCareMediaRead` para confirmar o retorno `null`

---

## 3. iPhone / Safari — prioridade máxima

Modelo: ______________ | iOS: ______ | Safari

- [ ] Toca "Gravar vídeo" → registrar o que o Safari realmente faz:
      abre a câmera direto, ou mostra um menu (Câmera / Fototeca / Arquivos)?
- [ ] Grava um vídeo real pela câmera do iPhone
- [ ] Publica
- [ ] Escolhe um vídeo já existente na Fototeca (gravado nativamente pelo
      iPhone — geralmente `.mov`/QuickTime)
- [ ] Publica
- [ ] Playback no tutor, em Safari

Observar e **registrar sem julgar como bug** se for comportamento nativo do
iOS:
- [ ] orientação do vídeo (retrato/paisagem) — preservada?
- [ ] áudio presente?
- [ ] duração lida corretamente pelo picker antes do upload?
- [ ] o arquivo produzido pelo iPhone é aceito pelo detector (não deveria
      cair em "formato não suportado")?

Isto é o teste mais importante da rodada: o detector foi construído para
reconhecer especificamente o brand `qt  ` (QuickTime, com os dois espaços) —
é exatamente o que um iPhone real produz, e é o único jeito de confirmar que
funciona.

---

## 4. Limites — bateria física

- [ ] vídeo 5–10s → aceito
- [ ] vídeo ~55–60s → aceito (perto do limite)
- [ ] vídeo > 60s → bloqueado no cliente, nada sobe
- [ ] vídeo bem pequeno (poucos MB) → aceito
- [ ] vídeo perto de 50 MB → aceito
- [ ] vídeo acima de 50 MB, se conseguir produzir um → recusado
- [ ] arquivo de tipo incompatível (ex.: renomear um `.avi` para tentar
      selecionar, ou um WebM se o aparelho gravar nesse formato) → recusado,
      nunca vira `CareMedia`

---

## 5. Regressão de foto

Depois de todo o teste de vídeo, **na mesma sessão**, publicar uma foto normal
numa nova atualização.

- [ ] Foto continua funcionando normalmente
- [ ] Limite de foto continua sendo 5 MB (tentar uma imagem grande, se tiver)
- [ ] Miniatura da foto aparece na timeline
- [ ] Nada do fluxo de foto mudou de comportamento

---

## 6. Push / Notification Center

Publicar um CareUpdate com vídeo e observar o aparelho do tutor (se ele tiver
push ativado).

- [ ] Comportamento igual a qualquer CareUpdate — mesmo aviso, mesma copy
- [ ] Nenhum push "extra" ou diferente por ser vídeo
- [ ] Se publicar dois updates (com ou sem vídeo) na mesma janela de 1h, o
      cooldown de anti-spam continua suprimindo o segundo aviso
- [ ] Notification Center do tutor mostra a atualização normalmente

**Depois de cada evento**, me avise o horário aproximado ou o `requestId` —
eu confiro `PushDelivery` para confirmar que não foi criado nenhum evento de
push específico de vídeo, fora do contrato `care_update` já existente.

---

## 7. Tabela de resultado

Preencher um bloco por aparelho testado:

```
DISPOSITIVO:
OS:
BROWSER:

GRAVAR VÍDEO:        PASS / FAIL
ESCOLHER VÍDEO:      PASS / FAIL
PUBLICAÇÃO:          PASS / FAIL
PLAYBACK:            PASS / FAIL
DURAÇÃO >60s:        PASS / FAIL
REDE RUIM:           PASS / FAIL
FOTO REGRESSÃO:      PASS / FAIL

OBSERVAÇÕES:
```

### Se houver falha, registrar exatamente

- passo onde ocorreu;
- comportamento observado;
- comportamento esperado (copiar da seção correspondente acima);
- console/log do navegador, se conseguir abrir (Chrome DevTools remoto para
  Android, ou Safari remoto de um Mac para iPhone — se não tiver acesso a
  isso, sem problema, meu lado da correlação (banco) ainda ajuda a
  diagnosticar);
- tipo, tamanho e duração aproximada do arquivo que falhou.

---

## O que eu faço em paralelo — correlação por evento

Para cada publicação (sucesso ou falha), me diga o `requestId` e o horário
aproximado. Eu consulto:

- `care_media` — se a linha foi criada, com que `type`, `mimeType`,
  `sizeBytes` reais;
- `care_updates` — se o update foi publicado;
- `push_deliveries` — se o evento de push seguiu o contrato normal;
- os buckets no Storage — se sobrou algum objeto órfão (upload que não virou
  publicação, por exemplo no teste de "duração > 60s" ou "rede caiu no meio").

Isso fecha o loop: o que você vê na tela, eu confirmo (ou não) no servidor.

---

## Veredito final

- 🟢 **APTO PARA PILOTO**
- 🟡 **APTO COM PENDÊNCIA DELIMITADA**
- 🔴 **BLOQUEADO**

---

*Não commitar nada durante esta rodada. Primeiro consolidar todos os achados.*
