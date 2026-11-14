-- ============================================================================
-- SÓ DE OLHO — Estrutura SQL Completa para o Supabase
-- "Acompanhando lançamentos... estritamente para fins informativos"
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 1. Enum para tipos de mídia
DO $$ BEGIN
    CREATE TYPE media_category AS ENUM (
        'movie_cinema',
        'movie_digital',
        'tv',
        'anime',
        'game'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela principal: favorites
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    media_type media_category NOT NULL,
    title TEXT NOT NULL,
    poster_url TEXT,
    cinema_date DATE,
    digital_date DATE,
    next_episode_date TIMESTAMPTZ,
    next_episode_number INTEGER,
    is_digital_available BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT favorites_user_external_media_unique UNIQUE (user_id, external_id, media_type)
);

-- Índices para consultas rápidas de favoritos e do Cron Job diário
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_media_type ON public.favorites(media_type);
CREATE INDEX IF NOT EXISTS idx_favorites_cinema_date ON public.favorites(cinema_date);
CREATE INDEX IF NOT EXISTS idx_favorites_digital_date ON public.favorites(digital_date);
CREATE INDEX IF NOT EXISTS idx_favorites_next_episode_date ON public.favorites(next_episode_date);

-- 3. Tabela de Cache do HowLongToBeat: hltb_cache
CREATE TABLE IF NOT EXISTS public.hltb_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    rawg_id TEXT,
    main_story_hours NUMERIC(5, 1),
    main_extra_hours NUMERIC(5, 1),
    completionist_hours NUMERIC(5, 1),
    status_label TEXT NOT NULL DEFAULT 'Tempo: Aguardando dados',
    source_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hltb_cache_normalized_name ON public.hltb_cache(normalized_name);

-- 4. Tabela de Configurações de Notificação por Usuário (Web Push OneSignal + Discord/Telegram Webhooks)
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    onesignal_player_id TEXT,
    web_push_enabled BOOLEAN DEFAULT TRUE,
    discord_webhook_url TEXT,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    rss_digital_alerts_enabled BOOLEAN DEFAULT TRUE,
    custom_rss_feed_url TEXT,
    notify_3_days_before BOOLEAN DEFAULT TRUE,
    notify_1_day_before BOOLEAN DEFAULT TRUE,
    notify_episode_airing_today BOOLEAN DEFAULT TRUE,
    notify_digital_release BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela opcional de log de cruzamento de Feeds RSS de Releases Digitais
CREATE TABLE IF NOT EXISTS public.digital_release_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tmdb_id TEXT NOT NULL UNIQUE,
    movie_title TEXT NOT NULL,
    detected_source TEXT NOT NULL DEFAULT 'TMDB_TYPE_4', -- 'TMDB_TYPE_4' ou 'RSS_INDEXER'
    release_tag TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hltb_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_release_signals ENABLE ROW LEVEL SECURITY;

-- Políticas para favorites
DROP POLICY IF EXISTS "Usuários podem ver seus próprios favoritos" ON public.favorites;
CREATE POLICY "Usuários podem ver seus próprios favoritos"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem inserir seus próprios favoritos" ON public.favorites;
CREATE POLICY "Usuários podem inserir seus próprios favoritos"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios favoritos" ON public.favorites;
CREATE POLICY "Usuários podem atualizar seus próprios favoritos"
    ON public.favorites FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem remover seus próprios favoritos" ON public.favorites;
CREATE POLICY "Usuários podem remover seus próprios favoritos"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para hltb_cache (Leitura pública, escrita via Edge Function / Service Role ou autenticado)
DROP POLICY IF EXISTS "Leitura pública do cache HLTB" ON public.hltb_cache;
CREATE POLICY "Leitura pública do cache HLTB"
    ON public.hltb_cache FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Upsert autenticado ou service role no cache HLTB" ON public.hltb_cache;
CREATE POLICY "Upsert autenticado ou service role no cache HLTB"
    ON public.hltb_cache FOR ALL
    USING (true)
    WITH CHECK (true);

-- Políticas para user_notification_settings
DROP POLICY IF EXISTS "Usuários gerenciam suas próprias configurações de notificação" ON public.user_notification_settings;
CREATE POLICY "Usuários gerenciam suas próprias configurações de notificação"
    ON public.user_notification_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para digital_release_signals
DROP POLICY IF EXISTS "Leitura pública de sinais digitais" ON public.digital_release_signals;
CREATE POLICY "Leitura pública de sinais digitais"
    ON public.digital_release_signals FOR SELECT
    USING (true);

-- ============================================================================
-- Agendamento do Cron Job Diário (Todo dia às 09:00 BRT / 12:00 UTC)
-- ============================================================================
-- Nota: Substitua <SEU-PROJETO> e <SUA-ANON-OU-SERVICE-KEY> ao ativar em produção
/*
SELECT cron.schedule(
    'so-de-olho-daily-notifications',
    '0 12 * * *',
    $$
    SELECT net.http_post(
        url := 'https://<SEU-PROJETO>.supabase.co/functions/v1/daily-notifications',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer <SUA-SERVICE-ROLE-KEY>'
        ),
        body := jsonb_build_object('source', 'pg_cron')
    );
    $$
);
*/
