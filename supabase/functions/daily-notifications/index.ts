// ============================================================================
// SÓ DE OLHO — Supabase Edge Function: daily-notifications
// Executada diariamente via Cron Job (pg_cron) para verificar todos os itens
// favoritados e disparar alertas via:
//   1. Web Push (OneSignal API)
//   2. Webhook Discord
//   3. Webhook Telegram
//
// Regras de disparo:
//   - Faltarem 3 dias ou 1 dia para a estreia de um Jogo, Filme, Série ou Anime
//   - Um novo episódio de uma Série ou Anime favoritado for ao ar no dia
//   - Um filme favoritado na aba Cinema ganhar uma data digital (TMDB Type 4)
//     ou entrar como "Disponível no Digital" (inclusive cruzando com RSS externo)
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FavoriteRow {
  id: string;
  user_id: string;
  external_id: string;
  media_type: "movie_cinema" | "movie_digital" | "tv" | "anime" | "game";
  title: string;
  poster_url: string | null;
  cinema_date: string | null;
  digital_date: string | null;
  next_episode_date: string | null;
  next_episode_number: number | null;
  is_digital_available: boolean | null;
  last_notified_at: string | null;
}

interface UserNotificationSettings {
  user_id: string;
  onesignal_player_id: string | null;
  web_push_enabled: boolean;
  discord_webhook_url: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  custom_rss_feed_url: string | null;
}

function diffInDays(targetDateStr: string, todayStr: string): number {
  const target = new Date(targetDateStr.slice(0, 10) + "T00:00:00Z");
  const today = new Date(todayStr.slice(0, 10) + "T00:00:00Z");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Estrutura preparada para cruzar títulos de filmes com Feeds RSS externos de releases digitais
async function fetchExternalRssTitles(rssUrl: string): Promise<string[]> {
  if (!rssUrl) return [];
  try {
    const res = await fetch(rssUrl, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gi)];
    return matches
      .map((m) => (m[1] || m[2] || "").trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function checkTmdbDigitalRelease(tmdbId: string, tmdbApiKey: string): Promise<string | null> {
  if (!tmdbApiKey) return null;
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${tmdbApiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];
    // Prioriza BR ou US para Type 4 (Digital)
    const preferred = results.filter((r: { iso_3166_1: string }) =>
      ["BR", "US"].includes(r.iso_3166_1)
    );
    const pools = preferred.length > 0 ? preferred : results;
    for (const country of pools) {
      for (const rel of country.release_dates || []) {
        if (rel.type === 4 && rel.release_date) {
          return rel.release_date.slice(0, 10);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function sendOneSignalPush(params: {
  appId: string;
  restApiKey: string;
  playerIds?: string[];
  heading: string;
  content: string;
}) {
  if (!params.appId || !params.restApiKey) return;
  const body: Record<string, unknown> = {
    app_id: params.appId,
    headings: { pt: params.heading, en: params.heading },
    contents: { pt: params.content, en: params.content },
  };
  if (params.playerIds && params.playerIds.length > 0) {
    body.include_player_ids = params.playerIds;
  } else {
    body.included_segments = ["Subscribed Users"];
  }
  await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Basic ${params.restApiKey}`,
    },
    body: JSON.stringify(body),
  });
}

async function sendDiscordWebhook(webhookUrl: string, heading: string, message: string, posterUrl?: string | null) {
  if (!webhookUrl) return;
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Só de Olho (Aero Glass Radar)",
      embeds: [
        {
          title: `👁️ ${heading}`,
          description: `${message}\n\n*Acompanhando lançamentos... estritamente para fins informativos.*`,
          color: 0x00d2ff,
          thumbnail: posterUrl ? { url: posterUrl } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

async function sendTelegramWebhook(botToken: string, chatId: string, heading: string, message: string) {
  if (!botToken || !chatId) return;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "HTML",
      text: `👁️ <b>${heading}</b>\n\n${message}\n\n<i>Só de Olho — estritamente para fins informativos.</i>`,
    }),
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const tmdbApiKey = Deno.env.get("VITE_TMDB_API_KEY") ?? Deno.env.get("TMDB_API_KEY") ?? "";
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
    const oneSignalRestKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
    const defaultDiscordWebhook = Deno.env.get("DEFAULT_DISCORD_WEBHOOK_URL") ?? "";
    const defaultTelegramToken = Deno.env.get("DEFAULT_TELEGRAM_BOT_TOKEN") ?? "";
    const defaultTelegramChatId = Deno.env.get("DEFAULT_TELEGRAM_CHAT_ID") ?? "";
    const defaultRssUrl = Deno.env.get("DIGITAL_RELEASES_RSS_URL") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas secrets da Edge Function.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: favorites, error: favError } = await supabase
      .from("favorites")
      .select("*");

    if (favError) throw favError;

    const { data: settingsList } = await supabase
      .from("user_notification_settings")
      .select("*");

    const settingsByUser = new Map<string, UserNotificationSettings>();
    for (const s of settingsList || []) {
      settingsByUser.set(s.user_id, s);
    }

    const globalRssTitles = await fetchExternalRssTitles(defaultRssUrl);
    const dispatchedAlerts: Array<{ favoriteId: string; title: string; reason: string }> = [];

    for (const fav of (favorites || []) as FavoriteRow[]) {
      // Evita notificar o mesmo item mais de uma vez no mesmo dia
      if (fav.last_notified_at && fav.last_notified_at.slice(0, 10) === todayStr) {
        continue;
      }

      const userSettings = settingsByUser.get(fav.user_id);
      let alertHeading: string | null = null;
      let alertMessage: string | null = null;
      let updatedDigitalDate: string | null = null;
      let markDigitalAvailable = false;

      // REGRA 1: Faltam 3 dias ou 1 dia para a estreia de Jogo, Filme, Série ou Anime
      const primaryReleaseDate =
        fav.media_type === "movie_digital"
          ? fav.digital_date
          : fav.media_type === "movie_cinema" || fav.media_type === "game"
          ? fav.cinema_date
          : fav.next_episode_date;

      if (primaryReleaseDate) {
        const daysLeft = diffInDays(primaryReleaseDate, todayStr);
        if (daysLeft === 3 || daysLeft === 1) {
          const labelDia = daysLeft === 1 ? "AMANHÃ (1 dia)" : "em 3 DIAS";
          alertHeading = `Contagem Regressiva: ${fav.title}`;
          alertMessage = `Falta${daysLeft === 1 ? "" : "m"} ${labelDia} para o lançamento de "${fav.title}" (${primaryReleaseDate.slice(0, 10)})!`;
        }
      }

      // REGRA 2: Novo episódio de Série ou Anime vai ao ar HOJE
      if ((fav.media_type === "tv" || fav.media_type === "anime") && fav.next_episode_date) {
        const epDays = diffInDays(fav.next_episode_date, todayStr);
        if (epDays === 0) {
          const epNum = fav.next_episode_number ? `Episódio ${String(fav.next_episode_number).padStart(2, "0")}` : "Novo episódio";
          alertHeading = `${epNum} Hoje: ${fav.title}`;
          alertMessage = `O ${epNum.toLowerCase()} de "${fav.title}" vai ao ar hoje! Já pode ficar... só de olho.`;
        }
      }

      // REGRA 3: Filme favoritado na aba Cinema ganhou data digital ou entrou como Disponível no Digital
      if (fav.media_type === "movie_cinema" && !fav.is_digital_available) {
        // 3a. Checa se já atingiu a data digital conhecida
        if (fav.digital_date && diffInDays(fav.digital_date, todayStr) <= 0) {
          alertHeading = `Disponível no Digital: ${fav.title}`;
          alertMessage = `"${fav.title}" acaba de chegar ao Digital/VOD!`;
          markDigitalAvailable = true;
        } else {
          // 3b. Consulta TMDB /release_dates para ver se ganhou data Type 4 (Digital)
          const discoveredType4 = await checkTmdbDigitalRelease(fav.external_id, tmdbApiKey);
          if (discoveredType4 && discoveredType4 !== fav.digital_date) {
            updatedDigitalDate = discoveredType4;
            if (diffInDays(discoveredType4, todayStr) <= 0) {
              alertHeading = `Disponível no Digital: ${fav.title}`;
              alertMessage = `"${fav.title}" já está disponível nas plataformas digitais!`;
              markDigitalAvailable = true;
            } else {
              alertHeading = `Data Digital Confirmada: ${fav.title}`;
              alertMessage = `"${fav.title}" ganhou data de lançamento Digital/VOD para ${discoveredType4}!`;
            }
          }

          // 3c. Cruza com feed RSS externo de releases digitais (se configurado)
          const userRssTitles = userSettings?.custom_rss_feed_url
            ? await fetchExternalRssTitles(userSettings.custom_rss_feed_url)
            : globalRssTitles;

          const normalizedTitle = fav.title.toLowerCase();
          const matchedInRss = userRssTitles.some((rssTitle) => rssTitle.includes(normalizedTitle));
          if (matchedInRss && !alertHeading) {
            alertHeading = `Alerta RSS Digital: ${fav.title}`;
            alertMessage = `"${fav.title}" foi detectado nos feeds de lançamento Digital!`;
            markDigitalAvailable = true;
          }
        }
      }

      if (alertHeading && alertMessage) {
        // Dispara OneSignal Web Push
        await sendOneSignalPush({
          appId: oneSignalAppId,
          restApiKey: oneSignalRestKey,
          playerIds: userSettings?.onesignal_player_id ? [userSettings.onesignal_player_id] : undefined,
          heading: alertHeading,
          content: alertMessage,
        });

        // Dispara Discord Webhook (do usuário ou padrão)
        const discordUrl = userSettings?.discord_webhook_url || defaultDiscordWebhook;
        if (discordUrl) {
          await sendDiscordWebhook(discordUrl, alertHeading, alertMessage, fav.poster_url);
        }

        // Dispara Telegram Webhook (do usuário ou padrão)
        const tgToken = userSettings?.telegram_bot_token || defaultTelegramToken;
        const tgChat = userSettings?.telegram_chat_id || defaultTelegramChatId;
        if (tgToken && tgChat) {
          await sendTelegramWebhook(tgToken, tgChat, alertHeading, alertMessage);
        }

        // Atualiza `last_notified_at` e eventuais datas digitais descobertas
        const updatePayload: Record<string, unknown> = {
          last_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (updatedDigitalDate) updatePayload.digital_date = updatedDigitalDate;
        if (markDigitalAvailable) {
          updatePayload.is_digital_available = true;
          updatePayload.media_type = "movie_digital";
        }

        await supabase.from("favorites").update(updatePayload).eq("id", fav.id);

        dispatchedAlerts.push({
          favoriteId: fav.id,
          title: fav.title,
          reason: alertHeading,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        checked_at: new Date().toISOString(),
        total_favorites_checked: favorites?.length ?? 0,
        alerts_dispatched: dispatchedAlerts.length,
        alerts: dispatchedAlerts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao processar notificações diárias",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
