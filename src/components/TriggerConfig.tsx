/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { EventTrigger, SoundType, SynthPreset, Printer } from '../types';
import { 
  Play, Plus, Trash2, Edit2, Volume2, Save, X, ToggleLeft, ToggleRight, 
  Settings, HelpCircle, FileAudio, Keyboard, Eye, ChevronRight
} from 'lucide-react';
import { triggerSoundAlert } from '../utils/audio';

interface TriggerConfigProps {
  triggers: EventTrigger[];
  printers: Printer[];
  onUpdatePrinter: (printer: Printer) => void;
  onAddTrigger: (trigger: Omit<EventTrigger, 'id'>) => void;
  onUpdateTrigger: (trigger: EventTrigger) => void;
  onDeleteTrigger: (id: string) => void;
  onTestTriggerSound: (trigger: EventTrigger) => void;
}

export function TriggerConfig({
  triggers,
  printers,
  onUpdatePrinter,
  onAddTrigger,
  onUpdateTrigger,
  onDeleteTrigger,
  onTestTriggerSound
}: TriggerConfigProps) {
  // Selected printer for individual triggers configuration
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(() => {
    return printers.length > 0 ? printers[0].id : '';
  });

  // Keep selectedPrinterId safe if printers change/load
  useEffect(() => {
    if (!selectedPrinterId && printers.length > 0) {
      setSelectedPrinterId(printers[0].id);
    }
  }, [printers, selectedPrinterId]);

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
    if (!name || !pattern || !selectedPrinterId) return;

    const data = {
      name,
      pattern,
      soundType,
      soundValue,
      voiceLanguage,
      enabled,
      description,
      printerId: selectedPrinterId
    };

    if (editingTriggerId) {
      const original = triggers.find(t => t.id === editingTriggerId);
      onUpdateTrigger({
        ...data,
        id: editingTriggerId,
        printerId: original?.printerId || selectedPrinterId
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

  const handleGenerateDefaultTriggers = () => {
    if (!selectedPrinterId) return;
    const activePrinter = printers.find(p => p.id === selectedPrinterId);
    const printerName = activePrinter ? activePrinter.name : 'Impressora';
    
    const defaults: Omit<EventTrigger, 'id'>[] = [
      {
        name: 'Início de Impressão',
        pattern: '// print_started',
        soundType: 'speech',
        soundValue: `Impressão iniciada na impressora ${printerName}`,
        voiceLanguage: 'pt-BR',
        enabled: true,
        description: `Disparado quando a ${printerName} começa a imprimir um novo arquivo G-code.`,
        printerId: selectedPrinterId
      },
      {
        name: 'Impressão Concluída',
        pattern: '// print_done',
        soundType: 'speech',
        soundValue: `Impressão concluída com sucesso na impressora ${printerName}`,
        voiceLanguage: 'pt-BR',
        enabled: true,
        description: `Disparado ao término bem-sucedido de uma impressão na ${printerName}.`,
        printerId: selectedPrinterId
      },
      {
        name: 'Falha na Impressão',
        pattern: '// print_failed',
        soundType: 'synth',
        soundValue: 'alarm-loop',
        voiceLanguage: 'pt-BR',
        enabled: true,
        description: `Disparado se a impressão da ${printerName} falhar ou for cancelada por erro.`,
        printerId: selectedPrinterId
      },
      {
        name: 'Impressão Pausada',
        pattern: '// print_pause',
        soundType: 'speech',
        soundValue: `Impressão pausada na impressora ${printerName}`,
        voiceLanguage: 'pt-BR',
        enabled: true,
        description: `Disparado ao pausar a execução da impressão na ${printerName}.`,
        printerId: selectedPrinterId
      },
      {
        name: 'Troca de Filamento',
        pattern: '// filament_change',
        soundType: 'speech',
        soundValue: `Atenção, a impressora ${printerName} solicita troca de filamento`,
        voiceLanguage: 'pt-BR',
        enabled: true,
        description: `Disparado durante pedidos de troca de filamento na ${printerName}.`,
        printerId: selectedPrinterId
      }
    ];

    defaults.forEach(trig => {
      onAddTrigger(trig);
    });
  };

  // Filter triggers only for the selected printer
  const visibleTriggers = triggers.filter((t) => {
    // If trigger has no printerId, assign it to the first printer id to maintain compatibility
    if (!t.printerId) {
      const fallbackId = printers.length > 0 ? printers[0].id : '1';
      return fallbackId === selectedPrinterId;
    }
    return t.printerId === selectedPrinterId;
  });

  const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

  const synthPresets: { value: SynthPreset; label: string }[] = [
    { value: 'chime-up', label: 'Sinos Crescente (Início)' },
    { value: 'chime-down', label: 'Sinos Decrescente (Troca)' },
    { value: 'alarm-loop', label: 'Alarme / Sirene Crítica (Falha)' },
    { value: 'beep-multiple', label: 'Duplo Beep Metálico (Pausa)' },
    { value: 'laser', label: 'Efeito Arcade Laser (Finalizado)' },
  ];

  return (
    <div className="space-y-6">
      {/* Printer Selection Row */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            Configuração de Alertas por Impressora
          </h2>
          <p className="text-xs text-zinc-400">Configure sons e frases personalizadas com o nome de cada impressora.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">Selecionar Impressora:</label>
          <select
            id="printer-config-selector"
            value={selectedPrinterId}
            onChange={(e) => {
              setSelectedPrinterId(e.target.value);
              resetForm();
            }}
            className="w-full md:w-64 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-bold uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {printers.map((pr) => (
              <option key={pr.id} value={pr.id} className="bg-zinc-900 text-zinc-100 font-bold uppercase tracking-wider">
                {pr.name} ({pr.ip})
              </option>
            ))}
            {printers.length === 0 && (
              <option value="">Nenhuma impressora cadastrada</option>
            )}
          </select>
        </div>
      </div>

      <div id="trigger-config-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side: Form for adding/editing */}
        <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg h-fit">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
            <h3 className="font-sans font-bold text-white text-base">
              {editingTriggerId ? 'Editar Detecção de Evento' : isAdding ? 'Novo Gatilho de Alerta' : 'Painel de Configuração'}
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

          {!selectedPrinterId ? (
            <div className="py-6 text-center text-zinc-500 text-xs italic">
              Adicione uma impressora na aba principal para configurar alertas.
            </div>
          ) : !(editingTriggerId || isAdding) ? (
            <div className="py-4 text-center">
              <p className="font-sans text-xs text-zinc-400 px-4 leading-relaxed">
                Adicione alertas individuais ou altere os existentes para a impressora <span className="text-emerald-400 font-bold font-mono">{(selectedPrinter?.name || '').toUpperCase()}</span>.
              </p>
              <button
                id="btn-new-trigger"
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-emerald-900/35 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Criar Novo Alerta
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 font-sans">
              <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/50 mb-2">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">Destinado para:</span>
                <span className="text-xs text-zinc-300 font-black font-mono tracking-wide">{(selectedPrinter?.name || '').toUpperCase()} ({selectedPrinter?.ip})</span>
              </div>

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
                    <HelpCircle className="w-3.5 h-3.5 text-zinc-650" />
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
                    <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">Frase Falar (Voz Sintética)</label>
                    <textarea
                      id="trigger-form-speech-value"
                      rows={3}
                      required
                      placeholder={`Ex: Impressão iniciada com sucesso na impressora ${selectedPrinter?.name || ''}`}
                      value={soundValue}
                      onChange={(e) => setSoundValue(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                      Dica: Digite exatamente o que você quer que o assistente fale ao detectar o sinal gcode desta impressora.
                    </p>
                  </div>
                </div>
              )}

              {soundType === 'upload' && (
                <div className="space-y-2 border border-dashed border-zinc-800 rounded-lg p-3 bg-zinc-950/30">
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">Escolher Arquivo MP3/WAV</label>
                  <input
                    id="trigger-form-file-value"
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                  {uploadProgress && (
                    <div className="text-[10px] text-amber-500 font-bold animate-pulse">Carregando arquivo...</div>
                  )}
                  {soundValue && !uploadProgress && (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      Áudio carregado e pronto!
                    </div>
                  )}
                </div>
              )}

              {soundType === 'url' && (
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase mb-1">URL de Áudio Online</label>
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
                  id="trigger-form-desc"
                  rows={2}
                  placeholder="Explicação do propósito desta notificação."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  id="btn-save-trigger"
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Alerta
                </button>
                <button
                  id="btn-preview-trigger-form"
                  type="button"
                  onClick={() => {
                    triggerSoundAlert(
                      soundType,
                      soundValue,
                      selectedPrinter?.name || 'Impressora Teste',
                      name === 'Print Started' ? 'print_started' : name === 'Print Done' ? 'print_done' : name === 'Print Failed' ? 'print_failed' : name === 'Print Pause' ? 'print_pause' : name === 'Filament Change' ? 'filament_change' : 'custom_alert',
                      voiceLanguage
                    );
                  }}
                  className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-colors cursor-pointer"
                  title="Testar Som Imediatamente"
                >
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right side: triggers list */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="font-sans font-bold text-lg text-white">Eventos & Respostas de Áudio</h2>
                <p className="font-sans text-xs text-zinc-400 mt-0.5">
                  Configure as strings de saída gcode. Ao detectar estas assinaturas no console da impressora selecionada, o som correspondente será tocado.
                </p>
              </div>
              <span className="text-[10px] text-emerald-400 font-extrabold tracking-wider bg-emerald-950/40 border border-emerald-900/30 px-2 py-1 rounded w-max select-none font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                {(selectedPrinter?.name || '').toUpperCase()}
              </span>
            </div>

            <div className="space-y-3">
              {visibleTriggers.map((trigger) => (
                <div
                  key={trigger.id}
                  id={`trigger-card-list-${trigger.id}`}
                  className={`p-4 rounded-xl border transition-all ${
                    trigger.enabled
                      ? 'bg-zinc-950 border-zinc-805 hover:border-zinc-700 shadow-md shadow-black/10'
                      : 'bg-zinc-950/40 border-zinc-900 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-sans font-bold text-sm text-zinc-150">{trigger.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap uppercase font-black ${
                          trigger.soundType === 'speech' 
                            ? 'bg-sky-950/60 text-sky-400 border border-sky-900/40' 
                            : trigger.soundType === 'synth' 
                            ? 'bg-purple-950/60 text-purple-400 border border-purple-900/40' 
                            : trigger.soundType === 'upload'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-900/40'
                            : 'bg-teal-950/60 text-teal-400 border border-teal-900/40'
                        }`}>
                          {trigger.soundType === 'speech' 
                            ? `Falar Voz TTS (${trigger.voiceLanguage})` 
                            : trigger.soundType === 'synth' 
                            ? 'Beeps Sintetizador' 
                            : trigger.soundType === 'upload' 
                            ? 'Arquivo de Áudio Upload' 
                            : 'Ficheiro Web URL'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-mono text-[11px] text-emerald-400 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded">
                          Termo de captura: "{trigger.pattern}"
                        </span>
                      </div>

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
                        className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {triggers.length > 1 && (
                        <button
                          id={`btn-delete-trigger-${trigger.id}`}
                          title="Deletar Gatilho"
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Excluir o alerta de evento "${trigger.name}" permanentemente?`)) {
                              onDeleteTrigger(trigger.id);
                            }
                          }}
                          className="p-1.5 text-zinc-500 hover:text-rose-450 hover:bg-rose-955/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Ação de Som Ativa:</span>
                      <span className="text-[10px] text-zinc-300 font-mono tracking-tight max-w-[280px] sm:max-w-[400px] truncate block">
                        {trigger.soundType === 'synth' && `preset: ${trigger.soundValue}`}
                        {trigger.soundType === 'speech' && (trigger.soundValue ? `"${trigger.soundValue}"` : `Dinâmico (Automático)`)}
                        {trigger.soundType === 'upload' && `Arquivo de Áudio Local`}
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
                      className={`p-1 rounded text-[10px] px-2 font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        trigger.enabled 
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750' 
                          : 'bg-zinc-950 text-zinc-650 hover:bg-zinc-900'
                      }`}
                    >
                      {trigger.enabled ? 'Ativo' : 'Parado'}
                    </button>
                  </div>
                </div>
              ))}

              {visibleTriggers.length === 0 && selectedPrinterId && (
                <div className="text-center py-12 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                  <Volume2 className="w-10 h-10 text-zinc-750 mx-auto mb-3" />
                  <p className="text-zinc-400 text-xs font-sans mb-1 font-bold">Sem alertas programados para esta impressora</p>
                  <p className="text-zinc-500 text-[11px] font-sans mb-5 max-w-sm mx-auto leading-relaxed">
                    Você pode adicionar gatilhos manuais, ou simplesmente criar um pacote completo de alarmes padrão com um único clique.
                  </p>
                  <button
                    id="btn-generate-default-triggers"
                    type="button"
                    onClick={handleGenerateDefaultTriggers}
                    className="px-4 py-2 bg-emerald-600/10 border border-emerald-900/40 text-emerald-400 hover:bg-emerald-600/20 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <Plus className="w-3.5 h-3.5" /> Criar Alertas Padrão Recomendados
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-emerald-950/10 border border-emerald-900/20 rounded-xl flex items-start gap-2.5 mt-6 font-sans select-none">
            <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-xs text-emerald-300">Como funciona o monitoramento por terminal?</h5>
              <p className="text-[11px] text-emerald-400/80 mt-1 leading-relaxed">
                As impressoras informam seu estado pela conexão WebSocket em tempo real. O monitor escuta as respostas e executa o sintetizador local ou a fala sintetizada com o nome do equipamento para alertar você no alto-falante onde quer que esteja!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
