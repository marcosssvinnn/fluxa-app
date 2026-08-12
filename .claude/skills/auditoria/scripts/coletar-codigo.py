#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coletor 1 — CODIGO. Deterministico: so conta o que esta escrito.
Nao opina, nao infere. A IA le a saida disto, nao o app.js inteiro.
"""
import re, json, sys, collections, os

BASE = sys.argv[1] if len(sys.argv) > 1 else '.'
APP  = os.path.join(BASE, 'app.js')
HTML = os.path.join(BASE, 'index.html')
app  = open(APP,  encoding='utf-8').read()
html = open(HTML, encoding='utf-8').read() if os.path.exists(HTML) else ''
linhas_app = app.split('\n')

# ── 1. Declaracoes de funcao (com linha) ─────────────────────────────
decl = []
for m in re.finditer(r'^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)', app, re.M):
    decl.append((m.group(1), app[:m.start()].count('\n') + 1))
nomes = [d[0] for d in decl]
cont  = collections.Counter(nomes)

# ── 2. DUPLICADAS ────────────────────────────────────────────────────
duplicadas = {}
for n, c in cont.items():
    if c > 1:
        duplicadas[n] = [l for (nm, l) in decl if nm == n]

# ── 3. MORTAS ────────────────────────────────────────────────────────
def refs(nome, texto, ignorar_decl=False):
    p = re.compile(r'(?<![\w$.])' + re.escape(nome) + r'(?![\w$])')
    n = len(p.findall(texto))
    if ignorar_decl:
        n -= len(re.findall(r'(?:async[ \t]+)?function[ \t]+' + re.escape(nome) + r'(?![\w$])', texto))
    return n

mortas = []
for n in sorted(set(nomes)):
    if refs(n, app, ignorar_decl=True) == 0 and refs(n, html) == 0:
        mortas.append({'nome': n, 'linha': [l for (nm, l) in decl if nm == n][0]})

# ── 4. Chamadas SO pelo HTML (nao apagar!) ───────────────────────────
so_html = [n for n in sorted(set(nomes))
           if refs(n, app, ignorar_decl=True) == 0 and refs(n, html) > 0]

# ── 5. onclick apontando para funcao inexistente ─────────────────────
chamadas_html = set(re.findall(r'\bon\w+\s*=\s*["\']\s*([A-Za-z_$][\w$]*)\s*\(', html))
fantasmas = sorted(c for c in chamadas_html if c not in set(nomes)
                   and not re.search(r'(?:const|let|var)[ \t]+' + re.escape(c) + r'[ \t]*=', app))

# ── 6. Globais de topo ───────────────────────────────────────────────
globais = re.findall(r'^(?:let|var|const)[ \t]+([A-Za-z_$][\w$]*)', app, re.M)

# ── 7. Funcoes gigantes ──────────────────────────────────────────────
tamanhos = []
for nome, ln in decl:
    ini = ln - 1
    try:
        j = linhas_app[ini].index('{')
    except ValueError:
        continue
    d, k, col, fim = 0, ini, j, None
    while k < len(linhas_app):
        linha = linhas_app[k]
        for ci in range(col, len(linha)):
            if linha[ci] == '{': d += 1
            elif linha[ci] == '}':
                d -= 1
                if d == 0: fim = k; break
        if fim is not None: break
        k += 1; col = 0
    if fim: tamanhos.append({'nome': nome, 'linha': ln, 'linhas': fim - ini + 1})
tamanhos.sort(key=lambda x: -x['linhas'])

# ── 8. Silenciamento de erro ─────────────────────────────────────────
catch_vazio = [{'linha': app[:m.start()].count('\n')+1, 'trecho': m.group(0)[:70]}
               for m in re.finditer(r'catch\s*\([^)]*\)\s*\{\s*\}', app)]
catch_mudo  = [{'linha': app[:m.start()].count('\n')+1}
               for m in re.finditer(r'\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)', app)]

out = {
  'arquivo': {'app_js_linhas': len(linhas_app), 'index_html_linhas': html.count('\n')+1},
  'funcoes': {'declaradas': len(decl), 'distintas': len(set(nomes))},
  'duplicadas': duplicadas,
  'mortas': mortas,
  'chamadas_so_pelo_html': so_html,
  'onclick_sem_funcao': fantasmas,
  'globais_topo': {'total': len(globais), 'nomes': sorted(set(globais))},
  'maiores_funcoes': tamanhos[:20],
  'erros_silenciados': {'catch_vazio': catch_vazio, 'catch_mudo': catch_mudo},
}
print(json.dumps(out, ensure_ascii=False, indent=2))
