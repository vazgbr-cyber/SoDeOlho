import React, { useRef, useState } from 'react';
import {
  X,
  BellRing,
  BellOff,
  Download,
  Upload,
  Copy,
  Check,
  Send,
  Save,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { AppSettings, MediaItem } from '../types/media';
import { getDefaultSettings } from '../lib/settings';
import { triggerTestWebhookAlert } from '../services/favoritesService';
import { BrandLogo } from './ProcessedImages';
import { UfoIcon } from './AbductButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  abductedItems: MediaItem[];
  onImportAbducted: (items: MediaItem[], mode: 'merge' | 'replace') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  abductedItems,
  onImportAbducted,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<
    'abducted_backup' | 'notifications' | 'customization'
  >('abducted_backup');

  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFieldChange = <K extends keyof AppSettings>(
    field: K,
    value: AppSettings[K]
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(getDefaultSettings());
  };

  // 1. Exportar seleção de Abduzidos como arquivo .JSON
  const handleDownloadBackupFile = () => {
    const payload = {
      app: 'Só de Olho',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      totalAbducted: abductedItems.length,
      abducted: abductedItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `so-de-olho-abduzidos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setBackupFeedback({
      type: 'ok',
      text: `Arquivo com ${abductedItems.length} mídia(s) abduzida(s) exportado com sucesso!`,
    });
  };

  // 2. Copiar JSON de Abduzidos para a área de transferência
  const handleCopyBackupJson = () => {
    const payload = {
      app: 'Só de Olho',
      exportedAt: new Date().toISOString(),
      abducted: abductedItems,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // 3. Processar JSON importado (via arquivo ou texto colado)
  const parseAndImportJson = (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText);
      const list: MediaItem[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.abducted)
        ? parsed.abducted
        : [];

      const validItems = list.filter(
        (it) => it && typeof it.title === 'string' && typeof it.category === 'string'
      );

      if (validItems.length === 0) {
        setBackupFeedback({
          type: 'err',
          text: 'Nenhuma mídia válida foi encontrada no código/arquivo enviado.',
        });
        return;
      }

      onImportAbducted(validItems, importMode);
      setImportJsonText('');
      setBackupFeedback({
        type: 'ok',
        text: `${validItems.length} mídia(s) abduzida(s) importada(s) com sucesso!`,
      });
    } catch {
      setBackupFeedback({
        type: 'err',
        text: 'Formato JSON inválido. Verifique se copiou ou selecionou o arquivo correto.',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      parseAndImportJson(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. Testar notificação (Navegador + Discord/Telegram)
  const handleTestNotification = async () => {
    setTestingWebhook(true);
    setTestStatus(null);

    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification('🛸 Só de Olho — Radar Ativo!', {
          body: 'Suas notificações de mídias abduzidas estão funcionando perfeitamente.',
          icon: '/logo-eye-ufo.svg',
        });
      }
    }

    const result = await triggerTestWebhookAlert(draft);
    setTestStatus(
      Notification.permission === 'granted'
        ? 'Notificação enviada no navegador! ' +
            (draft.discordWebhookUrl || draft.telegramBotToken ? result.message : '')
        : result.message
    );
    setTestingWebhook(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="xeno-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Cabeçalho do Painel do Usuário */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#161124] border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <BrandLogo size={32} />
            <div>
              <span className="text-sm font-extrabold text-white block">
                Opções do Usuário & Customização ({draft.userName || 'Nebula_99'})
              </span>
              <span className="text-[11px] text-[#8e86a3]">
                Exportar/Importar Abduzidos, Alertas e Preferências
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-[#a855f7]/20 text-[#968da8] hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas do Painel de Customização */}
        <div className="px-6 pt-3.5 flex flex-wrap gap-2 border-b border-white/[0.07] pb-3 bg-[#0c0914]">
          <button
            type="button"
            onClick={() => setActiveTab('abducted_backup')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'abducted_backup'
                ? 'bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/50'
                : 'text-[#8e86a3] hover:text-white bg-white/[0.03]'
            }`}
          >
            <UfoIcon active={activeTab === 'abducted_backup'} size={15} />
            <span>Exportar / Importar Abduzidos ({abductedItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'notifications'
                ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/50'
                : 'text-[#8e86a3] hover:text-white bg-white/[0.03]'
            }`}
          >
            {draft.notificationsEnabled ? (
              <BellRing className="w-4 h-4 text-[#22ff55]" />
            ) : (
              <BellOff className="w-4 h-4 text-[#6e6682]" />
            )}
            <span>Notificações</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customization')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'customization'
                ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/50'
                : 'text-[#8e86a3] hover:text-white bg-white/[0.03]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Perfil & Chaves</span>
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* ==================================================================
              ABA 1: EXPORTAR / IMPORTAR SELEÇÃO DE ABDUZIDOS
             ================================================================== */}
          {activeTab === 'abducted_backup' && (
            <div className="space-y-5">
              {/* Bloco Exportar */}
              <div className="p-4 rounded-2xl bg-[#130f1d] border border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4ade80]">
                    1. Exportar sua seleção de Abduzidos
                  </h3>
                  <span className="text-[11px] font-mono text-[#c084fc]">
                    {abductedItems.length} título(s) na nave
                  </span>
                </div>
                <p className="text-xs text-[#8e86a3]">
                  Salve um arquivo com todos os filmes, séries, animes e games que você
                  abduziu para guardar de backup ou enviar para outro computador/amigo.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadBackupFile}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/50 hover:border-[#22ff55] flex items-center gap-2 shadow-[0_0_16px_rgba(34,255,85,0.18)]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Seleção (.JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyBackupJson}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c142e] text-[#c084fc] border border-[#a855f7]/45 hover:border-[#a855f7] flex items-center gap-2"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-4 h-4 text-[#22ff55]" />
                        <span>Código Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Código da Seleção</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bloco Importar */}
              <div className="p-4 rounded-2xl bg-[#130f1d] border border-white/[0.07] space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#c084fc]">
                  2. Importar seleção de Abduzidos
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#c4bcd6]">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="accent-[#22ff55]"
                    />
                    <span>Somar aos meus Abduzidos atuais</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-[#a855f7]"
                    />
                    <span>Substituir lista atual inteira</span>
                  </label>
                </div>

                {/* Upload por Arquivo */}
                <div className="pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-[#a855f7]/50 hover:border-[#22ff55] bg-[#09070e]/80 text-xs font-bold text-[#c084fc] hover:text-[#4ade80] flex items-center justify-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Selecionar arquivo .JSON do computador</span>
                  </button>
                </div>

                {/* Ou colar código JSON */}
                <div className="space-y-2 pt-1">
                  <textarea
                    rows={3}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder='Ou cole aqui o código JSON copiado e clique em "Importar Código"...'
                    className="w-full p-3 text-xs rounded-xl bg-[#09070e] text-white placeholder-[#655d78] border border-white/10 focus:outline-none focus:border-[#a855f7] font-mono"
                  />
                  {importJsonText.trim() && (
                    <button
                      type="button"
                      onClick={() => parseAndImportJson(importJsonText)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/50"
                    >
                      Importar Código Colado
                    </button>
                  )}
                </div>

                {backupFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold ${
                      backupFeedback.type === 'ok'
                        ? 'bg-[#0d3320]/80 text-[#4ade80] border border-[#22ff55]/40'
                        : 'bg-red-950/60 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {backupFeedback.text}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================================
              ABA 2: ATIVAR OU DESATIVAR NOTIFICAÇÕES
             ================================================================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {/* Chave Geral: Ativar / Desativar Notificações */}
              <div
                onClick={() =>
                  handleFieldChange(
                    'notificationsEnabled',
                    !draft.notificationsEnabled
                  )
                }
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  draft.notificationsEnabled
                    ? 'bg-[#0d3320]/60 border-[#22ff55]/60 shadow-[0_0_20px_rgba(34,255,85,0.12)]'
                    : 'bg-[#130f1d] border-white/10 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  {draft.notificationsEnabled ? (
                    <BellRing className="w-6 h-6 text-[#22ff55]" />
                  ) : (
                    <BellOff className="w-6 h-6 text-[#7c738f]" />
                  )}
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      {draft.notificationsEnabled
                        ? 'Notificações de Abduzidos ATIVADAS'
                        : 'Notificações de Abduzidos DESATIVADAS'}
                    </div>
                    <div className="text-xs text-[#8e86a3]">
                      Clique para ativar ou silenciar todos os alertas de estreias e episódios
                    </div>
                  </div>
                </div>

                <div
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    draft.notificationsEnabled ? 'bg-[#22ff55]' : 'bg-[#2a2438]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-[#09070e] transition-transform ${
                      draft.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Opções Individuais de Quando Avisar */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${
                  draft.notificationsEnabled
                    ? 'opacity-100'
                    : 'opacity-40 pointer-events-none'
                }`}
              >
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#130f1d] border border-white/[0.07] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.notify3DaysBefore}
                    onChange={(e) =>
                      handleFieldChange('notify3DaysBefore', e.target.checked)
                    }
                    className="w-4 h-4 accent-[#22ff55]"
                  />
                  <span className="text-xs text-white">
                    Avisar <strong>3 dias antes</strong> da estreia
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#130f1d] border border-white/[0.07] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.notify1DayBefore}
                    onChange={(e) =>
                      handleFieldChange('notify1DayBefore', e.target.checked)
                    }
                    className="w-4 h-4 accent-[#22ff55]"
                  />
                  <span className="text-xs text-white">
                    Avisar <strong>1 dia antes</strong> da estreia
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#130f1d] border border-white/[0.07] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.notifyEpisodeToday}
                    onChange={(e) =>
                      handleFieldChange('notifyEpisodeToday', e.target.checked)
                    }
                    className="w-4 h-4 accent-[#22ff55]"
                  />
                  <span className="text-xs text-white">
                    Avisar no dia de <strong>novo episódio</strong>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#130f1d] border border-white/[0.07] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.notifyDigitalRelease}
                    onChange={(e) =>
                      handleFieldChange('notifyDigitalRelease', e.target.checked)
                    }
                    className="w-4 h-4 accent-[#22ff55]"
                  />
                  <span className="text-xs text-white">
                    Avisar quando sair no <strong>Digital / VOD</strong>
                  </span>
                </label>
              </div>

              {/* Webhooks opcionais (Discord / Telegram) */}
              <div
                className={`space-y-3 pt-2 border-t border-white/[0.07] ${
                  draft.notificationsEnabled
                    ? 'opacity-100'
                    : 'opacity-40 pointer-events-none'
                }`}
              >
                <div>
                  <label className="block text-xs font-bold text-[#c084fc] mb-1">
                    Discord Webhook URL (Opcional)
                  </label>
                  <input
                    type="url"
                    value={draft.discordWebhookUrl}
                    onChange={(e) =>
                      handleFieldChange('discordWebhookUrl', e.target.value)
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#09070e] text-white border border-white/10 focus:outline-none focus:border-[#a855f7] font-mono"
                  />
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={testingWebhook}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1c142e] text-[#c084fc] border border-[#a855f7]/50 hover:border-[#22ff55] hover:text-[#4ade80] flex items-center gap-2 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {testingWebhook
                        ? 'Disparando...'
                        : 'Testar Alerta Agora'}
                    </span>
                  </button>
                  {testStatus && (
                    <span className="text-xs text-[#4ade80]">{testStatus}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              ABA 3: PERFIL & CHAVES DE API
             ================================================================== */}
          {activeTab === 'customization' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4ade80] mb-1">
                  Seu Codinome na Barra Lateral
                </label>
                <input
                  type="text"
                  value={draft.userName}
                  onChange={(e) => handleFieldChange('userName', e.target.value)}
                  placeholder="Ex: Nebula_99"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#09070e] text-white border border-white/10 focus:outline-none focus:border-[#22ff55]"
                />
              </div>

              <div className="pt-2 border-t border-white/[0.07] space-y-3">
                <p className="text-xs text-[#8e86a3]">
                  Chaves opcionais para buscar lançamentos adicionais ao vivo da TMDB e RAWG:
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#c084fc] mb-1">
                    Chave da TMDB API (Filmes & Séries em pt-BR)
                  </label>
                  <input
                    type="password"
                    value={draft.tmdbApiKey}
                    onChange={(e) => handleFieldChange('tmdbApiKey', e.target.value)}
                    placeholder="Cole sua chave da TMDB aqui..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#09070e] text-white border border-white/10 focus:outline-none focus:border-[#a855f7] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4ade80] mb-1">
                    Chave da RAWG API (Games)
                  </label>
                  <input
                    type="password"
                    value={draft.rawgApiKey}
                    onChange={(e) => handleFieldChange('rawgApiKey', e.target.value)}
                    placeholder="Cole sua chave da RAWG aqui..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#09070e] text-white border border-white/10 focus:outline-none focus:border-[#22ff55] font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rodapé do Modal */}
          <div className="pt-4 border-t border-white/[0.07] flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-[#8e86a3] hover:text-white flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar padrões</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/50 hover:border-[#22ff55] flex items-center gap-2 shadow-[0_0_16px_rgba(34,255,85,0.2)]"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Preferências</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
