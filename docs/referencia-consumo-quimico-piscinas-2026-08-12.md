# Referência técnica — consumo de produtos químicos para piscinas (Brasil)

> Trazida pelo Marcos em 2026-08-13 (pesquisa externa, a pedido, pra embasar
> a Etapa 4 do roadmap de CRM — "consumo teórico" de recompra). Usada em
> `app.js` (`CONSUMO_QUIMICO_REF`/`consumoTeoricoDias()`) — só os itens de
> confiança alta (dicloro, hipoclorito de cálcio, cloro líquido, pastilha,
> sal salino) foram implementados como cálculo real; o resto fica registrado
> aqui pra quando alguém quiser estender. `d` está fixado na referência
> "verão/externa/uso moderado/estabilizada" (2,0 g Cl₂/m³/dia) — os
> coeficientes de ajuste por estação/capa/banhistas (seção 2.2) NÃO foram
> aplicados porque a ficha da piscina não captura esses campos hoje.

Base para estimativa de recompra a partir de volume (m³) e tipo de tratamento.
Versão: 2026-08-12

---

## 1. Modelo geral

Toda estimativa de duração de embalagem deriva de uma única equação:

```
T_dias = Q_embalagem / (q × V)
```

| Símbolo | Significado |
|---|---|
| `V` | Volume da piscina em m³ |
| `Q_embalagem` | Quantidade contida na embalagem, na unidade do próprio produto (g, mL, unidades) |
| `q` | Consumo diário por m³, na mesma unidade de `Q_embalagem` |
| `T_dias` | Dias até o esgotamento da embalagem |

Para produtos clorados/bromados, `q` não é uma constante de rótulo — deriva da **demanda diária de sanitizante** da piscina:

```
q = d / A
```

| Símbolo | Significado |
|---|---|
| `d` | Demanda diária de cloro ativo, em g Cl₂ por m³ por dia (numericamente igual a ppm/dia) |
| `A` | Teor de cloro ativo do produto (fração decimal) |

Para produtos com dose fixa de rótulo (algicida, clarificante, corretores de pH), `q` vem direto:

```
q = dose_por_m³_por_aplicação / intervalo_em_dias
```

### 1.1 Por que não usar a dose de rótulo como base

A dose de rótulo ("3 g/m³, 3× por semana") descreve uma aplicação, não um consumo. Ela implicitamente assume uma demanda `d` específica — normalmente de piscina em condição amena. Piscinas reais variam de `d = 0,5` a `d = 6,0`, ou seja, um fator de 12× no consumo. Um sistema de previsão que fixa a dose de rótulo erra por ordem de grandeza nos extremos.

O balanço de massa é inviolável: **um produto não pode entregar mais cloro ativo do que a massa de cloro ativo que contém.** Sempre que uma alegação de rótulo contradisser o balanço de massa, o balanço de massa vence.

---

## 2. Valores de referência de `d` (demanda diária de cloro)

Piscina externa, estabilizada com ácido cianúrico entre 30 e 50 ppm.

| Cenário | `d` (g Cl₂/m³/dia) |
|---|---|
| Coberta com capa térmica, uso baixo | 0,5 – 0,9 |
| **Externa, sol pleno, uso residencial moderado, verão (REFERÊNCIA)** | **1,8 – 2,5** — usar 2,0 |
| Externa, inverno / meia-estação | 0,9 – 1,3 |
| Sem estabilizante (AC < 20 ppm), sol pleno | 3,5 – 6,0 |
| Piscina de condomínio, alta carga de banhistas | ver fórmula de carga abaixo |

### 2.1 Carga de banhistas (crítico para condomínio)

Carga de banhistas **soma** à demanda, não multiplica:

```
d_total = d_base + (n_banhistas_por_dia × 4) / V
```

O valor de 4 g de Cl₂ por banhista é uma média (faixa real 3–8 g, maior para crianças, uso prolongado e piscina sem ducha obrigatória na entrada).

Exemplo: piscina de condomínio de 80 m³, 60 banhistas/dia no verão:
`d_total = 2,0 + (60 × 4)/80 = 2,0 + 3,0 = 5,0 g/m³/dia` — 2,5× o consumo de uma residencial equivalente.

### 2.2 Coeficientes multiplicadores sobre `d`

Aplicar sobre `d_base` (multiplicativos entre si; usar com parcimônia, não empilhar mais de 3):

| Fator | Coeficiente |
|---|---|
| Capa térmica opaca (bloqueia UV + evaporação) | 0,40 – 0,60 |
| Sombreamento parcial / piscina coberta | 0,60 – 0,80 |
| Sem estabilizante, sol pleno | 1,80 – 2,50 |
| Piscina aquecida a 30–32 °C | 1,20 – 1,40 |
| Estação — verão | 1,00 |
| Estação — meia-estação | 0,70 |
| Estação — inverno | 0,45 |
| Temporada de chuva (carga orgânica + diluição de AC) | 1,10 – 1,25 |
| Auxiliar de ozônio, UV ou ionizador Cu/Ag | 0,50 – 0,70 |
| Filtragem subdimensionada ou histórico de algas | 1,50 – 3,00 |

---

## 3. Tabela principal por tipo de tratamento

Fórmulas de referência (`ref`) calculadas com `d = 2,0` (verão, externa, uso moderado, estabilizada).

### 3.1 Cloro granulado — dicloro estabilizado (56–60% ativo)

| Item | Valor |
|---|---|
| Dose de manutenção (mercado) | 3–4 g/m³, 2–3× por semana |
| Teor ativo `A` | 0,58 |
| `q` | `d / 0,58` → **3,4 g/m³/dia** (ref) |
| Balde 10 kg | `T = 10.000 / (q × V)` → ref **`2.900 / V`** |
| Balde 25 kg | `T = 25.000 / (q × V)` → ref **`7.250 / V`** |
| Pote 2,5 kg | `T = 2.500 / (q × V)` → ref **`725 / V`** |
| Confiança | Alta |

Observação: acumula ácido cianúrico a ~0,55 g AC por grama de produto. Ver seção 5.

### 3.2 Cloro granulado — hipoclorito de cálcio (65%, não estabilizado)

| Item | Valor |
|---|---|
| Dose de manutenção | 3 g/m³, 2–3× por semana |
| Teor ativo `A` | 0,65 |
| `q` | `d / 0,65` → **3,1 g/m³/dia** (ref) |
| Balde 10 kg | ref **`3.250 / V`** |
| Confiança | Alta |

Observação: sem estabilizante embutido. Se a piscina não tiver AC próprio, aplicar coeficiente 1,8–2,5 sobre `d`. Eleva pH e dureza cálcica — aumenta consumo de ácido.

### 3.3 Cloro líquido — hipoclorito de sódio

| Item | Valor |
|---|---|
| Dose de manutenção | 15 mL/m³, 2–3× por semana |
| Concentração 10% p/v | 100 g Cl₂ por litro |
| Concentração 12% p/v | 120 g Cl₂ por litro |
| `q` (10%) | `d / 100` L/m³/dia → **20 mL/m³/dia** (ref) |
| Galão 5 L (10%) | `T = 5.000 / (q × V)` → ref **`250 / V`** |
| Bombona 20 L (10%) | ref **`1.000 / V`** |
| Bombona 50 L (10%) | ref **`2.500 / V`** |
| Ajuste para 12% | multiplicar `T` por 1,20 |
| Confiança | Alta |

**Degradação em estoque** — relevante para o modelo de recompra, porque o cliente compra em galão e o produto perde título antes de acabar:

```
A_efetivo = A_nominal × (1 − 0,02 × meses_de_estoque)
```

Perda de 1,5% a 3% do teor ativo por mês a 25–35 °C, mais rápido com exposição à luz. Acima de ~6 meses o produto pode estar 15–20% abaixo do rótulo.

### 3.4 Pastilha / multiação — tricloro 200 g (90% ativo)

| Item | Valor |
|---|---|
| Dose de rótulo | 1 pastilha por 20–30 m³, troca a cada 7–15 dias |
| Cloro ativo por pastilha | 200 g × 0,90 = **180 g Cl₂** |
| `q` | `d × V / 180` pastilhas por dia |
| Duração por pastilha | `T = 180 / (d × V)` → ref **`90 / V`** |
| Pacote 1 kg (5 un) | `T = 900 / (d × V)` → ref **`450 / V`** |
| Balde 5 kg (25 un) | ref **`2.250 / V`** |
| Balde 10 kg (50 un) | ref **`4.500 / V`** |
| Confiança | Alta para o balanço de massa; **baixa para o rótulo** |

**Discrepância importante.** A alegação de rótulo "1 pastilha por 30 m³ dura 7–15 dias" só é consistente com o balanço de massa se `d ≈ 0,40 – 0,85` — ou seja, piscina coberta, sombreada ou de uso muito baixo. Em piscina externa brasileira com sol pleno e `d = 2,0`, uma pastilha de 200 g em 30 m³ dura **3 dias**, não 7–15.

Isto é a maior fonte de erro sistemático em estimativas de mercado. Use sempre o balanço de massa (`T = 180 / (d × V)`), nunca o rótulo.

Limitações adicionais de dissolução: a taxa de liberação depende da vazão sobre a pastilha e da temperatura da água. Em flutuador com vazão baixa, a pastilha pode não conseguir entregar a demanda mesmo tendo massa disponível — nesse caso a piscina fica subclorada e o cliente compra produto complementar (granulado ou líquido). Isso gera um padrão de compra misto que vale detectar.

Acumula ácido cianúrico a ~0,54 g AC por grama de produto. Ver seção 5.

### 3.5 Gerador de cloro salino

O sal **não é consumido** pelo processo. O eletrodo converte cloreto em cloro e o cloro retorna a cloreto após oxidar. Perda de sal ocorre apenas por saída física de água líquida:

- Respingo e arraste (splash-out)
- Retrolavagem do filtro
- Drenagem / esvaziamento parcial
- Transbordo por chuva

**Evaporação não remove sal** — o sal fica na piscina e a concentração até sobe. Modelos que tratam perda de água indiscriminadamente superestimam a reposição.

| Item | Valor |
|---|---|
| Concentração alvo | 3,0 – 3,5 g/L (3.000 – 3.500 ppm) |
| Carga inicial | `kg_sal = 3,2 × V` |
| Sacos 25 kg (carga inicial) | `n = 0,128 × V` |
| Taxa de perda `r` | fração do volume removida como água líquida por dia: 0,2–0,5%/dia residencial; 0,5–1,0%/dia condomínio |
| `q` | `3,2 × r` kg/m³/dia |
| Saco 25 kg (reposição) | `T = 25 / (3,2 × V × r)` = **`7,8 / (V × r)`** → ref (r = 0,003) **`2.600 / V`** |
| Confiança | Média-alta (`r` é o parâmetro incerto) |

**Consumo real deslocado.** Piscina com gerador salino consome pouco sal mas muito de outras coisas:

- **Ácido**: o processo eleva o pH continuamente. Consumo de ácido muriático de 20–35 mL/m³/mês, acima do dobro de uma piscina convencional.
- **Célula de titânio**: vida útil de 5.000–10.000 horas de operação → substituição a cada 3–7 anos. Item de alto valor, vale modelar como evento separado.
- **Estabilizante**: geradores exigem AC entre 60–80 ppm (acima do convencional) para proteger o cloro gerado do UV.

### 3.6 Bromo (BCDMH, pastilha 20 g, ~61% halogênio disponível)

| Item | Valor |
|---|---|
| Dose de manutenção | 1 pastilha por 2–4 m³ no dosador, reposição semanal |
| Residual alvo | 3–6 ppm |
| Halogênio por pastilha | 20 g × 0,61 = **12,2 g** |
| Equivalência de massa | `d_Br ≈ 2,25 × d_Cl₂` (bromo é mais pesado; precisa de mais massa para o mesmo poder oxidante) |
| `q` | `d_Br × V / 12,2` pastilhas por dia |
| Balde 5 kg (250 un, 3.050 g halogênio) | `T = 3.050 / (d_Br × V)` |
| — spa ou piscina coberta (`d_Br ≈ 2,5`) | **`1.220 / V`** |
| — externa sol pleno (`d_Br ≈ 7`) | **`435 / V`** |
| Confiança | Média |

**Bromo não é estabilizável sob UV.** Nenhum estabilizante funciona com bromo. Em piscina externa no Brasil o consumo dispara e o custo por m³ fica proibitivo. Na prática o bromo no mercado brasileiro é usado em:

- Spas e banheiras de hidromassagem
- Piscinas cobertas ou internas
- Piscinas aquecidas (bromo é mais estável em temperatura alta e pH alto que o cloro)

Se o seu sistema encontrar um cliente com piscina externa tratada a bromo, o consumo será muito acima do que qualquer tabela de rótulo sugere.

### 3.7 Peróxido de hidrogênio / "oxigênio ativo" (H₂O₂ 50%)

| Item | Valor |
|---|---|
| Dose de manutenção | 50–100 mL/m³ a cada 7–15 dias |
| `q` (ref) | **7,5 mL/m³/dia** |
| Bombona 20 L | `T = 20.000 / (q × V)` → ref **`2.670 / V`** |
| Frasco 1 L | ref **`133 / V`** |
| Confiança | Média |

Não deixa residual protetor — a água fica desprotegida entre aplicações, o que torna a aderência ao intervalo crítica e o consumo real sensível a atraso do cliente. Decompõe em estoque (2–5%/mês, acelerado por calor e contaminação). Incompatível com cloro: se o cliente migrar, há uma semana de transição.

Custo por m³ tratado é tipicamente 2–3× o do cloro. Nicho: usuários com sensibilidade a cloro.

### 3.8 Biguanida polimérica (PHMB 20%)

| Item | Valor |
|---|---|
| Concentração alvo | 30–50 ppm de produto (6–10 ppm de PHMB ativo) |
| Reposição | ~3–5 mL/m³ a cada 15 dias |
| `q` (ref) | ~0,30 mL/m³/dia |
| Galão 5 L | `T ≈ 16.700 / V` |
| Confiança | **Baixa** |

Marcar como baixa confiança: produto de nicho, distribuição limitada no Brasil, dados de rótulo escassos e inconsistentes entre fabricantes. Se aparecer na base, tratar `q` como parâmetro a ser aprendido do histórico, não estimado.

Exige oxidante complementar (H₂O₂) mensal e algicida compatível. Estável a UV, temperatura e variação de pH — daí a duração longa. Incompatível com cloro. Custo por m³ muito alto.

### 3.9 Algicida de manutenção

| Item | Valor |
|---|---|
| Dose | 4–5 mL/m³ por semana |
| `q` | **0,64 mL/m³/dia** |
| Frasco 1 L | **`1.560 / V`** |
| Galão 5 L | **`7.800 / V`** |
| Confiança | Alta |

Variação: chuva, temperatura, fosfatos na água de reposição, qualidade da filtragem. Piscinas com histórico de alga verde consomem 1,5–2× mais.

### 3.10 Clarificante

| Item | Valor |
|---|---|
| Dose de manutenção | 1,5 mL/m³ por semana |
| Dose de correção (água turva) | 3–6 mL/m³ |
| `q` (manutenção) | **0,21 mL/m³/dia** |
| Frasco 1 L | **`4.670 / V`** |
| Galão 5 L | **`23.300 / V`** |
| Confiança | Alta |

### 3.11 Decantador (sulfato de alumínio)

| Item | Valor |
|---|---|
| Dose | 30 g/m³ (uso pontual, não recorrente) |
| Modelo | Evento, não consumo contínuo |
| Confiança | Alta |

Não modelar como recorrente. Disparar como evento associado a água turva, pós-chuva forte ou pós-tratamento de alga.

### 3.12 Corretores de pH

**Barrilha leve (carbonato de sódio) — elevar pH.** Relevante com tricloro/dicloro, que são ácidos.

| Item | Valor |
|---|---|
| Consumo típico | 8–15 g/m³/mês |
| `q` | **0,40 g/m³/dia** |
| Saco 5 kg | **`12.500 / V`** |
| Saco 25 kg | **`62.500 / V`** |
| Confiança | Média |

**Ácido muriático (20 °Bé) ou bissulfato de sódio — baixar pH.** Relevante com hipoclorito de cálcio/sódio e com gerador salino.

| Item | Valor |
|---|---|
| Consumo típico | 15–25 mL/m³/mês (convencional); 20–35 mL/m³/mês (gerador salino) |
| `q` | **0,65 mL/m³/dia** (convencional); **0,90** (salino) |
| Galão 5 L | **`7.700 / V`** (convencional); **`5.550 / V`** (salino) |
| Confiança | Média |

O sinal de qual corretor o cliente compra é um bom classificador do tipo de tratamento, se o dado de tratamento estiver ausente ou desatualizado no cadastro.

### 3.13 Estabilizante (ácido cianúrico)

| Item | Valor |
|---|---|
| Carga inicial | 30–50 g/m³ (usar 40) |
| Carga em kg | `0,04 × V` |
| Reposição | Só por diluição: `40 g × m³ de água reposta` |
| Reposição anual típica | 25–40% da carga inicial |
| Confiança | Alta |

**Não recomendar a clientes em tricloro ou dicloro** — esses produtos já trazem AC embutido e o problema é o oposto (acúmulo). Ver seção 5.

---

## 4. Tabela de embalagens padrão do mercado brasileiro

| Produto | Embalagens comuns |
|---|---|
| Cloro granulado (dicloro / hipoclorito de cálcio / múltipla ação) | 1 kg, 2,5 kg, 5 kg, 10 kg, 25 kg |
| Cloro líquido (hipoclorito de sódio) | 5 L, 20 L, 50 L |
| Pastilha tricloro 200 g | avulsa, 1 kg (5 un), 3 kg, 5 kg, 10 kg |
| Sal para gerador | 25 kg |
| Algicida | 1 L, 5 L |
| Clarificante | 1 L, 5 L |
| Barrilha leve | 1 kg, 5 kg, 25 kg |
| Ácido muriático | 1 L, 5 L |
| Estabilizante | 1 kg, 5 kg |
| Peróxido de hidrogênio 50% | 20 L, 35 kg |

---

## 5. Acumulação de ácido cianúrico — evento de compra oculto

Tricloro e dicloro liberam ácido cianúrico junto com o cloro. O AC não é consumido nem evapora; só sai por diluição.

| Produto | g de AC por g de produto |
|---|---|
| Tricloro (TCCA) | 0,54 |
| Dicloro di-hidratado | 0,57 |

Taxa de acumulação:

```
ΔAC_ppm_por_dia = q_g_por_m³_por_dia × 0,55
```

Dias até o limite operacional:

```
T_limite_AC = (AC_max − AC_atual) / (0,55 × q)
```

Usar `AC_max = 100 ppm` (acima disso o cloro fica "travado" e perde eficácia; algumas normas usam 75 ppm).

**Exemplo.** Dicloro a `q = 3,4 g/m³/dia` → `ΔAC = 1,87 ppm/dia` → **56 ppm/mês**. Partindo de AC zerado, o limite de 100 ppm é atingido em ~53 dias de uso contínuo.

Na prática, a maioria dos granulados "múltipla ação" brasileiros são blendas de dicloro com hipoclorito de cálcio e inertes, então a taxa real é menor que a do dicloro puro — mas a dinâmica é real e explica por que piscinas brasileiras em tratamento granulado exigem renovação parcial de água periodicamente.

**Por que isso importa para o seu sistema:** o esgotamento de AC dispara um conjunto de compras que a fórmula de duração não prevê — drenagem parcial, recarga de cloro, e frequentemente reposição de estabilizante e correção de pH. É um pico de faturamento previsível.

---

## 6. Pseudocódigo de implementação

```python
# Constantes por produto
PRODUTOS = {
    "dicloro_granulado":   {"A": 0.58, "unidade": "g",  "cya_ratio": 0.57},
    "hipoclorito_calcio":  {"A": 0.65, "unidade": "g",  "cya_ratio": 0.0},
    "cloro_liquido_10":    {"A": 100,  "unidade": "mL_por_L_ativo", "cya_ratio": 0.0},
    "pastilha_tricloro":   {"A": 0.90, "unidade": "g",  "cya_ratio": 0.54},
}

D_BASE_VERAO = 2.0   # g Cl2 / m3 / dia

COEF = {
    "capa_termica": 0.50,
    "sombreado": 0.70,
    "sem_estabilizante": 2.15,
    "aquecida": 1.30,
    "inverno": 0.45,
    "meia_estacao": 0.70,
    "verao": 1.00,
    "chuva": 1.18,
    "ozonio_uv": 0.60,
    "filtragem_ruim": 2.00,
}

G_CL2_POR_BANHISTA = 4.0

def demanda_diaria(volume_m3, fatores, banhistas_dia=0, d_calibrado=None):
    """Retorna d em g Cl2 / m3 / dia."""
    if d_calibrado is not None:
        d = d_calibrado                       # parâmetro aprendido: sempre preferir
    else:
        d = D_BASE_VERAO
        for f in fatores:
            d *= COEF[f]
    # carga de banhistas SOMA, não multiplica
    d += (banhistas_dia * G_CL2_POR_BANHISTA) / volume_m3
    return d

def dias_ate_recompra(produto, qtd_embalagem, volume_m3, d):
    """qtd_embalagem em g para sólidos, mL para líquidos."""
    p = PRODUTOS[produto]
    if p["unidade"] == "mL_por_L_ativo":
        q = (d / p["A"]) * 1000        # mL de produto por m3 por dia
    else:
        q = d / p["A"]                 # g de produto por m3 por dia
    return qtd_embalagem / (q * volume_m3)

def dias_ate_limite_cya(produto, volume_m3, d, cya_atual, cya_max=100):
    p = PRODUTOS[produto]
    if p["cya_ratio"] == 0:
        return None                    # não acumula
    q = d / p["A"]
    delta_por_dia = q * p["cya_ratio"]
    if delta_por_dia <= 0:
        return None
    return (cya_max - cya_atual) / delta_por_dia

def calibrar_d(produto, qtd_embalagem, volume_m3, dias_observados):
    """Inverte a fórmula a partir de um ciclo de recompra real.
    Rodar após 2-3 ciclos e usar a mediana."""
    p = PRODUTOS[produto]
    if p["unidade"] == "mL_por_L_ativo":
        q = qtd_embalagem / (dias_observados * volume_m3)
        return q * p["A"] / 1000
    q = qtd_embalagem / (dias_observados * volume_m3)
    return q * p["A"]

def proxima_compra(cliente):
    """Retorna a data do próximo gatilho — o menor entre todos."""
    d = demanda_diaria(cliente.volume, cliente.fatores,
                       cliente.banhistas_dia, cliente.d_calibrado)
    gatilhos = []
    for item in cliente.produtos_ativos:
        gatilhos.append(dias_ate_recompra(item.produto, item.qtd,
                                          cliente.volume, d))
    t_cya = dias_ate_limite_cya(cliente.sanitizante, cliente.volume,
                                d, cliente.cya_atual)
    if t_cya is not None:
        gatilhos.append(t_cya)
    return min(gatilhos)
```

---

## 7. Erro esperado e estratégia de calibração

| Situação | Erro esperado em `T` |
|---|---|
| Cliente novo, só volume e tipo de tratamento conhecidos | **±35 a 50%** |
| Cliente novo, com dados de exposição solar, capa e uso | ±25 a 35% |
| Após 2–3 ciclos de recompra observados (`d` calibrado) | **±15 a 20%** |
| Com leitura de residual de cloro do cliente | ±10 a 15% |

**Recomendação central: trate `d` como parâmetro aprendido por cliente, não como constante de tabela.** Os valores desta referência servem como *prior* para clientes sem histórico. Assim que houver 2 ciclos de recompra, inverta a fórmula:

```
d = (Q_embalagem × A) / (T_observado × V)
```

e use a mediana dos ciclos observados. Isso absorve automaticamente todos os fatores locais que a tabela não consegue capturar — orientação da piscina, vegetação ao redor, hábito real do cliente, qualidade do equipamento, rigor da filtragem.

### 7.1 Fontes de erro em ordem de impacto

1. **Demanda `d` não calibrada** — sozinha responde pela maior parte do erro. Fator de até 12× entre extremos.
2. **Carga de banhistas em condomínio** — subestimada por qualquer modelo puramente volumétrico. Piscina de condomínio pode consumir 2–4× uma residencial do mesmo volume.
3. **Alegações de rótulo de pastilha** — erro sistemático de 2–5× para piscina externa. Sempre usar balanço de massa.
4. **Cobertura/capa térmica** — reduz o consumo pela metade. Dado binário de altíssimo valor preditivo; vale coletar no cadastro.
5. **Sazonalidade** — variação de 2,2× entre verão e inverno. Modelar por mês, não por média anual.
6. **Estabilizante presente ou ausente** — fator de 2× e frequentemente não cadastrado.
7. **Degradação em estoque (cloro líquido e peróxido)** — o cliente compra antes do previsto porque o produto perdeu título, não porque a piscina consumiu mais.
8. **Chuva** — efeito duplo: carga orgânica sobe e transbordo dilui AC e sal. Em região de chuva concentrada, modelar por evento.

### 7.2 Campos de cadastro com melhor retorno preditivo

Em ordem de valor por esforço de coleta:

1. Volume (m³) — obrigatório
2. Tipo de tratamento — obrigatório
3. Tem capa/cobertura? (sim/não)
4. Exposição solar (pleno / parcial / coberta)
5. Residencial ou condomínio; se condomínio, nº aproximado de banhistas/dia no verão
6. Aquecida? (sim/não)
7. Histórico de recompra — o mais valioso de todos, mas só disponível depois

---

## 8. Fontes

- [Genco — Cloro Granulado Múltipla Ação 3 em 1](https://www.genco.com.br/genco-le/)
- [Genco — GENCLOR Cloro Granulado Estabilizado](https://www.genco.com.br/genclor/)
- [Genco — Algicida de Manutenção](https://www.genco.com.br/algicida-de-manutencao/)
- [Blog HTH — Qual a quantidade de cloro na piscina](https://blog.hth.com.br/qual-a-quantidade-de-cloro-na-piscina/)
- [Torres Química — Tabela de dosagem de cloro para piscina](https://torresquimica.com.br/tabela-dosagem-cloro-piscina)
- [QBEX Química — Quanto de cloro colocar na piscina, tabela por litragem](https://qbexquimica.com.br/quanto-de-cloro-colocar-na-piscina-tabela-por-litragem/)
- [Start Piscinas — Como calcular a dosagem de cloro (guia com fórmula)](https://startpiscinas.com.br/dosagem-de-cloro-piscina-como-calcular/)
- [Cris Água — Pastilha Tricloro 90%](https://crisagua.ind.br/catalogo/pastilha-tricloro-90/)
- [Pace — Tablete Tripla Ação 200 g](https://www.cialimp.com/piscina/tratamento/cloro/tablete-pastilha-tripla-acao-pace-200-gr)
- [Sol e Água — Quantidade de sal necessária para o gerador de cloro](https://www.blog.soleagua.com.br/post/quantidade-de-sal-necess%C3%A1ria-para-o-gerador-de-cloro-de-piscina-aprenda-a-calcular)
- [Nautilus — Sal para piscina](https://nautilusbr.com/blog/sal-para-piscina/)
- [Hidroall — Algicida de manutenção 5 L](https://www.hidroall.com.br/produto/algicida-de-manutencao-5l)
- [Ultraclor — UltraDecantador](https://www.ultraclor.com.br/ultradecantador)
- [PoolPiscina — Alternativas ao cloro para piscina, comparativo](https://poolpiscina.com/alternativas-ao-cloro-para-piscina-comparativo-completo)
- [Vip Água Piscinas — Tratamento com peróxido de hidrogênio](https://vipaguapiscinas.com.br/tratamento-de-piscina-com-peroxido-de-hidrogenio/)
- [Pool Rescue — Cloro para piscina: como usar, dosagem ideal e cuidados](https://poolrescue.com.br/cloro-para-piscina-como-usar-e-cuidados/)
- [Hidráulicart — Bromo em pastilhas](https://www.hidraulicart.pt/loja-online/cloro-desinfecao/bromo-em-pastilhas/)
