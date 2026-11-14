// ============================================================================
// SÓ DE OLHO — Supabase Edge Function: hltb-lookup
// Consulta o tempo médio da campanha principal (Main Story) no HowLongToBeat
// pelo nome do jogo e salva o resultado em cache na tabela `hltb_cache` do
// Supabase (evitando bloqueios de CORS no frontend).
// Se o jogo ainda não tiver dados, retorna "Tempo: Aguardando dados".
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface HLTBSearchEntry {
  game_id: number;
  game_name: string;
  comp_main: number; // segundos na API oficial do HLTB
  comp_plus: number;
  comp_100: number;
}

async function queryHowLongToBeat(gameName: string): Promise<{
  mainHours: number | null;
  extraHours: number | null;
  completionistHours: number | null;
  label: string;
}> {
  try {
    const searchTerms = gameName
      .replace(/[:\-–—]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const payload = {
      searchType: "games",
      searchTerms,
      searchPage: 1,
      size: 5,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: "popular",
          rangeCategory: "main",
          rangeTime: { min: null, max: null },
          gameplay: { perspective: "", flow: "", genre: "" },
          rangeYear: { min: "", max: "" },
          modifier: "",
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    };

    const response = await fetch("https://howlongtobeat.com/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://howlongtobeat.com",
        "Referer": "https://howlongtobeat.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        mainHours: null,
        extraHours: null,
        completionistHours: null,
        label: "Tempo: Aguardando dados",
      };
    }

    const result = await response.json();
    const list: HLTBSearchEntry[] = result?.data || [];

    if (!list.length) {
      return {
        mainHours: null,
        extraHours: null,
        completionistHours: null,
        label: "Tempo: Aguardando dados",
      };
    }

    const bestMatch = list[0];
    const mainSeconds = Number(bestMatch.comp_main || 0);
    const extraSeconds = Number(bestMatch.comp_plus || 0);
    const compSeconds = Number(bestMatch.comp_100 || 0);

    if (mainSeconds <= 0) {
      return {
        mainHours: null,
        extraHours: null,
        completionistHours: null,
        label: "Tempo: Aguardando dados",
      };
    }

    const mainHours = Math.round((mainSeconds / 3600) * 10) / 10;
    const extraHours = extraSeconds > 0 ? Math.round((extraSeconds / 3600) * 10) / 10 : null;
    const completionistHours = compSeconds > 0 ? Math.round((compSeconds / 3600) * 10) / 10 : null;

    return {
      mainHours,
      extraHours,
      completionistHours,
      label: `~${Math.round(mainHours)}h para zerar`,
    };
  } catch (_err) {
    return {
      mainHours: null,
      extraHours: null,
      completionistHours: null,
      label: "Tempo: Aguardando dados",
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { gameName, rawgId } = await req.json();

    if (!gameName || typeof gameName !== "string") {
      return new Response(
        JSON.stringify({
          error: "Parâmetro 'gameName' é obrigatório.",
          status_label: "Tempo: Aguardando dados",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalized = normalizeGameName(gameName);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // 1. Verifica se já existe no cache do Supabase (válido por 7 dias se já tiver horas, ou 24h se aguardando dados)
    if (supabase) {
      const { data: cached } = await supabase
        .from("hltb_cache")
        .select("*")
        .eq("normalized_name", normalized)
        .maybeSingle();

      if (cached) {
        const ageHours =
          (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60);
        const maxAge = cached.main_story_hours ? 168 : 24;

        if (ageHours < maxAge) {
          return new Response(
            JSON.stringify({
              cached: true,
              game_name: cached.game_name,
              main_story_hours: cached.main_story_hours,
              main_extra_hours: cached.main_extra_hours,
              completionist_hours: cached.completionist_hours,
              status_label: cached.status_label || "Tempo: Aguardando dados",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 2. Consulta o HowLongToBeat no servidor (sem bloqueio de CORS)
    const hltbResult = await queryHowLongToBeat(gameName);

    // 3. Salva no cache do Supabase
    if (supabase) {
      await supabase.from("hltb_cache").upsert(
        {
          game_name: gameName,
          normalized_name: normalized,
          rawg_id: rawgId ? String(rawgId) : null,
          main_story_hours: hltbResult.mainHours,
          main_extra_hours: hltbResult.extraHours,
          completionist_hours: hltbResult.completionistHours,
          status_label: hltbResult.label,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "normalized_name" }
      );
    }

    return new Response(
      JSON.stringify({
        cached: false,
        game_name: gameName,
        main_story_hours: hltbResult.mainHours,
        main_extra_hours: hltbResult.extraHours,
        completionist_hours: hltbResult.completionistHours,
        status_label: hltbResult.label,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno",
        status_label: "Tempo: Aguardando dados",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
