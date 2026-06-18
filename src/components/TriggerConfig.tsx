/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EventTrigger, SoundType, SynthPreset } from '../types';
import { 
  Play, Plus, Trash2, Edit2, Volume2, Save, X, ToggleLeft, ToggleRight, 
  Settings, HelpCircle, FileAudio, Keyboard, Eye, ChevronRight
} from 'lucide-react';
import { triggerSoundAlert } from '../utils/audio';

interface TriggerConfigProps {
  triggers: EventTrigger[];
  onAddTrigger: (trigger: Omit<EventTrigger, 'id'>) => void;
  onUpdateTrigger: (trigger: EventTrigger) => void;
  onDeleteTrigger: (id: string) => void;
  onTestTriggerSound: (trigger: EventTrigger) => void;
}

export function TriggerConfig({
  triggers,
  onAddTrigger,
  onUpdateTrigger,
  onDeleteTrigger,
  onTestTriggerSound
}: TriggerConfigProps) {
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [soundType, setSoundType] = useState<SoundType>('synth');
  const [soundValue, setSoundValue] = useState('chime-up');
  const [voiceLanguage, setVoiceLanguage] = useState<'pt-BR' | 'en-US'>('pt-BR');
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState('');

  // Audio File Upload State
  const [uploadProgress, setUploadProgress] = useState(false);

  const resetForm = () => {
    setName('');
    setPattern('');
    setSoundType('synth');
    setSoundValue('chime-up');
    setVoiceLanguage('pt-BR');
    setEnabled(true);
    setDescription('');
    setEditingTriggerId(null);
    setIsAdding(false);
  };

  const handleEdit = (trigger: EventTrigger) => {
    setEditingTriggerId(trigger.id);
    setName(trigger.name);
    setPattern(trigger.pattern);
    setSoundType(trigger.soundType);
    setSoundValue(trigger.soundValue);
    setVoiceLanguage(trigger.voiceLanguage);
    setEnabled(trigger.enabled);
    setDescription(trigger.description);
    setIsAdding(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !pattern) return;

    const data = {
      name,
      pattern,
      soundType,
      soundValue,
      voiceLanguage,
      enabled,
      description
    };

    if (editingTriggerId) {
      onUpdateTrigger({
        ...data,
        id: editingTriggerId
      });
    } else {
      onAddTrigger(data);
    }
    resetForm();
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Por favor selecione um arquivo de áudio menor que 2MB para preservar os limites de armazenamento local.');
      return;
    }

    setUploadProgress(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setSoundValue(event.target.result);
      }
      setUploadProgress(false);
    };
    reader.onerror = () => {
      alert('Falha ao ler o arquivo de áudio.');
      setUploadProgress(false);
    };
    reader.readAsDataURL(file);
  };

  const synthPresets: { value: SynthPreset; label: string }[] = [
    { value: 'chime-up', label: 'Sinos Crescente (Início)' },
    { value: 'chime-down', label: 'Sinos Decrescente (Troca)' },
    { value: 'alarm-loop', label: 'Alarme / Sirene Crítica (Falha)' },
    { value: 'beep-multiple', label: 'Duplo Beep Metálico (Pausa)' },
    { value: 'laser', label: 'Efeito Arcade Laser (Finalizado)' },
  ];

  return (
    <div id="trigger-config-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left side: Form for adding/editing */}
      <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg h-fit">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
          <h3 className="font-sans font-bold text-white text-base">
            {editingTriggerId ? 'Editar Detecção de Evento' : isAdding ? 'Novo Gatilho de Customizado' : 'Painel de Configuração'}
          </h3>
          {(editingTriggerId || isAdding) && (
            <button
              id="btn-cancel-edit"
              onClick={resetForm}
              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!(editingTriggerId || isAdding) ? (
          <div className="py-4 text-center">
            <p className="font-sans text-xs text-zinc-400 px-4">
              Selecione "Editar" em qualquer gatilho ou crie um novo customizado para programar o tipo de alerta do Moonraker.
            </p>
            <button
              id="btn-new-trigger"
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-emerald-900/35 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Gatilho
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 font-sans">
            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Nome do Gatilho</label>
              <input
                id="trigger-form-name"
                type="text"
                required
                placeholder="Ex: Troca de Filamento"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1 flex items-center gap-1">
                G-Code Text ID / Pattern
                <span className="group relative cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 text-zinc-350 p-2 rounded text-[10px] w-48 z-20 shadow-xl">
                    Linha enviada pelo console da impressora. Ex: '// filament_change' ou 'M600'
                  </span>
                </span>
              </label>
              <input
                id="trigger-form-pattern"
                type="text"
                required
                placeholder="Ex: // filament_change"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Tipo de Áudio/Alerta</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-sound-type-synth"
                  type="button"
                  onClick={() => {
                    setSoundType('synth');
                    setSoundValue('chime-up');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    soundType === 'synth'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  Sintetizador Beeps
                </button>
                <button
                  id="btn-sound-type-speech"
                  type="button"
                  onClick={() => {
                    setSoundType('speech');
                    setSoundValue('');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    soundType === 'speech'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  Voz TTS (Estilo Siri)
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  id="btn-sound-type-upload"
                  type="button"
                  onClick={() => {
                    setSoundType('upload');
                    setSoundValue('');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    soundType === 'upload'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  Upload de Áudio
                </button>
                <button
                  id="btn-sound-type-url"
                  type="button"
                  onClick={() => {
                    setSoundType('url');
                    setSoundValue('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    soundType === 'url'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  URL de Áudio Web
                </button>
              </div>
            </div>

            {/* Config Fields based on Sound Type */}
            {soundType === 'synth' && (
              <div>
                <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Tom do Sintetizador</label>
                <select
                  id="trigger-form-synth-value"
                  value={soundValue}
                  onChange={(e) => setSoundValue(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {synthPresets.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}

            {soundType === 'speech' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Idioma da Locução</label>
                  <select
                    id="trigger-form-voice-lang"
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value as 'pt-BR' | 'en-US')}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (United States)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Fraze Personalizada (Opcional)</label>
                  <input
                    id="trigger-form-speech-value"
                    type="text"
                    placeholder="Vazio para usar anúncio dinâmico automático"
                    value={soundValue}
                    onChange={(e) => setSoundValue(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Use o texto vazio para inteligência pré-programada que anuncia o nome de cada impressora.
                  </span>
                </div>
              </div>
            )}

            {soundType === 'upload' && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-center">
                <FileAudio className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <label className="block text-xs text-zinc-400 mb-2">Selecione seu arquivo de áudio (MP3, WAV, OGG)</label>
                <input
                  id="trigger-form-file-upload"
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                <button
                  id="btn-upload-file"
                  type="button"
                  onClick={() => document.getElementById('trigger-form-file-upload')?.click()}
                  className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-xs font-semibold text-zinc-100 rounded-md transition-colors"
                >
                  {uploadProgress ? 'Carregando...' : soundValue ? 'Alterar Arquivo' : 'Escolher Arquivo'}
                </button>
                {soundValue && (
                  <div className="text-[10px] text-emerald-400 mt-2 font-semibold">
                    ✓ Áudio carregado e persistido no banco local!
                  </div>
                )}
              </div>
            )}

            {soundType === 'url' && (
              <div>
                <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Link URL de Áudio</label>
                <input
                  id="trigger-form-url-value"
                  type="url"
                  required
                  placeholder="https://exemplo.com/alerta.mp3"
                  value={soundValue}
                  onChange={(e) => setSoundValue(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Descrição</label>
              <textarea
                id="trigger-form-description"
                placeholder="Exemplo de utilidade deste alerta..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-2">
              <span className="text-xs text-zinc-400">Ativado ao carregar</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="trigger-form-enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={() => setEnabled(!enabled)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 border border-zinc-700" />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                id="btn-save-trigger"
                type="submit"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors border border-emerald-500/20"
              >
                <Save className="w-4 h-4" /> Salvar Gatilho
              </button>
              <button
                id="btn-test-sound-trigger"
                type="button"
                onClick={() => {
                  triggerSoundAlert(
                    soundType,
                    soundValue,
                    'Goku',
                    name === 'Print Started' ? 'print_started' : name === 'Print Done' ? 'print_done' : name === 'Print Failed' ? 'print_failed' : name === 'Print Pause' ? 'print_pause' : name === 'Filament Change' ? 'filament_change' : 'custom_alert',
                    voiceLanguage
                  );
                }}
                className="px-3.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 rounded-lg transition-colors"
                title="Testar Som Imediatamente"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Right side: triggers list */}
      <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="mb-4">
            <h2 className="font-sans font-bold text-lg text-white">Eventos & Respostas de Áudio</h2>
            <p className="font-sans text-xs text-zinc-400 mt-0.5">
              Configure as strings de escuta. Ao detectar estas assinaturas nas respostas de GCode do console, o reprodutor acionará o som programado.
            </p>
          </div>

          <div className="space-y-3">
            {triggers.map((trigger) => (
              <div
                key={trigger.id}
                id={`trigger-card-list-${trigger.id}`}
                className={`p-4 rounded-xl border transition-all ${
                  trigger.enabled
                    ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-950/40 border-zinc-850 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-sans font-semibold text-sm text-zinc-100">{trigger.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap uppercase ${
                        trigger.soundType === 'speech' 
                          ? 'bg-sky-950 text-sky-400 border border-sky-900/60' 
                          : trigger.soundType === 'synth' 
                          ? 'bg-purple-950 text-purple-400 border border-purple-900/60' 
                          : trigger.soundType === 'upload'
                          ? 'bg-amber-950 text-amber-400 border border-amber-900/60'
                          : 'bg-teal-950 text-teal-400 border border-teal-900/60'
                      }`}>
                        {trigger.soundType === 'speech' 
                          ? `Foz TTS (${trigger.voiceLanguage})` 
                          : trigger.soundType === 'synth' 
                          ? 'Sintetizador' 
                          : trigger.soundType === 'upload' 
                          ? 'Arquivo Local' 
                          : 'Web URL'}
                      </span>
                    </div>
                    <span className="inline-block mt-1 bg-zinc-900 font-mono text-xs text-emerald-400 px-2 py-0.5 rounded border border-zinc-800">
                      Termo filtrado: "{trigger.pattern}"
                    </span>
                    {trigger.description && (
                      <p className="font-sans text-xs text-zinc-500 mt-2 leading-relaxed">
                        {trigger.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      id={`btn-play-trigger-${trigger.id}`}
                      title="Reproduzir alerta de áudio no painel"
                      type="button"
                      onClick={() => onTestTriggerSound(trigger)}
                      className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Play className="w-4 h-4 fill-current text-emerald-500" />
                    </button>
                    <button
                      id={`btn-edit-trigger-${trigger.id}`}
                      title="Configurar áudio"
                      type="button"
                      onClick={() => handleEdit(trigger)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {/* Disallow deleting core defaults (t1-t5) to prevent breaking key workflow */}
                    {!['t1', 't2', 't3', 't4', 't5'].includes(trigger.id) && (
                      <button
                        id={`btn-delete-trigger-${trigger.id}`}
                        title="Deletar Gatilho"
                        type="button"
                        onClick={() => onDeleteTrigger(trigger.id)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-955/20 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500">Ação de Som:</span>
                    <span className="text-[10px] text-zinc-300 font-mono tracking-tight max-w-[200px] truncate">
                      {trigger.soundType === 'synth' && `preset: ${trigger.soundValue}`}
                      {trigger.soundType === 'speech' && (trigger.soundValue ? `"${trigger.soundValue}"` : `Dinâmico (Automático)`)}
                      {trigger.soundType === 'upload' && `Arquivo Salvo (Base64)`}
                      {trigger.soundType === 'url' && trigger.soundValue}
                    </span>
                  </div>

                  {/* Tiny Quick Toggle */}
                  <button
                    id={`btn-toggle-trigger-${trigger.id}`}
                    type="button"
                    onClick={() => {
                      onUpdateTrigger({
                        ...trigger,
                        enabled: !trigger.enabled
                      });
                    }}
                    className={`p-1 rounded text-xs px-2 font-sans font-semibold transition-colors ${
                      trigger.enabled 
                        ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750' 
                        : 'bg-zinc-950 text-zinc-600 hover:bg-zinc-900'
                    }`}
                  >
                    {trigger.enabled ? 'Ativo' : 'Pausado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-emerald-950/10 border border-emerald-900/20 rounded-xl flex items-start gap-2.5 mt-6 font-sans">
          <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-semibold text-xs text-emerald-300">Como funciona no console do Klipper?</h5>
            <p className="text-[11px] text-emerald-400/80 mt-1 leading-relaxed">
              Dentro do seu arquivo de macros no Klipper (geralmente <code className="font-mono bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 text-[10px]/normal select-all">printer.cfg</code> ou <code className="font-mono bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 text-[10px]/normal select-all">macros.cfg</code>), você pode incluir instruções que imprimem no console. Por exemplo:
              <br />
              <code className="font-mono bg-zinc-950/80 text-zinc-400 text-[10px] block p-1.5 mt-1 rounded leading-normal select-all whitespace-pre">
                {"[gcode_macro START_PRINT]\ngcode:\n  RESPOND TYPE=echo MSG=\"// print_started\""}
              </code>
              <br />
              Este painel ouvirá esses ecos via rede local instantaneamente e emitirá os avisos de som sem necessitar de macros em Python no MacOS!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
