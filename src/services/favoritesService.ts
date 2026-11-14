import { AppSettings, MediaItem } from '../types/media';
import { getSupabaseClient } from '../lib/settings';

const LOCAL_FAVORITES_KEY = 'so_de_olho_favorites_v1';

export function loadLocalFavorites(): MediaItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalFavorites(items: MediaItem[]): void {
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Erro ao salvar favoritos localmente:', err);
  }
}

/**
 * Sincroniza um favorito com a tabela `favorites` do Supabase caso esteja configurado.
 */
export async function syncFavoriteWithSupabase(
  item: MediaItem,
  isAdding: boolean,
  settings: AppSettings
): Promise<{ synced: boolean; error?: string }> {
  const supabase = getSupabaseClient(settings);
  if (!supabase) {
    return { synced: false };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { synced: false };
    }

    if (isAdding) {
      const payload = {
        user_id: user.id,
        external_id: item.externalId,
        media_type: item.category,
        title: item.title,
        poster_url: item.posterUrl,
        cinema_date: item.cinemaReleaseDate || item.releaseDate || null,
        digital_date: item.digitalReleaseDate || null,
        next_episode_date: item.nextEpisodeDate || null,
        next_episode_number: item.nextEpisodeNumber ?? null,
        is_digital_available: item.isDigitalAvailable ?? false,
        metadata: item,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('favorites')
        .upsert(payload, { onConflict: 'user_id,external_id,media_type' });

      if (error) return { synced: false, error: error.message };
      return { synced: true };
    } else {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('external_id', item.externalId)
        .eq('media_type', item.category);

      if (error) return { synced: false, error: error.message };
      return { synced: true };
    }
  } catch (err) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : 'Erro de sincronização',
    };
  }
}

/**
 * Carrega os favoritos salvos no Supabase para o usuário autenticado
 */
export async function fetchSupabaseFavorites(
  settings: AppSettings
): Promise<MediaItem[] | null> {
  const supabase = getSupabaseClient(settings);
  if (!supabase) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((row: {
      id: string;
      external_id: string;
      media_type: MediaItem['category'];
      title: string;
      poster_url: string;
      cinema_date: string | null;
      digital_date: string | null;
      next_episode_date: string | null;
      next_episode_number: number | null;
      is_digital_available: boolean | null;
      metadata?: Partial<MediaItem>;
    }) => {
      const meta = row.metadata || {};
      return {
        id: meta.id || `${row.media_type}-${row.external_id}`,
        externalId: row.external_id,
        category: row.media_type,
        title: row.title,
        posterUrl: row.poster_url || '',
        synopsis:
          meta.synopsis ||
          'Item monitorado na sua lista de favoritos do Só de Olho.',
        genres: meta.genres || ['Favorito'],
        director: meta.director,
        cinemaReleaseDate: row.cinema_date || meta.cinemaReleaseDate || null,
        digitalReleaseDate: row.digital_date || meta.digitalReleaseDate || null,
        isDigitalAvailable: row.is_digital_available ?? meta.isDigitalAvailable ?? false,
        studioOrNetwork: meta.studioOrNetwork,
        seasonStatus: meta.seasonStatus,
        nextEpisodeNumber: row.next_episode_number ?? meta.nextEpisodeNumber ?? null,
        nextEpisodeDate: row.next_episode_date || meta.nextEpisodeDate || null,
        developer: meta.developer,
        platforms: meta.platforms,
        releaseDate: meta.releaseDate || row.cinema_date || null,
        hltbMainHours: meta.hltbMainHours ?? null,
        hltbLabel: meta.hltbLabel || 'Tempo: Aguardando dados',
      };
    });
  } catch {
    return null;
  }
}

/**
 * Envia uma notificação de teste para o Webhook Discord ou Telegram configurado pelo usuário
 */
export async function triggerTestWebhookAlert(settings: AppSettings): Promise<{
  ok: boolean;
  message: string;
}> {
  let sentCount = 0;

  try {
    if (settings.discordWebhookUrl.trim()) {
      const res = await fetch(settings.discordWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Só de Olho (Aero Glass Radar)',
          embeds: [
            {
              title: '👁️ Teste de Alerta — Só de Olho',
              description:
                'Conexão de Webhook verificada com sucesso! Você receberá alertas quando:\n• Faltarem **3 dias** ou **1 dia** para estreias favoritadas\n• Um novo episódio de **Série** ou **Anime** for ao ar no dia\n• Um filme do **Cinema** ganhar data **Digital** ou ficar **Disponível no Digital**.\n\n*Estritamente para fins informativos.*',
              color: 0x00d2ff,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (res.ok) sentCount++;
    }

    if (settings.telegramBotToken.trim() && settings.telegramChatId.trim()) {
      const tgUrl = `https://api.telegram.org/bot${settings.telegramBotToken.trim()}/sendMessage`;
      const res = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramChatId.trim(),
          parse_mode: 'HTML',
          text: '👁️ <b>Só de Olho — Radar Ativo!</b>\n\nSeu Webhook do Telegram foi configurado com sucesso para avisar sobre estreias, episódios do dia e lançamentos digitais.\n\n<i>Estritamente para fins informativos.</i>',
        }),
      });
      if (res.ok) sentCount++;
    }

    if (sentCount > 0) {
      return {
        ok: true,
        message: `Notificação de teste disparada com sucesso (${sentCount} canal(is) ativo(s))!`,
      };
    }

    return {
      ok: false,
      message:
        'Preencha a URL do Webhook do Discord ou o Bot Token + Chat ID do Telegram para testar o disparo ao vivo.',
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Falha ao disparar teste: ${err.message}`
          : 'Erro ao testar webhook.',
    };
  }
}
