// ════════════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DA EMPRESA (TENANT)  —  Fluxa App
// ────────────────────────────────────────────────────────────────────
//  Este é o ÚNICO arquivo que muda entre empresas. O index.html é
//  compartilhado e idêntico em todas — corrigiu um bug, todas recebem.
//
//  PARA CRIAR UMA EMPRESA NOVA:
//   1. Crie um projeto no Supabase (grátis) e rode o setup.sql nele.
//   2. Copie este arquivo e troque os 5 valores marcados com << >> abaixo.
//   3. Faça o deploy num endereço próprio (ver NOVA-EMPRESA.md).
//
//  Obs.: a anon key do Supabase é pública por natureza (vai no navegador).
//  NUNCA coloque aqui a service_role key nem o PAT (sbp_...).
// ════════════════════════════════════════════════════════════════════
window.FLUXA_CONFIG = {
  // << Nome do sistema / empresa (aparece no título da aba) >>
  appName: 'Fluxa',

  // << Credenciais do Supabase desta empresa (Project URL + anon public key) >>
  supabaseUrl: 'https://lbxwclwzeqqtnwvlxsxs.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHdjbHd6ZXFxdG53dmx4c3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDc3MTUsImV4cCI6MjA5MTA4MzcxNX0.M1ET8Ho-AFJP9Fh-EtYHt4tdQMZj9zdIayYddrwIlhk',

  // << Loja/unidade padrão (id usado como fallback) >>
  lojaPadrao: 'fortemp-camboriu',

  // << Rótulo da opção "ver todas" no seletor do cabeçalho >>
  todasLabel: 'Forthemp — Todas',

  // << Lojas/unidades que o gestor principal vê juntas em "Todas" >>
  grupoPrincipal: ['fortemp-camboriu', 'fortemp-itapema'],

  // << Lojas/unidades desta empresa.
  //    cor: loja-0 (laranja) | loja-1 (azul) | loja-2 (verde)
  //    grupo: agrupa unidades que compartilham (matriz/filial); use o mesmo
  //           valor para unidades irmãs, ou um valor único se for independente >>
  lojas: [
    { id:'fortemp-camboriu', nome:'Fortemp Camboriú', cor:'loja-0', grupo:'forthemp',  tecs:['Marcos','Josimar','Eldecir','Bruno'] },
    { id:'fortemp-itapema',  nome:'Fortemp Itapema',  cor:'loja-1', grupo:'forthemp',  tecs:['Marcos','Josimar','Eldecir','Bruno'] },
    { id:'aquamotor',        nome:'Aquamotor',         cor:'loja-2', grupo:'aquamotor', tecs:['Marcos','Bruno'] }
  ]
};
