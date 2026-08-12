#!/usr/bin/env python3
"""Regenera docs/mapa-app-js.md a partir do proprio app.js.
Rode depois de mexer bastante — os numeros de linha mudam a cada commit.
   python3 docs/gerar-mapa.py
"""
import re, os
W=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
s=open(os.path.join(W,'app.js'),encoding='utf-8').read()
linhas=s.split('\n')
secoes=[]
for i,l in enumerate(linhas):
    m=re.match(r'^//\s*[═─=-]{0,3}\s*([A-ZÀ-Ú][A-ZÀ-Ú0-9 ,./()+&—\-]{6,})\s*[═─=-]*\s*$', l.strip())
    if m:
        t=m.group(1).strip(' —-=─═')
        if len(t)>6: secoes.append((i+1,t))
funcs=[(s[:m.start()].count('\n')+1, m.group(1))
       for m in re.finditer(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', s, re.M)]
cab=open(os.path.join(W,'docs','mapa-app-js.md'),encoding='utf-8').read().split('## Seções')[0]
rod='## Onde mexer'+open(os.path.join(W,'docs','mapa-app-js.md'),encoding='utf-8').read().split('## Onde mexer')[1]
corpo='## Seções\n\n'
for idx,(ln,t) in enumerate(secoes):
    fim=secoes[idx+1][0] if idx+1<len(secoes) else len(linhas)
    n=len([1 for l,_ in funcs if ln<=l<fim])
    corpo+='- **l.%s — %s** · %d funções\n'%(ln,t.title(),n)
cab=re.sub(r'\*\*\d+ linhas\*\*','**%d linhas**'%len(linhas),cab)
cab=re.sub(r'\*\*\d+ funções\*\*','**%d funções**'%len(funcs),cab)
open(os.path.join(W,'docs','mapa-app-js.md'),'w',encoding='utf-8').write(cab+corpo+'\n'+rod)
print('mapa regenerado: %d secoes, %d funcoes, %d linhas'%(len(secoes),len(funcs),len(linhas)))
