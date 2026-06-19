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
import { translations, Language } from './translations';
// @ts-ignore
import logoUrl from './assets/images/regenerated_image_1781812433016.png';
import { 
  Radio, ShieldAlert, Activity, Database, CheckSquare, Settings, 
  Bot, RefreshCw, Volume2, HelpCircle, HardDrive, LayoutDashboard, History, Sliders, AlertTriangle
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

function ScreamingParrotIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Head and back of the parrot */}
      <path 
        d="M17 19c1.5-1 2-3 2-5.5 0-3-1.5-5.5-4-5.5h-1c-.5 0-1 .2-1.5.5C11.5 7.5 11 6 9.5 6" 
        className="text-emerald-400 fill-emerald-400/10"
      />
      {/* Plume of crest feathers */}
      <path d="M14 8c1-1.5 2.5-2 2.5-2" className="text-emerald-300" strokeWidth="1.5" />
      <path d="M12.5 8.5C13.5 7.5 14.5 7 14.5 7" className="text-emerald-300" strokeWidth="1" />
      
      {/* Eyeball of the parrot */}
      <circle cx="15.5" cy="11.5" r="1.2" className="fill-white stroke-none" />
      <circle cx="15.5" cy="11.5" r="0.5" className="fill-zinc-950 stroke-zinc-950" />

      {/* Parrot's Beak pointing to megaphone */}
      <path d="M12.5 11.5c-1-0.2-2.2 0.3-2.8 1l2.5 1.5c0.5-1.1 0.5-2.2 0.3-2.5z" fill="currentColor" className="text-amber-400 stroke-amber-400" />

      {/* Megaphone (held by the parrot at the beak/mouth area) */}
      {/* Cone of the Megaphone pointing forward/left */}
      <path d="M9.5 12.8 L5 10.5 L4.5 15.5 Z" fill="currentColor" className="text-zinc-300 stroke-zinc-400" strokeWidth="1" />
      {/* Megaphone bells/rim */}
      <ellipse cx="4.5" cy="13" rx="1.2" ry="2.5" fill="currentColor" className="text-rose-500 stroke-rose-450" strokeWidth="1" />
      {/* Handle */}
      <path d="M7.5 13.5 L7.8 16 L8.5 15.8" className="text-zinc-450 stroke-zinc-450" strokeWidth="1.5" />

      {/* Sound waves coming out of megaphone (completely static, no animation) */}
      <path d="M2.5 11a2.5 2.5 0 0 0 0 4" className="text-emerald-400" strokeWidth="1.5" />
      <path d="M1 9a5 5 0 0 0 0 8" className="text-emerald-500/80" strokeWidth="1" />
    </svg>
  );
}

export default function App() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'triggers' | 'logs'>('dashboard');
  const [activePrinterId, setActivePrinterId] = useState<string>('');
  const [terminalLines, setTerminalLines] = useState<Record<string, string[]>>({});
  const [globalTerminalLines, setGlobalTerminalLines] = useState<{ printerId: string, printerName: string, text: string, timestamp: string }[]>([]);
  
  // Anti-blocking state since modern browser requirements block audio alerts before first page click
  const [audioBlockerActive, setAudioBlockerActive] = useState(true);

  // States for system update action
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [versionInfo, setVersionInfo] = useState<{ currentVersion: string; latestVersion: string; hasUpdate: boolean } | null>(null);
  const [lang, setLang] = useState<Language>(() => {
    try {
      return (localStorage.getItem('parrot_lang') as Language) || 'pt';
    } catch {
      return 'pt';
    }
  });

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem('parrot_lang', newLang);
    } catch (e) {}
  };

  const t = translations[lang];

  const fetchVersionInfo = async () => {
    try {
      const response = await fetch('/api/system/version');
      if (response.ok) {
        const data = await response.json();
        setVersionInfo(data);
      }
    } catch (err) {
      console.warn("[Version Check] Erro ao carregar informacoes de versao:", err);
    }
  };

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  const handleUpdateSystem = async () => {
    setIsUpdating(true);
    setUpdateStatus(null);
    try {
      const response = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setUpdateStatus({ success: true, message: data.message });
      } else {
        setUpdateStatus({ success: false, message: data.message || 'Erro desconhecido ao tentar atualizar.' });
      }
    } catch (err) {
      setUpdateStatus({
        success: false,
        message: 'Não foi possível se comunicar com o servidor. Verifique se o backend está executando no terminal por meio de "rodar-no-windows.bat" ou se o Git está devidamente configurado nesta pasta.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Connection refs to persist websockets and reconnect loops across re-renders
  const wsRef = useRef<Record<string, WebSocket>>({});
  const reconnectTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const printersRef = useRef<Printer[]>([]);
  const triggersRef = useRef<EventTrigger[]>([]);

  useEffect(() => {
    printersRef.current = printers;
  }, [printers]);

  useEffect(() => {
    triggersRef.current = triggers;
  }, [triggers]);

  // Unlock audio blocker transparently on first click or keypress
  useEffect(() => {
    const clearBlocker = () => {
      setAudioBlockerActive(false);
      window.removeEventListener('click', clearBlocker);
      window.removeEventListener('keydown', clearBlocker);
    };
    window.addEventListener('click', clearBlocker);
    window.addEventListener('keydown', clearBlocker);
    return () => {
      window.removeEventListener('click', clearBlocker);
      window.removeEventListener('keydown', clearBlocker);
    };
  }, []);

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

    // Bidirectional sync: Restore client config from server, or upload client config to empty server
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data) {
          const serverPrinters = data.printers || [];
          const serverTriggers = data.triggers || [];

          // Case 1: Browser is completely empty, but server already has config (Restore from server file)
          if (listPrinters.length === 0 && serverPrinters.length > 0) {
            savePrinters(serverPrinters);
            setPrinters(serverPrinters);
            if (serverPrinters.length > 0) {
              setActivePrinterId(serverPrinters[0].id);
            }
          }
          if (listTriggers.length === 0 && serverTriggers.length > 0) {
            saveTriggers(serverTriggers);
            setTriggers(serverTriggers);
          }

          // Case 2: Browser has config, but server holds empty arrays (Push config to local server)
          if ((listPrinters.length > 0 || listTriggers.length > 0) && serverPrinters.length === 0 && serverTriggers.length === 0) {
            fetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ printers: listPrinters, triggers: listTriggers })
            }).catch(() => {});
          }
        }
      })
      .catch(err => console.debug('Bypassed background synchronizer (running in cloud context):', err));

    // Check if AudioContext is already running (auto-allowed or previously approved in session)
    try {
      const AudioCtx2 = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx2) {
        const testCtx = new AudioCtx2();
        if (testCtx.state === 'running') {
          setAudioBlockerActive(false);
          testCtx.close();
        }
      }
    } catch (e2) {}

    // Set listener to unblock sound instantly on any human interaction (click, key, touch, etc.)
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
      removeListeners();
    };

    const removeListeners = () => {
      document.removeEventListener('click', unblockAudio);
      document.removeEventListener('keydown', unblockAudio);
      document.removeEventListener('touchstart', unblockAudio);
      document.removeEventListener('mousedown', unblockAudio);
    };

    document.addEventListener('click', unblockAudio);
    document.addEventListener('keydown', unblockAudio);
    document.addEventListener('touchstart', unblockAudio);
    document.addEventListener('mousedown', unblockAudio);

    return () => {
      removeListeners();
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

            const currentPrDefault = printersRef.current.find(p => p.id === id);
            const printerName = currentPrDefault ? currentPrDefault.name : 'Impressora';
            setGlobalTerminalLines(prev => [
              ...prev,
              ...lines.map((line: string) => ({
                printerId: id,
                printerName,
                text: line,
                timestamp: new Date().toLocaleTimeString()
              }))
            ].slice(-100));

            // Test line outputs against custom alert filters
            lines.forEach((line: string) => {
              // Find latest printer setup
              const currentPr = printersRef.current.find(p => p.id === id);
              if (!currentPr) return;

              // Iterate through cached triggers (look up state triggers directly)
              setTriggers(latestTriggers => {
                latestTriggers.forEach((trig) => {
                  // Check if trigger belongs to this printer or is generic
                  const isTriggerForPrinter = !trig.printerId || trig.printerId === id;

                  if (trig.enabled && isTriggerForPrinter && checkLineMatchesPattern(line, trig.pattern)) {
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

    setGlobalTerminalLines(prev => [
      ...prev,
      {
        printerId,
        printerName: printer.name,
        text: line,
        timestamp: new Date().toLocaleTimeString()
      }
    ].slice(-100));

    // Trigger check
    triggers.forEach((trig) => {
      const isTriggerForPrinter = !trig.printerId || trig.printerId === printerId;

      if (trig.enabled && isTriggerForPrinter && checkLineMatchesPattern(line, trig.pattern)) {
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

    // Notify the background Node.js server to run simulation as well (playing powershell sounds locally)
    fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerId, line })
    }).catch(() => {});
  };

  // Debounced configurations sync to native local Node.js background monitor
  useEffect(() => {
    if (printers.length > 0 || triggers.length > 0) {
      const timeoutId = setTimeout(() => {
        fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ printers, triggers })
        }).catch(err => console.debug('Not running locally in background, bypassed back-end synch:', err));
      }, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [printers, triggers]);

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
          {/* Brand Logo Only (top) */}
          <div className="p-6 flex flex-col items-center justify-center border-b border-zinc-800">
            <div className="w-[220px] h-[220px] bg-transparent border-none p-0 overflow-hidden flex items-center justify-center transition-transform hover:scale-105 duration-300">
              <img 
                src={logoUrl} 
                alt="ParrotPrinter Logo" 
                className="w-full h-full object-contain bg-transparent border-none rounded-xl"
                referrerPolicy="no-referrer"
              />
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
              {t.tabDashboard}
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
              {t.tabTriggers}
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
              {t.tabLogs}
              {logs.length > 0 && (
                <span className="ml-auto bg-zinc-800 text-zinc-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {logs.length > 99 ? '99+' : logs.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer details */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-950/40 text-[11px] text-zinc-500 font-medium space-y-2.5 font-mono">
          <div className="font-sans pb-2 border-b border-zinc-850">
            <h1 className="font-bold text-sm tracking-tight text-white leading-none mb-1">ParrotPrinter</h1>
            <span className="text-[9px] text-emerald-400 font-extrabold tracking-wider uppercase block bg-emerald-950/45 border border-emerald-900/30 px-1.5 py-0.5 rounded leading-none w-max">
              {lang === 'pt' ? 'DADOS & SOM' : lang === 'es' ? 'DATOS Y SONIDO' : 'DATA & SOUND'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span>{lang === 'pt' ? 'Escuta WebSocket:' : lang === 'es' ? 'Escucha WebSocket:' : 'WebSocket Listener:'}</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {lang === 'pt' ? 'Ativa' : lang === 'es' ? 'Activa' : 'Active'}
            </span>
          </div>
          <div className="flex items-center justify-between font-sans">
            <span className="font-mono">{lang === 'pt' ? 'Sons Habilitados:' : lang === 'es' ? 'Sonidos Habilitados:' : 'Sounds Enabled:'}</span>
            <span className={audioBlockerActive ? 'text-amber-500' : 'text-emerald-500'}>
              {audioBlockerActive 
                ? (lang === 'pt' ? 'Bloqueado 🔕' : lang === 'es' ? 'Bloqueado 🔕' : 'Blocked 🔕') 
                : (lang === 'pt' ? 'Liberado 🔊' : lang === 'es' ? 'Permitido 🔊' : 'Allowed 🔊')}
            </span>
          </div>

          {/* Botão de Atualização com 1-Clique */}
          <div className="pt-2 border-t border-zinc-850/60 bg-transparent font-sans">
            <button
              onClick={handleUpdateSystem}
              disabled={isUpdating}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold select-none cursor-pointer border transition-all ${
                isUpdating 
                  ? 'bg-zinc-850 border-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-emerald-600/10 hover:bg-emerald-600/25 border-emerald-500/20 hover:border-emerald-500/45 text-emerald-400 active:translate-y-[1px]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? t.updating : (lang === 'pt' ? 'Atualizar Sistema' : lang === 'es' ? 'Actualizar Sistema' : 'Update System')}
            </button>
          </div>
        </div>
      </aside>

      {/* Modal de Status de Atualização */}
      {updateStatus && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              {updateStatus.success ? (
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <CheckSquare className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2.5 bg-red-500/10 text-red-400 rounded-lg">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {updateStatus.success ? t.updateCompleted : t.updateFailed}
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  {updateStatus.message}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setUpdateStatus(null);
                  if (updateStatus.success) {
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {updateStatus.success ? t.reloadPanel : t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
          <div>
            <h2 className="font-sans font-bold text-2xl text-white tracking-tight">
              {activeTab === 'dashboard' && 'ParrotPrinter'}
              {activeTab === 'triggers' && t.triggersTitle}
              {activeTab === 'logs' && t.eventHistoryTitle}
            </h2>
            <p className="font-sans text-xs text-zinc-400 mt-1">
              {activeTab === 'dashboard' && t.subtitleDashboard}
              {activeTab === 'triggers' && t.subtitleTriggers}
              {activeTab === 'logs' && t.subtitleLogs}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Idiomas */}
            <div className="flex items-center bg-zinc-900/60 border border-zinc-800 rounded-lg p-0.5" id="language-switcher">
              <button
                onClick={() => handleSetLang('pt')}
                title="Português"
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  lang === 'pt' ? 'bg-emerald-600 text-white font-extrabold' : 'text-zinc-500 hover:text-white'
                }`}
              >
                PT
              </button>
              <button
                onClick={() => handleSetLang('en')}
                title="English"
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  lang === 'en' ? 'bg-emerald-600 text-white font-extrabold' : 'text-zinc-500 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => handleSetLang('es')}
                title="Español"
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  lang === 'es' ? 'bg-emerald-600 text-white font-extrabold' : 'text-zinc-500 hover:text-white'
                }`}
              >
                ES
              </button>
            </div>

            {/* Versão (sempre visível) */}
            <div className="flex items-center gap-2 text-[10px] font-mono select-none px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full shadow-inner leading-none">
              <span className="text-zinc-500 font-semibold">v{versionInfo?.currentVersion || "1.1.0"}</span>
              {versionInfo?.hasUpdate ? (
                <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-amber-400 font-semibold block truncate max-w-[120px] sm:max-w-none">
                    {lang === 'pt' ? 'Nova' : lang === 'es' ? 'Nueva' : 'New'} v{versionInfo.latestVersion}!
                  </span>
                </div>
              ) : versionInfo ? (
                <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-2 text-zinc-500">
                  <span className="w-1 h-1 bg-emerald-500/60 rounded-full shrink-0" />
                  <span className="text-[9px] uppercase tracking-wider font-semibold">{t.updatedStatus}</span>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* Global Warning Banner for New Version */}
        {versionInfo?.hasUpdate && (
          <div className="mb-6 p-4 bg-amber-550/5 hover:bg-amber-550/10 border border-amber-500/25 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
            <div className="flex items-start md:items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">{t.newVersionTitle}</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  {t.newVersionMsg
                    .replace("{version}", `v${versionInfo.latestVersion}`)
                    .replace("{current}", `v${versionInfo.currentVersion}`)}
                </p>
              </div>
            </div>
            <button
              onClick={handleUpdateSystem}
              disabled={isUpdating}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 select-none shadow-md shrink-0 active:translate-y-[1px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? t.updating : t.updateButton}
            </button>
          </div>
        )}

        {/* Tab Selection Panels */}
        {activeTab === 'dashboard' && (
          <DashboardView
            printers={printers}
            logs={logs}
            triggers={triggers}
            activePrinterId={activePrinterId}
            setActivePrinterId={setActivePrinterId}
            terminalLines={terminalLines}
            globalTerminalLines={globalTerminalLines}
            onTogglePrinterEnabled={handleTogglePrinterEnabled}
            onAddPrinter={handleAddPrinter}
            onUpdatePrinter={handleUpdatePrinter}
            onDeletePrinter={handleDeletePrinter}
            onManualConnect={handleManualConnect}
            onBackupRestoreChange={handleReloadFromImport}
            audioBlockerActive={audioBlockerActive}
            clearAudioBlocker={() => setAudioBlockerActive(false)}
            onSimulateLine={handleSimulateLine}
            t={t}
            lang={lang}
          />
        )}

        {activeTab === 'triggers' && (
          <TriggerConfig
            triggers={triggers}
            printers={printers}
            onUpdatePrinter={handleUpdatePrinter}
            onAddTrigger={handleAddTrigger}
            onUpdateTrigger={handleUpdateTrigger}
            onDeleteTrigger={handleDeleteTrigger}
            onTestTriggerSound={handleTestTriggerSound}
            t={t}
            lang={lang}
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
                triggerSoundAlert('synth', 'chime-up', log.printerName, 'custom_alert', lang === 'es' ? 'en-US' : 'pt-BR');
              }
            }}
            t={t}
            lang={lang}
          />
        )}
      </main>
    </div>
  );
}
