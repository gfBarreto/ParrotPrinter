/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Printer, EventTrigger, LogEntry } from './types';
import { 
  loadPrinters, savePrinters, loadTriggers, saveTriggers, 
  loadLogs, clearLogs, addLog 
} from './utils/storage';
import { triggerSoundAlert } from './utils/audio';
import { DashboardView } from './components/DashboardView';
import { TriggerConfig } from './components/TriggerConfig';
import { LogTable } from './components/LogTable';
import { 
  Radio, ShieldAlert, Activity, Database, CheckSquare, Settings, 
  Bot, RefreshCw, Volume2, HelpCircle, HardDrive, LayoutDashboard, History, Sliders
} from 'lucide-react';

function checkLineMatchesPattern(line: string, pattern: string): boolean {
  const cleanLine = line.toLowerCase().trim();
  const cleanPattern = pattern.toLowerCase().trim();

  // 1. Direct case-insensitive match
  if (cleanLine.includes(cleanPattern)) {
    return true;
  }

  // 2. Flexible match for common Klipper comment outputs.
  // E.g., if pattern is "// print_started" and line is "// action:print_started" or just contains "print_started" as part of a gcode response.
  if (cleanPattern.startsWith('//')) {
    const keyword = cleanPattern.replace(/^\/\/\s*/, ''); // Extracts things like "print_started"
    if (keyword && cleanLine.includes(keyword)) {
      // Ensure the line has a comment identifier to confirm it's a printer status respond
      if (cleanLine.includes('//') || cleanLine.includes('action:') || cleanLine.includes('echo:')) {
        return true;
      }
    }
  }

  return false;
}

export default function App() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'triggers' | 'logs'>('dashboard');
  const [activePrinterId, setActivePrinterId] = useState<string>('');
  const [terminalLines, setTerminalLines] = useState<Record<string, string[]>>({});
  
  // Anti-blocking state since modern browser requirements block audio alerts before first page click
  const [audioBlockerActive, setAudioBlockerActive] = useState(true);

  // Connection refs to persist websockets and reconnect loops across re-renders
  const wsRef = useRef<Record<string, WebSocket>>({});
  const reconnectTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Fetch initial local DB seed
  useEffect(() => {
    const listPrinters = loadPrinters();
    const listTriggers = loadTriggers();
    const listLogs = loadLogs();

    setPrinters(listPrinters);
    setTriggers(listTriggers);
    setLogs(listLogs);

    if (listPrinters.length > 0) {
      setActivePrinterId(listPrinters[0].id);
    }

    // Set listener to unblock sound instantly on human body clicks anywhere
    const unblockAudio = () => {
      setAudioBlockerActive(false);
      // Resume browser's standard AudioContext
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const tempCtx = new AudioCtx();
          if (tempCtx.state === 'suspended') tempCtx.resume();
        }
      } catch (e) {
        console.warn('Silent context resume failed:', e);
      }
      document.removeEventListener('click', unblockAudio);
    };
    document.addEventListener('click', unblockAudio);

    return () => {
      document.removeEventListener('click', unblockAudio);
    };
  }, []);

  const updatePrinterState = (id: string, fields: Partial<Printer>) => {
    setPrinters(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
  };

  // Dedicated direct connect function
  const connectPrinter = (id: string, currentPrintersList?: Printer[]) => {
    const list = currentPrintersList || printers;
    const printer = list.find(p => p.id === id);
    if (!printer || !printer.enabled) return;

    // Remove any running connections or triggers for this card
    if (wsRef.current[id]) {
      try { wsRef.current[id].close(); } catch {}
      delete wsRef.current[id];
    }
    if (reconnectTimeoutRef.current[id]) {
      clearTimeout(reconnectTimeoutRef.current[id]);
      delete reconnectTimeoutRef.current[id];
    }

    updatePrinterState(id, { connectionStatus: 'connecting', errorDetails: undefined });

    const wsUrl = `ws://${printer.ip}:${printer.port}/websocket`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current[id] = ws;

      ws.onopen = () => {
        updatePrinterState(id, { connectionStatus: 'connected', errorDetails: undefined });
        
        // Subscribe to Moonraker objects parameters feed
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'printer.objects.subscribe',
          params: {},
          id: 1
        }));

        const nLog = addLog({
          printerId: id,
          printerName: printer.name,
          type: 'info',
          message: `Conexão WebSocket aberta e escutando Moonraker.`
        });
        setLogs(prev => [nLog, ...prev]);
      };

      ws.onmessage = (ev) => {
        // Increment statistics
        setPrinters(prev => prev.map(p => p.id === id ? {
          ...p,
          bytesReceived: (p.bytesReceived || 0) + ev.data.length,
          lastSeen: new Date().toISOString()
        } : p));

        try {
          const parsed = JSON.parse(ev.data);
          
          if (parsed.method === 'notify_gcode_response') {
            const lines = parsed.params || [];
            
            // Append lines to the specific printer G-Code console
            setTerminalLines(prev => ({
              ...prev,
              [id]: [...(prev[id] || []), ...lines].slice(-40)
            }));

            // Test line outputs against custom alert filters
            lines.forEach((line: string) => {
              // Iterate through cached triggers (look up state triggers directly)
              setTriggers(latestTriggers => {
                latestTriggers.forEach((trig) => {
                  if (trig.enabled && checkLineMatchesPattern(line, trig.pattern)) {
                    // Match found! Sound the alarm!
                    triggerSoundAlert(
                      trig.soundType, 
                      trig.soundValue, 
                      printer.name, 
                      trig.name === 'Print Started' ? 'print_started' : trig.name === 'Print Done' ? 'print_done' : trig.name === 'Print Failed' ? 'print_failed' : trig.name === 'Print Pause' ? 'print_pause' : trig.name === 'Filament Change' ? 'filament_change' : 'custom_alert', 
                      trig.voiceLanguage
                    );

                    // Document triggered alert inside db
                    const nLog = addLog({
                      printerId: id,
                      printerName: printer.name,
                      type: trig.name === 'Print Failed' ? 'error' : trig.name === 'Print Done' ? 'success' : 'warning',
                      message: `Aviso sonoro acionado! O console retornou: "${line}"`,
                      eventTriggerId: trig.id,
                      eventTriggerName: trig.name,
                      soundPlayed: trig.soundType === 'synth' ? `Sintetizador: ${trig.soundValue}` : trig.soundType === 'speech' ? 'Síntese de Voz (TTS)' : 'Áudio'
                    });
                    setLogs(prev => [nLog, ...prev]);
                  }
                });
                return latestTriggers;
              });
            });
          }
        } catch (err) {
          console.warn('Parsing frames failed:', err);
        }
      };

      ws.onerror = (e) => {
        updatePrinterState(id, { 
          connectionStatus: 'error', 
          errorDetails: `Erro de rede ou Moonraker fora do ar.` 
        });
      };

      ws.onclose = () => {
        // Grab current printer state to see if it remains enabled
        setPrinters(latestPrinters => {
          const currentPr = latestPrinters.find(p => p.id === id);
          if (currentPr && currentPr.enabled) {
            updatePrinterState(id, { connectionStatus: 'disconnected' });
            
            // Setup timed reconnect
            if (reconnectTimeoutRef.current[id]) clearTimeout(reconnectTimeoutRef.current[id]);
            reconnectTimeoutRef.current[id] = setTimeout(() => {
              connectPrinter(id, latestPrinters);
            }, 10000);
          } else {
            updatePrinterState(id, { connectionStatus: 'disconnected' });
          }
          return latestPrinters;
        });
      };

    } catch (err) {
      updatePrinterState(id, { 
        connectionStatus: 'error', 
        errorDetails: `Falha na inicialização do socket: ${(err as Error).message}` 
      });
    }
  };

  const disconnectPrinter = (id: string) => {
    if (reconnectTimeoutRef.current[id]) {
      clearTimeout(reconnectTimeoutRef.current[id]);
      delete reconnectTimeoutRef.current[id];
    }
    if (wsRef.current[id]) {
      try { wsRef.current[id].close(); } catch {}
      delete wsRef.current[id];
    }
    updatePrinterState(id, { connectionStatus: 'disconnected' });
  };

  const handleSimulateLine = (printerId: string, line: string) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) return;

    // Append to Gcode terminal console
    setTerminalLines(prev => ({
      ...prev,
      [printerId]: [...(prev[printerId] || []), line].slice(-40)
    }));

    // Trigger check
    triggers.forEach((trig) => {
      if (trig.enabled && checkLineMatchesPattern(line, trig.pattern)) {
        triggerSoundAlert(
          trig.soundType, 
          trig.soundValue, 
          printer.name, 
          trig.name === 'Print Started' ? 'print_started' : trig.name === 'Print Done' ? 'print_done' : trig.name === 'Print Failed' ? 'print_failed' : trig.name === 'Print Pause' ? 'print_pause' : trig.name === 'Filament Change' ? 'filament_change' : 'custom_alert', 
          trig.voiceLanguage
        );

        // Document triggered alert inside db
        const nLog = addLog({
          printerId: printerId,
          printerName: printer.name,
          type: trig.name === 'Print Failed' ? 'error' : trig.name === 'Print Done' ? 'success' : 'warning',
          message: `[Simulação] Aviso sonoro acionado! O console retornou: "${line}"`,
          eventTriggerId: trig.id,
          eventTriggerName: trig.name,
          soundPlayed: trig.soundType === 'synth' ? `Sintetizador: ${trig.soundValue}` : trig.soundType === 'speech' ? 'Síntese de Voz (TTS)' : 'Áudio'
        });
        setLogs(prev => [nLog, ...prev]);
      }
    });
  };

  // Connection manager trigger when table printers array changes
  useEffect(() => {
    if (printers.length === 0) return;

    printers.forEach((p) => {
      if (p.enabled) {
        // Start connection if not connected or connecting
        if (!wsRef.current[p.id]) {
          connectPrinter(p.id, printers);
        }
      } else {
        // Disconnect if active
        if (wsRef.current[p.id]) {
          disconnectPrinter(p.id);
        }
      }
    });

    // Cleanup disconnected printers that were removed from database
    Object.keys(wsRef.current).forEach((id) => {
      if (!printers.find((p) => p.id === id)) {
        if (reconnectTimeoutRef.current[id]) clearTimeout(reconnectTimeoutRef.current[id]);
        try { wsRef.current[id].close(); } catch {}
        delete wsRef.current[id];
      }
    });
  }, [printers.map(p => `${p.id}-${p.enabled}-${p.ip}-${p.port}`).join(',')]);

  // Clean disconnect on teardown
  useEffect(() => {
    return () => {
      Object.keys(wsRef.current).forEach((id) => {
        if (reconnectTimeoutRef.current[id]) clearTimeout(reconnectTimeoutRef.current[id]);
        try { wsRef.current[id].close(); } catch {}
      });
    };
  }, []);

  const handleTogglePrinterEnabled = (id: string) => {
    const updated = printers.map((p) => {
      if (p.id === id) {
        const nextEnabled = !p.enabled;
        return { ...p, enabled: nextEnabled };
      }
      return p;
    });
    setPrinters(updated);
    savePrinters(updated);

    // If turned off, disconnect instantly
    const target = updated.find(p => p.id === id);
    if (target && !target.enabled) {
      disconnectPrinter(id);
    }
  };

  const handleAddPrinter = (p: Omit<Printer, 'id' | 'connectionStatus'>) => {
    const newPrinter: Printer = {
      ...p,
      id: `p-${Date.now()}`,
      connectionStatus: 'disconnected'
    };
    const updated = [...printers, newPrinter];
    setPrinters(updated);
    savePrinters(updated);
    if (!activePrinterId) setActivePrinterId(newPrinter.id);
  };

  const handleUpdatePrinter = (updatedPrinter: Printer) => {
    const updated = printers.map((p) => (p.id === updatedPrinter.id ? updatedPrinter : p));
    setPrinters(updated);
    savePrinters(updated);

    // Reconnect to update socket location
    connectPrinter(updatedPrinter.id, updated);
  };

  const handleDeletePrinter = (id: string) => {
    disconnectPrinter(id);
    const updated = printers.filter((p) => p.id !== id);
    setPrinters(updated);
    savePrinters(updated);
    if (activePrinterId === id && updated.length > 0) {
      setActivePrinterId(updated[0].id);
    }
  };

  const handleAddTrigger = (t: Omit<EventTrigger, 'id'>) => {
    const newTrigger: EventTrigger = {
      ...t,
      id: `t-${Date.now()}`
    };
    const updated = [...triggers, newTrigger];
    setTriggers(updated);
    saveTriggers(updated);
  };

  const handleUpdateTrigger = (updatedTrigger: EventTrigger) => {
    const updated = triggers.map((t) => (t.id === updatedTrigger.id ? updatedTrigger : t));
    setTriggers(updated);
    saveTriggers(updated);
  };

  const handleDeleteTrigger = (id: string) => {
    const updated = triggers.filter((t) => t.id !== id);
    setTriggers(updated);
    saveTriggers(updated);
  };

  const handleClearLogs = () => {
    if (window.confirm('Tem certeza de que deseja limpar permanentemente todos os registros de log locais? Isto é irreversível.')) {
      clearLogs();
      setLogs([]);
    }
  };

  const handleTestTriggerSound = (trigger: EventTrigger) => {
    triggerSoundAlert(
      trigger.soundType,
      trigger.soundValue,
      'Goku (Teste)',
      trigger.name === 'Print Started' 
        ? 'print_started' 
        : trigger.name === 'Print Done' 
        ? 'print_done' 
        : trigger.name === 'Print Failed' 
        ? 'print_failed' 
        : trigger.name === 'Print Pause' 
        ? 'print_pause' 
        : trigger.name === 'Filament Change' 
        ? 'filament_change' 
        : 'custom_alert',
      trigger.voiceLanguage
    );
  };

  const handleManualConnect = (id: string) => {
    const p = printers.find(pr => pr.id === id);
    if (p) {
      // Force reconnect
      connectPrinter(id, printers);
    }
  };

  // Re-trigger reload from import file
  const handleReloadFromImport = () => {
    // Force simple page reload or manually fetch states
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row relative">
      {/* Left Sidebar Navigation Menu */}
      <aside className="w-full md:w-64 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col justify-between">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-md shadow-emerald-950/40">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-sm tracking-tight text-white leading-none">Klipper Audio Hub</h1>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase mt-1 block">Gerenciador Windows</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            <button
              id="sidebar-tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600/10 text-emerald-400 font-bold border border-emerald-500/15'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Painel Principal
            </button>

            <button
              id="sidebar-tab-triggers"
              onClick={() => setActiveTab('triggers')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'triggers'
                  ? 'bg-emerald-600/10 text-emerald-400 font-bold border border-emerald-500/15'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Gatilhos & Alertas
            </button>

            <button
              id="sidebar-tab-logs"
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'logs'
                  ? 'bg-emerald-600/10 text-emerald-400 font-bold border border-emerald-500/15'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <History className="w-4 h-4" />
              Logs de Telemetria
              {logs.length > 0 && (
                <span className="ml-auto bg-zinc-800 text-zinc-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {logs.length > 99 ? '99+' : logs.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer details */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-950/40 text-[11px] text-zinc-500 font-medium space-y-1 font-mono">
          <div className="flex items-center justify-between">
            <span>Escuta WebSocket:</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Ativa
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Sons Habilitados:</span>
            <span className={audioBlockerActive ? 'text-amber-500' : 'text-emerald-500'}>
              {audioBlockerActive ? 'Bloqueado 🔕' : 'Liberado 🔊'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
          <div>
            <h2 className="font-sans font-bold text-2xl text-white tracking-tight">
              {activeTab === 'dashboard' && 'Monitor de Impressão'}
              {activeTab === 'triggers' && 'Controle de Sons e Gatilhos'}
              {activeTab === 'logs' && 'Histórico do Banco de Logs'}
            </h2>
            <p className="font-sans text-xs text-zinc-400 mt-1">
              {activeTab === 'dashboard' && 'Status das conexões Moonraker na sua rede local.'}
              {activeTab === 'triggers' && 'Defina macros de console G-code, de bipes sintetizados até locutor TTS.'}
              {activeTab === 'logs' && 'Filtre, pesquise e exporte alarmes disparados pelas impressoras.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">UTC: {new Date().toISOString().substring(11, 19)}</span>
          </div>
        </header>

        {/* Tab Selection Panels */}
        {activeTab === 'dashboard' && (
          <DashboardView
            printers={printers}
            logs={logs}
            triggers={triggers}
            activePrinterId={activePrinterId}
            setActivePrinterId={setActivePrinterId}
            terminalLines={terminalLines}
            onTogglePrinterEnabled={handleTogglePrinterEnabled}
            onAddPrinter={handleAddPrinter}
            onUpdatePrinter={handleUpdatePrinter}
            onDeletePrinter={handleDeletePrinter}
            onManualConnect={handleManualConnect}
            onBackupRestoreChange={handleReloadFromImport}
            audioBlockerActive={audioBlockerActive}
            clearAudioBlocker={() => setAudioBlockerActive(false)}
            onSimulateLine={handleSimulateLine}
          />
        )}

        {activeTab === 'triggers' && (
          <TriggerConfig
            triggers={triggers}
            onAddTrigger={handleAddTrigger}
            onUpdateTrigger={handleUpdateTrigger}
            onDeleteTrigger={handleDeleteTrigger}
            onTestTriggerSound={handleTestTriggerSound}
          />
        )}

        {activeTab === 'logs' && (
          <LogTable
            logs={logs}
            printers={printers}
            onClearLogs={handleClearLogs}
            onPlaySound={(log) => {
              // Find the trigger by name or id to verify its sound setup
              const originalTrigger = triggers.find(t => t.id === log.eventTriggerId);
              if (originalTrigger) {
                handleTestTriggerSound(originalTrigger);
              } else {
                // Play standard synth default chime if trigger configuration was deleted
                triggerSoundAlert('synth', 'chime-up', log.printerName, 'custom_alert', 'pt-BR');
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
