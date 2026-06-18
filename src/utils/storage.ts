/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Printer, EventTrigger, LogEntry } from '../types';

const PRINTERS_KEY = 'klipper_monitor_printers';
const TRIGGERS_KEY = 'klipper_monitor_triggers';
const LOGS_KEY = 'klipper_monitor_logs';

// Default printer seeding exactly matching user's macOS setup
const DEFAULT_PRINTERS: Printer[] = [
  { id: '1', name: 'Goku', ip: '172.16.1.12', port: 7125, enabled: true, connectionStatus: 'disconnected' },
  { id: '2', name: 'Bumblebee', ip: '172.16.1.8', port: 7125, enabled: true, connectionStatus: 'disconnected' },
  { id: '3', name: 'SP5', ip: '172.16.1.5', port: 7125, enabled: true, connectionStatus: 'disconnected' },
  { id: '4', name: 'K1', ip: '172.16.1.9', port: 7125, enabled: true, connectionStatus: 'disconnected' }
];

// Default trigggers seeding
const DEFAULT_TRIGGERS: EventTrigger[] = [
  {
    id: 't1',
    name: 'Print Started',
    pattern: '// print_started',
    soundType: 'speech',
    soundValue: '', // Default auto formula in Portuguese: "Impressão iniciada na Goku"
    voiceLanguage: 'pt-BR',
    enabled: true,
    description: 'Disparado quando a impressora começa a imprimir um novo arquivo G-code.'
  },
  {
    id: 't2',
    name: 'Print Done',
    pattern: '// print_done',
    soundType: 'speech',
    soundValue: '',
    voiceLanguage: 'pt-BR',
    enabled: true,
    description: 'Disparado ao término bem-sucedido de uma impressão.'
  },
  {
    id: 't3',
    name: 'Print Failed',
    pattern: '// print_failed',
    soundType: 'synth',
    soundValue: 'alarm-loop',
    voiceLanguage: 'pt-BR',
    enabled: true,
    description: 'Disparado se a impressão falhar ou for cancelada por erro.'
  },
  {
    id: 't4',
    name: 'Print Pause',
    pattern: '// print_pause',
    soundType: 'speech',
    soundValue: '',
    voiceLanguage: 'pt-BR',
    enabled: true,
    description: 'Disparado ao pausar a execução da impressão.'
  },
  {
    id: 't5',
    name: 'Filament Change',
    pattern: '// filament_change',
    soundType: 'speech',
    soundValue: '',
    voiceLanguage: 'pt-BR',
    enabled: true,
    description: 'Disparado durante pedidos de troca manual de filamento.'
  }
];

export function loadPrinters(): Printer[] {
  const data = localStorage.getItem(PRINTERS_KEY);
  if (!data) {
    localStorage.setItem(PRINTERS_KEY, JSON.stringify(DEFAULT_PRINTERS));
    return DEFAULT_PRINTERS.map(p => ({ ...p, connectionStatus: 'disconnected' }));
  }
  try {
    const list = JSON.parse(data) as Printer[];
    // Ensure all start fresh as disconnected on reload
    return list.map(p => ({ ...p, connectionStatus: 'disconnected' }));
  } catch {
    return DEFAULT_PRINTERS;
  }
}

export function savePrinters(printers: Printer[]): void {
  // We sanitize connectionStatus so we don't save ephemeral connected states
  const cleaned = printers.map(p => {
    const { connectionStatus, ...rest } = p;
    return { ...rest, connectionStatus: 'disconnected' } as Printer;
  });
  localStorage.setItem(PRINTERS_KEY, JSON.stringify(cleaned));
}

export function loadTriggers(): EventTrigger[] {
  const data = localStorage.getItem(TRIGGERS_KEY);
  if (!data) {
    localStorage.setItem(TRIGGERS_KEY, JSON.stringify(DEFAULT_TRIGGERS));
    return DEFAULT_TRIGGERS;
  }
  try {
    return JSON.parse(data) as EventTrigger[];
  } catch {
    return DEFAULT_TRIGGERS;
  }
}

export function saveTriggers(triggers: EventTrigger[]): void {
  localStorage.setItem(TRIGGERS_KEY, JSON.stringify(triggers));
}

export function loadLogs(): LogEntry[] {
  const data = localStorage.getItem(LOGS_KEY);
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data) as LogEntry[];
  } catch {
    return [];
  }
}

export function saveLogs(logs: LogEntry[]): void {
  // Cap logs to last 1500 lines to preserve smooth operation and localStorage limits
  if (logs.length > 1500) {
    logs = logs.slice(0, 1500);
  }
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

export function addLog(log: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const logs = loadLogs();
  const newLog: LogEntry = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog); // Newer logs at the top
  saveLogs(logs);
  return newLog;
}

export function clearLogs(): void {
  localStorage.removeItem(LOGS_KEY);
}

// Backup and Restore capabilities for full local database management
export function exportDatabase(): string {
  const data = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    printers: loadPrinters(),
    triggers: loadTriggers(),
    logs: loadLogs()
  };
  return JSON.stringify(data, null, 2);
}

export function importDatabase(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') return false;

    if (Array.isArray(parsed.printers)) {
      localStorage.setItem(PRINTERS_KEY, JSON.stringify(parsed.printers.map((p: any) => ({
        ...p,
        connectionStatus: 'disconnected'
      }))));
    }
    if (Array.isArray(parsed.triggers)) {
      localStorage.setItem(TRIGGERS_KEY, JSON.stringify(parsed.triggers));
    }
    if (Array.isArray(parsed.logs)) {
      localStorage.setItem(LOGS_KEY, JSON.stringify(parsed.logs));
    }
    return true;
  } catch (e) {
    console.error('Failed to import database', e);
    return false;
  }
}
