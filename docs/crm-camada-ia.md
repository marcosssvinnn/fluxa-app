# Camada de IA — o que existe, o que falta e por quê

> Status em 2026-08-06: **o dossiê de assembleia já funciona, sem IA.**
> A camada de IA continua não implementada, e este documento explica
> exatamente o que trava e o que seria preciso do Marcos para destravar.

---

## O que JÁ está entregue (sem IA, funcionando)

**Dossiê de assembleia** — `gerarDossieAssembleia()` em `app.js`, botão
"🗳️ Dossiê" no histórico de vistorias (aparece só quando há item crítico).

Gera um laudo de uma página para o **síndico apresentar** na assembleia:

- cabeçalho com o branding da empresa (usa `LC.cor` da loja)
- contagem de itens: ação imediata / programar / total
- para cada item crítico: equipamento, ambiente, o que o técnico encontrou,
  **a consequência de não fazer** e a foto do registro
- tabela compacta dos itens preventivos

O bloco **"Se não for feito"** é a peça que faltava. O relatório de vistoria
descreve o problema técnico; a assembleia decide com base na *consequência*.
Esse texto é determinístico — regra por tipo de equipamento × status
(`_DOSSIE_CONSEQ`), não IA. Roda offline, custo zero, sem chave de API.

Testado com a vistoria real do Infinity Coast Tower: 5 itens críticos
numerados, 4 com foto, consequências corretas por tipo de equipamento.

---

## O que a IA acrescentaria

Redação adaptada ao caso específico, no lugar do texto por regra. Ganho real,
mas **incremental** sobre o que já existe — não é a diferença entre ter e não
ter o documento.

Ordem de valor, se for feito:

1. **Refinar o texto do dossiê** — hoje a consequência é boa para o tipo de
   equipamento, mas genérica quanto ao contexto daquele condomínio.
2. **Personalizar a frase de abordagem** da fila de follow-up
   (`crmSugestaoFala`) com o histórico daquele cliente.

---

## Por que não está implementado

Três bloqueios, e **nenhum deles é código**:

| Bloqueio | Por quê | Quem resolve |
|---|---|---|
| **Chave de API** | Groq/Gemini exigem conta. O repositório é **público** — a chave não pode ir no `app.js` em nenhuma hipótese | Marcos cria a conta |
| **Onde guardar a chave** | Precisa de Edge Function (servidor). Este repo **não tem** pasta `supabase/` nem projeto de functions | Marcos ou eu, com o CLI autenticado |
| **Deploy** | `supabase functions deploy` exige CLI instalado e login com o token do projeto | Marcos |

Eu poderia escrever o código da Edge Function agora, mas ele ficaria no repo
sem rodar — e código que não roda envelhece e engana quem for ler depois.
Prefiro escrever no momento em que houver como testá-lo de ponta a ponta.

## Como destravar (quando quiser)

1. Criar conta no **Groq** (free tier: 1.000 req/dia, sem cartão) e gerar a key.
2. Me avisar — eu escrevo a Edge Function, você roda:
   ```
   supabase secrets set GROQ_API_KEY=...
   supabase functions deploy gerar-dossie
   ```
3. O app passa a chamar a function; **se ela falhar ou estiver fora, cai no
   texto determinístico atual** — nunca fica sem dossiê.

## Regras que valem quando isso for construído

- Chave **só** no servidor. Repositório público.
- **Pré-cálculo, nunca chamada ao vivo** na abertura da tela: latência, quota
  e dependência de terceiro. Um dossiê é gerado sob demanda (é um clique
  consciente), então aqui a chamada ao vivo é aceitável — mas com timeout e
  fallback para o texto por regra.
- O modelo **veste** fatos que o SQL/JS já apurou; é proibido inferir. Guardar
  os fatos entregues, para auditar depois se o texto bate com a vistoria.
- Rejeitar resposta vazia, longa demais, ou que cite número que não está nos
  fatos.

## LGPD

Decisão do Marcos (2026-08-06): não anonimizar por ora — software interno.
Registrado. Gatilho de reavaliação: quando houver empresa pagante que não seja
dele, dado pessoal de terceiro passa a sair para API de terceiro. Mitigação é
barata (código no lugar do nome no payload; o modelo não precisa saber que é o
"Condomínio X" para escrever a consequência de um trocador vazando).
