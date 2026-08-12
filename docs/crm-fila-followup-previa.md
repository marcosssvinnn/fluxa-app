# Prévia da fila de follow-up — 🛑 PONTO DE PARADA

> **Para o Marcos avaliar antes de eu construir a tela.** Ambos os planos de CRM
> (o do v2 e o adaptado) definem esta etapa como obrigatória: se a lista abaixo
> não fizer você dizer *"é, eu ligaria pra esses"*, o problema está nos gatilhos
> ou nos dados — e construir painel por cima só encarece a descoberta. Ajustar
> os pesos agora é barato; depois de pronto, não é.
>
> Gerado em 2026-08-06 com os dados reais (`loja_id LIKE 'fortemp%'`).
> **Nada foi implementado na tela ainda.**

---

## Como a fila é ordenada

```
score = (valor / 1000) × peso_relacao ÷ dias_parado
        peso_relacao = 3 se já é cliente, 1 se nunca comprou
```

A intuição: **valor alto e recente sobe; negócio velho desce**; e quem já
comprou vale 3× mais tempo de telefone (medido: 14 clientes que já fecharam têm
R$ 239k em aberto, contra 114 que nunca fecharam com R$ 2,04 mi — os primeiros
convertem muito melhor).

**Filtro negativo aplicado antes de tudo:** quem já comprou equipamento não
recebe nova oferta de equipamento.

## Efeito do filtro negativo

| | |
|---|---|
| Orçamentos em aberto | 171 |
| **Suprimidos (já têm equipamento)** | **2 — R$ 169.210** |
| Entram na fila | 169 |

O suprimido é o **Ibiza Towers**, que comprou trocador em 02/05 (R$ 29.885) e
seguiu recebendo ofertas do mesmo produto. Era o caso que motivou a regra.

## Top 12 da fila hoje

| # | Cliente | Valor | Dias | Trilho | Já é cliente | Score |
|---|---|---|---|---|---|---|
| 1 | Residencial Splendour Of The Sea | R$ 47.774 | 1 | EQUIP | não | 47,8 |
| 2 | Infinity Flat | R$ 59.826 | 3 | EQUIP | não | 19,9 |
| 3 | Platinum Residence | R$ 83.497 | 6 | EQUIP | não | 13,9 |
| 4 | Julio Cesar | R$ 13.127 | 0 | EQUIP | não | 13,1 |
| 5 | Platinum Residence | R$ 65.035 | 6 | EQUIP | não | 10,8 |
| 6 | Andresa | R$ 9.871 | 1 | EQUIP | não | 9,9 |
| 7 | Residencial Dalcelis | R$ 49.200 | 7 | EQUIP | não | 7,0 |
| 8 | Condomínio Metrópolis | R$ 80.903 | 13 | EQUIP | não | 6,2 |
| 9 | Condomínio Metrópolis | R$ 69.783 | 14 | EQUIP | não | 5,0 |
| 10 | Villa dos Corais | R$ 11.157 | 3 | SERV | não | 3,7 |
| 11 | Danilo | R$ 26.208 | 8 | EQUIP | não | 3,3 |
| 12 | Edifício Green Valey | R$ 14.465 | 7 | EQUIP | não | 2,1 |

---

## O que eu quero que você olhe

**1. Você ligaria para esses, nessa ordem?** Se a ordem parecer errada, o
conserto é mudar o peso — não o código todo.

**2. A fila está 11/12 no trilho EQUIPAMENTO.** Isso é consequência do valor
mandar no score, e é exatamente o risco que os dois planos apontaram: o vendedor
passa o dia no trilho que converte 7%, enquanto serviço converte 43,5%. Três
saídas possíveis:

- **(a) Duas filas separadas** — "equipamento" e "serviço", cada uma com sua meta
  (recomendo)
- (b) Uma fila só, mas com cota — ex.: no máximo 5 de equipamento por dia
- (c) Deixar como está e aceitar o foco em valor

**3. Ninguém na lista é "já cliente".** O peso 3× não teve efeito porque os 14
clientes recorrentes não têm orçamento grande em aberto. O peso continua certo
para quando tiver — mas vale saber que hoje não muda nada.

**4. O `dias` está baixo** (0 a 14) porque a base foi criada recentemente. Quando
houver negócio parado há 60+ dias, o divisor vai empurrá-los para o fim — o que
pode estar errado: um negócio de R$ 80k parado há 90 dias talvez mereça uma
ligação de "última chance" em vez de sumir. Vale decidir se cria um gatilho de
resgate separado.

**5. Falta o gatilho de assembleia**, porque o campo ainda não existe (é da Fase
3, com schema). Enquanto isso, negócio de equipamento aparece pela idade — o que
funciona, mas não sabe distinguir "esquecido" de "aguardando reunião do
condomínio".

---

## Próximo passo sugerido

Você responde os 5 pontos acima (principalmente o **2**), eu ajusto os pesos e
só então construo a tela. Sem isso, a tela nasce com a ordenação errada.
