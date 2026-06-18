/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Printer, LogEntry, EventTrigger } from '../types';
import { 
  PrinterCard 
} from './PrinterCard';
import { 
  Activity, Radio, Terminal, Settings, Database, Plus, Play, 
  HelpCircle, Volume2, ShieldAlert, BadgeInfo, Download, Upload, Eye
} from 'lucide-react';
import { exportDatabase, importDatabase } from '../utils/storage';

interface DashboardViewProps {
  printers: Printer[];
  logs: LogEntry[];
  triggers: EventTrigger[];
  activePrinterId: string;
  setActivePrinterId: (id: string) => void;
  terminalLines: Record<string, string[]>;
  onTogglePrinterEnabled: (id: string) => void;
  onAddPrinter: (printer: Omit<Printer, 'id' | 'connectionStatus'>) => void;
  onUpdatePrinter: (printer: Printer) => void;
  onDeletePrinter: (id: string) => void;
  onManualConnect: (id: string) => void;
  onBackupRestoreChange: () => void;
  audioBlockerActive: boolean;
  clearAudioBlocker: () => void;
  onSimulateLine?: (printerId: string, line: string) => void;
}

export function DashboardView({
  printers,
  logs,
  triggers,
  activePrinterId,
  setActivePrinterId,
  terminalLines,
  onTogglePrinterEnabled,
  onAddPrinter,
  onUpdatePrinter,
  onDeletePrinter,
  onManualConnect,
  onBackupRestoreChange,
  audioBlockerActive,
  clearAudioBlocker,
  onSimulateLine
}: DashboardViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isBackupSectionOpen, setIsBackupSectionOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(true);

  // New simulation input state
  const [customSimLine, setCustomSimLine] = useState('');

  // Add Printer Form States
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterIp, setNewPrinterIp] = useState('');
  const [newPrinterPort, setNewPrinterPort] = useState(7125);

  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);

  const handleSubmitPrinter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrinterName || !newPrinterIp) return;

    if (editingPrinterId) {
      const existing = printers.find(p => p.id === editingPrinterId);
      if (existing) {
        onUpdatePrinter({
          ...existing,
          name: newPrinterName,
          ip: newPrinterIp,
          port: newPrinterPort
        });
      }
      setEditingPrinterId(null);
    } else {
      onAddPrinter({
        name: newPrinterName,
        ip: newPrinterIp,
        port: newPrinterPort,
        enabled: true
      });
    }

    setNewPrinterName('');
    setNewPrinterIp('');
    setNewPrinterPort(7125);
    setShowAddForm(false);
  };

  const startEditPrinter = (printer: Printer) => {
    setEditingPrinterId(printer.id);
    setNewPrinterName(printer.name);
    setNewPrinterIp(printer.ip);
    setNewPrinterPort(printer.port);
    setShowAddForm(true);
  };

  const handleExportDB = () => {
    const dataStr = exportDatabase();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `klipper_hub_config_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const success = importDatabase(content);
        if (success) {
          alert('Configurações e Logs importados com sucesso! A página atualizará para recarregar.');
          onBackupRestoreChange();
        } else {
          alert('Erro ao importar o banco de dados. Verifique a integridade do JSON.');
        }
      }
    };
    reader.readAsText(file);
  };

  const activeConnectedCount = printers.filter(p => p.enabled && p.connectionStatus === 'connected').length;
  const totalEnabledCount = printers.filter(p => p.enabled).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Informação sobre Execução Local vs Nuvem */}
      {isHelpOpen && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 text-zinc-300">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <BadgeInfo className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-sm text-zinc-200">
                Como executar seu Monitor de Áudio em Segundo Plano no Windows
              </h3>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="text-zinc-550 hover:text-zinc-350 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-zinc-850 hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              Ocultar Guia
            </button>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-3">
            Você pode liberar o navegador e deixar o Monitor de Áudio Klipper rodando de forma 100% invisível em segundo plano no Windows. Toda a automação de beeps, voz (TTS) e áudios continuará tocando localmente:
          </p>
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 text-[11px] space-y-2 font-sans font-medium">
            <ol className="list-decimal list-inside space-y-1.5 text-zinc-450">
              <li>Clique para exportar em <strong className="text-zinc-200">"Configurações" &gt; "Download ZIP"</strong> na barra superior para baixar os arquivos do app.</li>
              <li>Certifique-se de ter o <strong className="text-zinc-200">Node.js</strong> instalado no seu computador local.</li>
              <li>
                <span className="text-zinc-300 font-semibold">Modo Visível comum:</span> Dê dois cliques no arquivo <strong className="text-emerald-400 font-mono">rodar-no-windows.bat</strong> para ligá-lo e abrir interface web.
              </li>
              <li>
                <span className="text-sky-400 font-semibold">Modo Silencioso (Seguindo Plano):</span> Dê dois cliques em <strong className="text-sky-400 font-mono">rodar-oculto.vbs</strong>. O monitor iniciará sem abrir janelas de terminal (CMD) e continuará processando bips e áudios na sua máquina mesmo com o navegador fechado!
              </li>
              <li>
                <span className="text-rose-400 font-semibold">Para Encerrar o Monitor Oculto:</span> Basta dar dois cliques no arquivo <strong className="text-rose-450 font-mono">parar-sistema-oculto.bat</strong> para finalizar todos os processos de background.
              </li>
            </ol>
          </div>
          <p className="text-xs text-zinc-500 mt-2 text-right">
            💡 Você também pode testar os bips e vozes geradas diretamente no site usando a <strong>Bancada de Testes de G-code Simulada</strong> abaixo!
          </p>
        </div>
      )}

      {/* Audio Activation Alert bar */}
      {audioBlockerActive && (
        <button
          onClick={clearAudioBlocker}
          className="w-full flex items-center justify-between p-4 bg-emerald-900 border border-emerald-600 rounded-xl text-emerald-100 hover:bg-emerald-850 cursor-pointer transition-all duration-300 animate-pulse font-sans shadow-lg"
          id="btn-clear-audio-block"
        >
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-emerald-300" />
            <div className="text-left">
              <div className="font-bold text-sm">Controle de Som Bloqueado pelo Navegador</div>
              <div className="text-xs text-emerald-300">Clique em qualquer lugar deste aviso para autorizar a reprodução dos sintetizadores e vozes.</div>
            </div>
          </div>
          <span className="bg-emerald-950 px-3 py-1 rounded-md text-xs font-semibold text-emerald-300 select-none">
            Autorizar Áudio
          </span>
        </button>
      )}

      {/* Grid status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connection status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-semibold uppercase">Status de Rede</div>
            <div className="font-bold text-lg text-white">
              {activeConnectedCount} / {totalEnabledCount} Conectadas
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Escuta em tempo real ativa</p>
          </div>
        </div>

        {/* Database alerts */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-semibold uppercase">Log Local</div>
            <div className="font-bold text-lg text-white">{logs.length} Eventos</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Gravando no navegador</p>
          </div>
        </div>

        {/* Listen triggers count */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-semibold uppercase">Gatilhos</div>
            <div className="font-bold text-lg text-white">
              {triggers.filter(t => t.enabled).length} Ativos
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">{triggers.length} padrões programados</p>
          </div>
        </div>

        {/* System parameters */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-semibold uppercase">Plataforma</div>
            <div className="font-bold text-lg text-white">Windows Hub</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Substituto local para macOS</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Printers cards + Consol Terminal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Printers columns */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-white tracking-tight">Monitor de Impressoras</h2>
            <button
              id="btn-show-add-printer"
              onClick={() => {
                setEditingPrinterId(null);
                setNewPrinterName('');
                setNewPrinterIp('');
                setNewPrinterPort(7125);
                setShowAddForm(!showAddForm);
              }}
              className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-xs font-semibold text-zinc-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
              {showAddForm ? 'Fechar Form' : 'Adicionar Impressora'}
            </button>
          </div>

          {showAddForm && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg animate-fadeIn">
              <h3 className="font-bold text-sm text-zinc-100 mb-3">
                {editingPrinterId ? 'Alterar Impressora' : 'Nova Impressora Klipper'}
              </h3>
              <form onSubmit={handleSubmitPrinter} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-semibold mb-1 uppercase tracking-wider">Apelido (Nome)</label>
                  <input
                    id="printer-form-name"
                    type="text"
                    required
                    placeholder="Ex: Goku"
                    value={newPrinterName}
                    onChange={(e) => setNewPrinterName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-850 rounded text-sm text-zinc-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 font-semibold mb-1 uppercase tracking-wider">Endereço IP</label>
                  <input
                    id="printer-form-ip"
                    type="text"
                    required
                    placeholder="Ex: 172.16.1.12"
                    value={newPrinterIp}
                    onChange={(e) => setNewPrinterIp(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-850 rounded text-sm text-zinc-200 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 font-semibold mb-1 uppercase tracking-wider">Porta API / Websocket</label>
                  <div className="flex gap-2">
                    <input
                      id="printer-form-port"
                      type="number"
                      required
                      value={newPrinterPort}
                      onChange={(e) => setNewPrinterPort(parseInt(e.target.value) || 7125)}
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-850 rounded text-sm text-zinc-200 focus:outline-none font-mono"
                    />
                    <button
                      id="btn-submit-printer"
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white rounded transition-colors"
                    >
                      {editingPrinterId ? 'Salvar' : 'Conectar'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Printers flex grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {printers.map((printer) => (
              <PrinterCard
                key={printer.id}
                printer={printer}
                onToggleEnabled={onTogglePrinterEnabled}
                onEdit={startEditPrinter}
                onDelete={onDeletePrinter}
                onManualConnect={onManualConnect}
              />
            ))}

            {printers.length === 0 && (
              <div className="col-span-2 text-center py-12 px-4 border border-dashed border-zinc-800 rounded-xl">
                <Radio className="w-10 h-10 text-zinc-650 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-sans mb-3">Nenhuma impressora configurada.</p>
                <button
                  id="btn-add-initial-printer"
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg hover:bg-zinc-750 transition-colors"
                >
                  Adicionar Primeira Impressora
                </button>
              </div>
            )}
          </div>

          {/* Seção do Simulador de Gcode */}
          {onSimulateLine && printers.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-zinc-100">Bancada de Testes de G-code Simulada</h3>
                </div>
                <span className="bg-emerald-950 px-2 py-0.5 rounded text-[9px] font-bold text-emerald-400 border border-emerald-900/40 uppercase tracking-widest">
                  Modo Demonstração
                </span>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                Envie dados de console falsos para a impressora <strong className="text-zinc-200">"{printers.find(p => p.id === activePrinterId)?.name || printers[0].name}"</strong> para ver a mágica sonará do hub em tempo real, mesmo na nuvem!
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onSimulateLine(activePrinterId || printers[0].id, "M117 Print Started")}
                  className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-[11px] font-semibold text-zinc-200 px-3 py-2 rounded-lg transition-all"
                >
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />
                  Simular "Início"
                </button>

                <button
                  onClick={() => onSimulateLine(activePrinterId || printers[0].id, "M117 Print Done")}
                  className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-[11px] font-semibold text-zinc-200 px-3 py-2 rounded-lg transition-all"
                >
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Simular "Sucesso"
                </button>

                <button
                  onClick={() => onSimulateLine(activePrinterId || printers[0].id, "M117 Filament Change")}
                  className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-[11px] font-semibold text-zinc-200 px-3 py-2 rounded-lg transition-all"
                >
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Simular "Trocar Filamento"
                </button>

                <button
                  onClick={() => onSimulateLine(activePrinterId || printers[0].id, "Print Failed - Heater Timeout")}
                  className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-[11px] font-semibold text-zinc-200 px-3 py-2 rounded-lg transition-all"
                >
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                  Simular "Falha"
                </button>
              </div>

              {/* Custom simulated line */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Injete qualquer G-code ou resposta de terminal... (Ex: BEEP, M600, etc)"
                  value={customSimLine}
                  onChange={(e) => setCustomSimLine(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customSimLine.trim()) {
                      onSimulateLine(activePrinterId || printers[0].id, customSimLine.trim());
                      setCustomSimLine('');
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-550 focus:outline-none focus:border-emerald-500/50 flex-1 font-mono"
                />
                <button
                  onClick={() => {
                    if (customSimLine.trim()) {
                      onSimulateLine(activePrinterId || printers[0].id, customSimLine.trim());
                      setCustomSimLine('');
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-550 text-xs font-bold text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Injetar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Console / Terminal Section on Right Column */}
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Terminal de G-Code
            </h2>
            <select
              id="console-printer-selector"
              value={activePrinterId}
              onChange={(e) => setActivePrinterId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-350 rounded px-2.5 py-1 select-none focus:outline-none focus:border-zinc-700"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {printers.length === 0 && <option value="">Sem Impressoras</option>}
            </select>
          </div>

          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 shadow-inner flex flex-col h-[340px] justify-between relative overflow-hidden">
            {/* Console Screen */}
            <div className="font-mono text-[11px] text-zinc-400 space-y-1.5 overflow-y-auto flex-1 scrollbar-thin scroll-smooth select-all pr-2">
              {activePrinterId && terminalLines[activePrinterId]?.length > 0 ? (
                terminalLines[activePrinterId].map((line, idx) => (
                  <div key={idx} className="leading-5 border-l-2 border-zinc-850/60 pl-2 py-0.5 hover:bg-zinc-900/40 rounded transition-colors break-all">
                    <span className="text-zinc-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    <span className={line.includes('//') ? 'text-emerald-400 font-semibold' : 'text-zinc-350'}>
                      {line}
                    </span>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-550 select-none">
                  <Terminal className="w-8 h-8 text-zinc-750 mb-2" />
                  <p>Aguardando dados G-code...</p>
                  <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-wider">Selecione uma impressora conectada para inspecionar</p>
                </div>
              )}
            </div>

            {/* Simulated status ribbon */}
            <div className="border-t border-zinc-900/80 pt-3 mt-3 flex items-center justify-between text-[10px] text-zinc-550 select-none">
              <span>Websocket moonraker feed</span>
              <span className="font-semibold text-emerald-500 animate-pulse">● ESCUTA_ATIVA</span>
            </div>
          </div>
          
          {/* DB Control Options */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3.5">
            <button
              id="btn-toggle-backup-restore"
              onClick={() => setIsBackupSectionOpen(!isBackupSectionOpen)}
              className="w-full flex items-center justify-between font-semibold text-xs text-zinc-300 hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-zinc-500" />
                Backup & Restauração do Banco
              </span>
              <span className="text-[10px] text-zinc-500 hover:underline">
                {isBackupSectionOpen ? 'Ocultar' : 'Abrir'}
              </span>
            </button>

            {isBackupSectionOpen && (
              <div className="grid grid-cols-2 gap-3 pb-1 animate-fadeIn">
                <button
                  id="btn-backup-export"
                  onClick={handleExportDB}
                  className="flex items-center justify-center gap-1 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 py-2 rounded font-sans font-semibold text-[11px] text-zinc-200"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" /> Exportar JSON
                </button>
                <div className="relative">
                  <input
                    id="btn-backup-import-input"
                    type="file"
                    accept=".json"
                    onChange={handleImportDB}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <button
                    id="btn-backup-import-placeholder"
                    type="button"
                    className="w-full flex items-center justify-center gap-1 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 py-2 rounded font-sans font-semibold text-[11px] text-zinc-200"
                  >
                    <Upload className="w-3.5 h-3.5 text-zinc-400" /> Importar JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
