# -*- coding: utf-8 -*-
"""Quanto do funil "em aberto" e dinheiro distinto, e quanto e a mesma venda
contada mais de uma vez (opcoes concorrentes do mesmo equipamento, ou
duplicata literal). Leitura pura, so leitura no banco.

Como rodar:
1. Exportar os dados de entrada (via sql_v1.py/q.py contra o projeto v1):
   select numero, coalesce(loja_id,'?') loja, trim(cliente) cliente, status,
     total, to_char(data_criacao,'YYYY-MM-DD') criado, servicos::text servicos
   from orcamentos where status in ('pendente','vencido')
     and coalesce(trim(cliente),'')<>'' order by loja, cliente, numero;
   -> salvar em funil_aberto_full.json (mesma pasta deste script)

   select trim(cliente) cliente from orcamentos
    where status='aprovado' and loja_id='fortemp-camboriu'
      and coalesce(trim(cliente),'')<>'';
   -> salvar em aprovados_camb.json

2. python3 docs/funil_real.py
"""
import json, re, unicodedata
from collections import defaultdict
from datetime import date

def strip_ac(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn')

def norm(s):
    s = strip_ac((s or '').lower())
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

TIPO = {'condominio','cond','residencial','resid','edificio','edif','ed','predio','bloco',
        'torre','tower','towers','residence','residenza','residenziale','ltda','me','eireli','sa'}
def cli_core(s):
    return ' '.join(t for t in norm(s).split() if t not in TIPO)

CATS = [
    ('trocador', re.compile(r'trocador')),  # 'trocadores' já bate por substring
    ('gerador_cloro', re.compile(r'gerador(?:es)? de cloro')),
    ('gerador_vapor_calor', re.compile(r'gerador(?:es)? de (vapor|calor)|sauna')),
    ('motobomba', re.compile(r'motobomba|bomba')),
    ('filtro_areia', re.compile(r'filtros? de areia|filtro v ?\d')),
    ('capa_termica', re.compile(r'capa t[ée]rmica')),
    ('led_iluminacao', re.compile(r'\bleds?\b')),
    ('manutencao_servico', re.compile(r'manuten[cç][aã]o|reparo|instala[cç][aã]o|m[aã]o de obra')),
]
def categoria(desc):
    n = norm(desc)
    for nome, rx in CATS:
        if rx.search(n): return nome
    return 'outros'

def itens(o):
    try:
        s = json.loads(o['servicos']) if isinstance(o['servicos'], str) else o['servicos']
    except Exception:
        return []
    return s if isinstance(s, list) else []

PRIORIDADE = [c for c, _ in CATS]  # trocador primeiro: é o item que define do que se trata a proposta
def categoria_dominante(o):
    """Maior preço não serve de critério aqui: no formato "escopo fechado" todo
    item vem com preco=0 e o valor todo fica numa linha de fechamento
    ("Investimento total:"), que não bate com nenhuma categoria de equipamento
    e cairia em "outros" — escondendo dois trocadores diferentes um do outro.
    Em vez disso, varre todos os itens e usa a categoria de equipamento mais
    específica encontrada, na ordem de prioridade de CATS."""
    its = itens(o)
    presentes = {categoria(it.get('desc', '')) for it in its}
    for c in PRIORIDADE:
        if c in presentes: return c
    return 'outros'

def dias(a, b):
    ya, ma, da_ = map(int, a.split('-')); yb, mb, db_ = map(int, b.split('-'))
    return abs((date(ya, ma, da_) - date(yb, mb, db_)).days)

orcs = json.load(open('funil_aberto_full.json'))
for o in orcs:
    o['cliente_norm'] = cli_core(o['cliente'])
    o['categoria'] = categoria_dominante(o)
    o['itens_desc'] = ' | '.join(norm(it.get('desc','')) for it in itens(o))

por_cliente = defaultdict(list)
for o in orcs:
    if o['cliente_norm']:
        por_cliente[(o['loja'], o['cliente_norm'])].append(o)

alternativas = []   # clusters onde só um deveria contar
duplicata_literal = []
aditivos = []        # clientes com 2+ orcs mas de categorias/datas que nao competem
usados_em_cluster = set()

JANELA_DIAS = 10

for (loja, cli), lista in por_cliente.items():
    if len(lista) < 2: continue
    lista = sorted(lista, key=lambda o: o['criado'])
    # agrupa por categoria dominante
    por_cat = defaultdict(list)
    for o in lista: por_cat[o['categoria']].append(o)
    for cat, grupo in por_cat.items():
        if len(grupo) < 2: continue
        grupo = sorted(grupo, key=lambda o: o['criado'])
        # clusteriza por proximidade de data (janela deslizante)
        cluster = [grupo[0]]
        for o in grupo[1:]:
            if dias(cluster[-1]['criado'], o['criado']) <= JANELA_DIAS:
                cluster.append(o)
            else:
                if len(cluster) > 1:
                    alternativas.append((loja, cli, cat, cluster))
                    usados_em_cluster.update(x['numero'] for x in cluster)
                cluster = [o]
        if len(cluster) > 1:
            alternativas.append((loja, cli, cat, cluster))
            usados_em_cluster.update(x['numero'] for x in cluster)

# duplicata literal: dentro de um cluster de alternativas, mesma descricao normalizada + mesmo total
for loja, cli, cat, cluster in alternativas:
    by_key = defaultdict(list)
    for o in cluster:
        by_key[(o['itens_desc'], round(float(o['total']),2))].append(o)
    for k, dups in by_key.items():
        if len(dups) > 1:
            duplicata_literal.append((loja, cli, cat, dups))

print('=== clusters de ALTERNATIVAS (mesmo cliente, mesma categoria, ate %dd de distancia) ===' % JANELA_DIAS)
val_nominal_cluster = 0.0
val_maior_por_cluster = 0.0
for loja, cli, cat, cluster in sorted(alternativas, key=lambda x: -sum(float(o['total']) for o in x[3])):
    vals = [float(o['total']) for o in cluster]
    val_nominal_cluster += sum(vals)
    val_maior_por_cluster += max(vals)
    print('  %-18s %-28s %-14s %2dx  nominal R$%10.2f  maior R$%10.2f  numeros=%s' % (
        loja[:18], cli[:28], cat, len(cluster), sum(vals), max(vals),
        ','.join('#'+str(o['numero']) for o in cluster)))

print()
print('clusters de alternativas: %d | orcamentos envolvidos: %d' % (len(alternativas), len(usados_em_cluster)))
print('valor nominal desses orcamentos : R$ %.2f' % val_nominal_cluster)
print('valor se contar só a maior opção: R$ %.2f' % val_maior_por_cluster)
print('diferença (dinheiro contado a mais no funil): R$ %.2f' % (val_nominal_cluster - val_maior_por_cluster))
print()
print('=== duplicatas LITERAIS (mesma descrição, mesmo valor, dentro do cluster) ===')
for loja, cli, cat, dups in duplicata_literal:
    print('  %-18s %-28s R$%9.2f cada  numeros=%s' % (loja[:18], cli[:28], float(dups[0]['total']),
          ','.join('#'+str(o['numero']) for o in dups)))

total_aberto = sum(float(o['total']) for o in orcs)
total_camb = sum(float(o['total']) for o in orcs if o['loja']=='fortemp-camboriu')
val_maior_camb = sum(max(float(o['total']) for o in c) for l,ci,ca,c in alternativas if l=='fortemp-camboriu')
val_nominal_camb = sum(sum(float(o['total']) for o in c) for l,ci,ca,c in alternativas if l=='fortemp-camboriu')
print()
print('=== resumo Camboriú ===')
print('total em aberto (nominal, todos os 147 orçamentos): R$ %.2f' % total_camb)
print('dentro de clusters de alternativas                 : R$ %.2f' % val_nominal_camb)
print('funil corrigido (só a maior opção por cluster)      : R$ %.2f' % (total_camb - val_nominal_camb + val_maior_camb))
print('redução                                             : R$ %.2f (%.1f%%)' % (
    val_nominal_camb - val_maior_camb, 100*(val_nominal_camb-val_maior_camb)/total_camb))

# ── Cliente que já comprou × lead frio, dentro do em-aberto de Camboriú ──
try:
    aprov = json.load(open('aprovados_camb.json'))
    ja_comprou = {cli_core(x['cliente']) for x in aprov if cli_core(x['cliente'])}
    camb = [o for o in orcs if o['loja'] == 'fortemp-camboriu']
    ja = [o for o in camb if o['cliente_norm'] in ja_comprou]
    novo = [o for o in camb if o['cliente_norm'] not in ja_comprou]
    print()
    print('=== upsell × lead frio (Camboriú) ===')
    print('já aprovou algo antes: %3d orçamentos, R$ %.2f' % (len(ja), sum(float(o['total']) for o in ja)))
    print('nunca comprou        : %3d orçamentos, R$ %.2f' % (len(novo), sum(float(o['total']) for o in novo)))
except FileNotFoundError:
    print('\n(aprovados_camb.json não encontrado — pulei a seção upsell × lead frio)')
