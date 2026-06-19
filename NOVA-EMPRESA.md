# Como criar uma empresa NOVA no Fluxa

Cada empresa tem **banco próprio** (dados 100% isolados) e **endereço próprio**, mas usa o **mesmo código** (`index.html`). Só o `config.js` muda entre empresas. Quando um bug é corrigido, é só atualizar o `index.html` de cada deploy.

Leva ~15 minutos por empresa.

---

## Passo 1 — Banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) → **New project**
   - Nome: ex. `fluxa-empresaX` · Região: **South America (São Paulo)**
   - Guarde a senha do banco (não é usada no app, mas o Supabase pede).
2. Quando o projeto subir, vá em **SQL Editor → New query**
3. Cole **todo o conteúdo do arquivo [`setup.sql`](setup.sql)** e clique **Run**
   - Deve terminar com "Success". Isso cria todas as tabelas, permissões, realtime e o bucket de PDFs.
4. Vá em **Project Settings → API** e copie:
   - **Project URL** (ex: `https://abcdxyz.supabase.co`)
   - **anon public** key (o texto longo começando com `eyJ...`)

---

## Passo 2 — Configuração da empresa (`config.js`)

1. Copie o arquivo `config.js` deste projeto.
2. Troque os valores marcados com `<< >>`:
   - `appName` → nome da empresa (aparece no título)
   - `supabaseUrl` / `supabaseKey` → os dois valores que você copiou no Passo 1.4
   - `lojas` → as unidades dessa empresa. Se for **uma só unidade**, deixe uma entrada:
     ```js
     lojas: [
       { id:'empresax', nome:'Empresa X', cor:'loja-0', grupo:'empresax', tecs:['Fulano','Ciclano'] }
     ]
     ```
   - `lojaPadrao` → o `id` da unidade principal (ex: `'empresax'`)
   - `grupoPrincipal` → lista dos `id`s que o gestor vê juntos em "Todas" (ex: `['empresax']`)
   - `todasLabel` → rótulo do "ver todas" (ex: `'Empresa X — Todas'`)

> Dica: o `id` da loja é livre, mas use minúsculas sem espaço/acento (`empresax`, `matriz`, `filial-sul`). Ele fica gravado nos dados — **não mude depois**.

---

## Passo 3 — Publicar (endereço próprio)

A forma mais simples, igual à empresa atual (GitHub Pages):

1. No GitHub, crie um repositório novo, ex. `fluxa-empresax` (pode ser público).
2. Suba **dois arquivos**: o `index.html` (idêntico ao da empresa atual) e o `config.js` (o que você editou no Passo 2). Suba também `sw.js` (idêntico).
3. No repositório: **Settings → Pages** → Source: branch `main` → Save.
4. Em ~1 minuto o app fica no ar em `https://SEU-USUARIO.github.io/fluxa-empresax/`.

---

## Passo 4 — Primeiro acesso

1. Abra o endereço. Na primeira vez, defina o **PIN do gestor** e os dados da empresa (logo, cores, telefone) em **Empresa**.
2. Cadastre os técnicos/vendedores em **Usuários**.
3. (Opcional) Configure o **EmailJS** em Empresa → E-mail Automático, se quiser e-mail de vistoria.

Pronto — empresa nova, separada, no ar.

---

## Manutenção (corrigir bug uma vez, atualizar todas)

Quando o `index.html` for atualizado na empresa principal, copie o **mesmo** `index.html` para o repositório de cada empresa (o `config.js` de cada uma **nunca muda**). O app se atualiza sozinho nos aparelhos (detector de versão por ETag).

> O `index.html` é igual em todas as empresas. Só o `config.js` é diferente. Nunca misture o `config.js` de uma empresa com o de outra.
