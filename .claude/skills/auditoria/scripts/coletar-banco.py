#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coletor 2 — BANCO. Diff DUAS VIAS entre o que o codigo grava e o que o schema tem.
E a versao automatizada da "REGRA DE OURO" do CLAUDE.md: coluna que o codigo
grava e o banco nao tem faz o registro parar de sincronizar em silencio.
"""
import re, json, sys, os, collections

BASE = sys.argv[1] if len(sys.argv) > 1 else '.'
app  = open(os.path.join(BASE, 'app.js'), encoding='utf-8').read()

sql = ''
for f in sorted(os.listdir(BASE)):
    if f.endswith('.sql'):
        sql += '\n' + open(os.path.join(BASE, f), encoding='utf-8').read()

# ── Schema declarado ─────────────────────────────────────────────────
tabelas = {}
for m in re.finditer(r'create table (?:if not exists )?(\w+)\s*\((.*?)\n\)\s*;', sql, re.S | re.I):
    nome, corpo = m.group(1), m.group(2)
    cols = set()
    corpo_l = re.sub(r'--[^\n]*', '', corpo)
    partes, d, buf = [], 0, ''
    for ch in corpo_l:
        if ch == '(': d += 1
        elif ch == ')': d -= 1
        if ch == ',' and d == 0:
            partes.append(buf); buf = ''
        else:
            buf += ch
    partes.append(buf)
    for p in partes:
        p = p.strip()
        if not p: continue
        c = re.match(r'([a-z_][a-z0-9_]*)\s+', p, re.I)
        if c and c.group(1).lower() not in ('primary', 'unique', 'constraint', 'foreign', 'check'):
            cols.add(c.group(1))
    tabelas.setdefault(nome, set()).update(cols)

for m in re.finditer(r'alter table (?:public\.)?(\w+)\s+add column (?:if not exists )?(\w+)', sql, re.I):
    tabelas.setdefault(m.group(1), set()).add(m.group(2))

# ── Tabelas citadas no codigo ────────────────────────────────────────
usadas = collections.Counter()
for m in re.finditer(r"""db\.from\(\s*['"](\w+)['"]""", app):                    usadas[m.group(1)] += 1
for m in re.finditer(r"""db(?:Insert|Update|Upsert)\(\s*['"](\w+)['"]""", app):  usadas[m.group(1)] += 1

# ── Payloads literais: chaves gravadas por tabela ────────────────────
grava = collections.defaultdict(set)

def chaves_do_objeto(texto, inicio):
    i = texto.index('{', inicio); d = 0; j = i
    while j < len(texto):
        if texto[j] == '{': d += 1
        elif texto[j] == '}':
            d -= 1
            if d == 0: break
        j += 1
    return re.finditer(r'(?:^|[{,])\s*([a-z_][a-z0-9_]*)\s*:', texto[i:j+1], re.I)

for m in re.finditer(r"""db(?:Insert|Update|Upsert)\(\s*['"](\w+)['"]\s*,\s*\{""", app):
    for k in chaves_do_objeto(app, m.end()-1): grava[m.group(1)].add(k.group(1))

for m in re.finditer(r"""db\.from\(\s*['"](\w+)['"]\)\s*\.\s*(?:insert|update|upsert)\(\s*\[?\s*\{""", app):
    for k in chaves_do_objeto(app, m.end()-1): grava[m.group(1)].add(k.group(1))

colunas_fantasma = {}
for tab, cols in grava.items():
    if tab in tabelas:
        falta = sorted(c for c in cols if c not in tabelas[tab])
        if falta: colunas_fantasma[tab] = falta

# ── Regra do CLAUDE.md: proibido db.from().insert/update/upsert cru ──
cru = [{'linha': app[:m.start()].count('\n')+1, 'tabela': m.group(1), 'op': m.group(2)}
       for m in re.finditer(r"""db\.from\(\s*['"](\w+)['"]\)\s*\.\s*(insert|update|upsert|delete)\(""", app)]

out = {
  'schema': {'tabelas': len(tabelas), 'colunas': sum(len(v) for v in tabelas.values())},
  'tabelas_no_codigo_sem_schema': sorted(t for t in usadas if t not in tabelas),
  'tabelas_no_schema_sem_uso':    sorted(t for t in tabelas if t not in usadas),
  'colunas_gravadas_sem_schema':  colunas_fantasma,
  'escrita_crua_fora_do_wrapper': [c for c in cru if c['op'] != 'delete'],
  'delete_cru_ok': len([c for c in cru if c['op'] == 'delete']),
  'tabelas_mais_usadas': usadas.most_common(12),
}
print(json.dumps(out, ensure_ascii=False, indent=2))
