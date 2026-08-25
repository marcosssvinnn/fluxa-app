// enviar-push — envia notificações Web Push (VAPID) pros dispositivos
// inscritos, filtrando por loja e/ou perfil (App de celular, Fase C, porte
// do FluxaSaas-/v2 — ver CLAUDE.md).
//
// Diferença importante em relação ao v2: o v1 NÃO tem Supabase Auth, então
// não existe "Authorization: Bearer <JWT de usuário>" pra autorizar aqui —
// a ÚNICA forma de chamar esta função é o header x-push-secret, que só o
// Postgres do próprio projeto conhece (guardado no Vault, nunca no
// cliente/app.js — ver migracao-push-subscriptions.sql). Isso é
// deliberado: expor esse segredo ao navegador (mesmo só pro gestor)
// permitiria qualquer pessoa com a anon key (pública, está no app.js)
// disparar push arbitrário pra qualquer dispositivo inscrito.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  // ── Autorização — só server-to-server (trigger do banco via pg_net) ──
  const internalSecret = req.headers.get("x-push-secret");
  if (!internalSecret || internalSecret !== PUSH_INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
  }

  // ── Payload ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  const loja_id = body.loja_id as string | null | undefined;
  const titulo = body.titulo as string | undefined;
  const corpo = body.corpo as string | undefined;
  const url = (body.url as string | undefined) || "/";
  const perfisAlvo = body.perfis_alvo as string[] | undefined;

  if (!titulo || !corpo) {
    return new Response(JSON.stringify({ error: "titulo e corpo são obrigatórios" }), { status: 400 });
  }

  // ── Busca inscrições ativas — por loja (ou sem loja = gestor principal,
  // que vê o grupo todo, então recebe tudo) e por perfil, se informado ──
  let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key, loja_id, perfil").eq("ativo", true);
  if (perfisAlvo?.length) query = query.in("perfil", perfisAlvo);
  const { data: subs, error: subsErr } = await query;
  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });
  }

  // Gestor/master sem loja_id (loja_id null na inscrição) vê o grupo todo —
  // recebe notificação de qualquer loja. Quem tem loja_id fixa só recebe da
  // própria loja.
  const alvos = (subs || []).filter((s) => !s.loja_id || !loja_id || s.loja_id === loja_id);

  // ── Envia (em paralelo, cada falha isolada) ──
  const payload = JSON.stringify({ title: titulo, body: corpo, url });
  const resultados = await Promise.allSettled(
    alvos.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = inscrição morta (usuário desinstalou/revogou permissão) — desativa
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").update({ ativo: false }).eq("id", s.id);
        }
        throw err;
      }
    }),
  );

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  return new Response(
    JSON.stringify({ total: alvos.length, enviados, falhas: alvos.length - enviados }),
    { headers: { "Content-Type": "application/json" } },
  );
});
