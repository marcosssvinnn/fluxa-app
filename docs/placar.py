import json,sys
sys.path.insert(0,'/private/tmp/claude-501/-Users-marcosvinicius-Documents-fluxa/e69f2248-6361-48f7-a1e5-3bda1cb10d52/scratchpad')
from sql_v1 import run
def q(sql):
    r=run(sql)
    return r[0] if isinstance(r,list) and r else r

print("PLACAR — metricas que o roadmap pede (secao 'Como saber se funcionou')\n")
a=q("""select count(*) as linhas, count(*) filter (where s->>'produto_id' is not null) as com_id
from orcamentos o, jsonb_array_elements(case when jsonb_typeof(o.servicos)='array' then o.servicos else '[]'::jsonb end) s""")
print("  cobertura de produto_id .......... %.1f%%  (%s de %s linhas)   meta 80%%" %
      (100*a['com_id']/a['linhas'] if a['linhas'] else 0, a['com_id'], a['linhas']))
for t,rot,meta in [('despesas','registros em despesas','despesa fixa do mes'),
                   ('equipamentos','registros em equipamentos','base instalada'),
                   ('recebimentos','parcelas em recebimentos','a partir de agora')]:
    n=q("select count(*) as n from %s"%t)['n']
    print("  %-32s %-6s  meta: %s" % (rot+' '+'.'*(30-len(rot)), n, meta))
b=q("""select
 count(*) filter (where loja_id='fortemp-camboriu') as camb,
 count(*) filter (where loja_id='fortemp-camboriu' and coalesce(valor_recebido,0)>0) as camb_ok,
 count(*) filter (where loja_id='fortemp-itapema') as itap,
 count(*) filter (where loja_id='fortemp-itapema' and coalesce(valor_recebido,0)>0) as itap_ok
from orcamentos where status='aprovado'""")
print("  recebimento registrado ........... Camboriu %.0f%% · Itapema %.0f%%   meta 90%%+" %
      (100*b['camb_ok']/b['camb'] if b['camb'] else 0, 100*b['itap_ok']/b['itap'] if b['itap'] else 0))
c=q("select count(*) as t, count(cliente_id) as com from orcamentos")
print("  orcamentos com cliente_id ........ %.0f%%  (%s de %s)   meta 100%%" %
      (100*c['com']/c['t'] if c['t'] else 0, c['com'], c['t']))
d=q("select count(*) as n from ordens_compra where data_prevista is not null")['n']
print("  fornecedores com prazo medido .... %s   meta: todos os ativos" % d)

print("\nPENDENCIAS OPERACIONAIS")
e=run("""select p.nome, m.loja_id, sum(m.quantidade) as saldo from estoque_movimentos m
join produtos p on p.id=m.produto_id
where m.tipo in ('entrada','saida','ajuste','transf_entrada','transf_saida')
group by 1,2 having sum(m.quantidade)<0 order by 3""")
print("  saldos fisicos negativos: %d" % len(e))
for x in e: print("     %-46s %-18s %s" % (x['nome'][:46], x['loja_id'], x['saldo']))
f=q("select count(*) as n from estoque_movimentos where ref like '%test_%'")['n']
print("  movimentos de teste no razao: %s" % f)
