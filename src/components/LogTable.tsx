/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { LogEntry, Printer } from '../types';
import { Search, Trash2, Download, AlertCircle, CheckCircle, Volume2, Info, Eye } from 'lucide-react';
import { triggerSoundAlert } from '../utils/audio';

interface LogTableProps {
  logs: LogEntry[];
  printers: Printer[];
  onClearLogs: () => void;
  onPlaySound: (log: LogEntry) => void;
  t: any;
  lang: any;
}

export function LogTable({ logs, printers, onClearLogs, onPlaySound, t, lang }: LogTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Filter logs based on inputs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (log.eventTriggerName && log.eventTriggerName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPrinter = selectedPrinterId === 'all' || log.printerId === selectedPrinterId;
      const matchesType = selectedType === 'all' || log.type === selectedType;
      return matchesSearch && matchesPrinter && matchesType;
    });
  }, [logs, searchTerm, selectedPrinterId, selectedType]);

  const getLogTypeStyling = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40',
          icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/20 text-amber-400 border-amber-900/40',
          icon: <AlertCircle className="w-4 h-4 text-amber-400" />
        };
      case 'error':
        return {
          bg: 'bg-rose-950/20 text-rose-400 border-rose-900/40',
          icon: <AlertCircle className="w-4 h-4 text-rose-400" />
        };
      default:
        return {
          bg: 'bg-zinc-800/40 text-zinc-300 border-zinc-800',
          icon: <Info className="w-4 h-4 text-zinc-400" />
        };
    }
  };

  const exportToCSV = () => {
    try {
      const header = ['ID', 'Data/Hora', 'Impressora', 'Nível', 'Mensagem', 'Gatilho Detectado', 'Som Reproduzido'];
      const rows = filteredLogs.map((log) => [
        log.id,
        new Date(log.timestamp).toLocaleString('pt-BR'),
        log.printerName,
        log.type.toUpperCase(),
        log.message.replace(/,/g, ' '),
        log.eventTriggerName || 'Nenhum',
        log.soundPlayed || 'Nenhum'
      ]);

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [header.join(','), ...rows.map(e => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `klipper_monitor_logs_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error exporting to CSV', e);
    }
  };

  return (
    <div id="log-table-container" className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-sans font-bold text-xl text-white tracking-tight">
            {lang === 'pt' ? 'Registro de Eventos (Logs)' : lang === 'es' ? 'Registro de Eventos (Logs)' : 'Event Logs History'}
          </h2>
          <p className="font-sans text-xs text-zinc-400 mt-1 font-medium">
            {lang === 'pt' 
              ? `Persistência local ativa. Total de ${logs.length} registros no banco local.` 
              : lang === 'es' 
              ? `Persistencia local activa. Total de ${logs.length} registros en la base local.` 
              : `Local persistence active. Total of ${logs.length} records in local storage.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {filteredLogs.length > 0 && (
            <button
              id="btn-export-logs"
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-xs font-bold text-zinc-200 rounded-lg transition-colors border border-zinc-700/50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-zinc-400" /> {lang === 'pt' ? 'Exportar CSV' : lang === 'es' ? 'Exportar CSV' : 'Export CSV'}
            </button>
          )}
          <button
            id="btn-clear-logs"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-955/20 hover:bg-rose-955/40 border border-rose-900/30 text-xs font-bold text-rose-350 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> {lang === 'pt' ? 'Limpar Banco' : lang === 'es' ? 'Limpiar Base' : 'Clear Database'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            id="log-search-input"
            type="text"
            placeholder={lang === 'pt' ? 'Pesquisar log ou gatilho...' : lang === 'es' ? 'Buscar log o disparador...' : 'Search logs or trigger events...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>

        {/* Printer Filter */}
        <div>
          <select
            id="log-printer-filter"
            value={selectedPrinterId}
            onChange={(e) => setSelectedPrinterId(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500"
          >
            <option value="all">{lang === 'pt' ? 'Todas as Impressoras' : lang === 'es' ? 'Todas las Impresoras' : 'All Printers'}</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Status Type Filter */}
        <div>
          <select
            id="log-type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500"
          >
            <option value="all">{lang === 'pt' ? 'Todos os Níveis' : lang === 'es' ? 'Todos los Niveles' : 'All Levels'}</option>
            <option value="success">{lang === 'pt' ? 'Sucesso (Eventos)' : lang === 'es' ? 'Éxito (Eventos)' : 'Success (Events)'}</option>
            <option value="info">{lang === 'pt' ? 'Informação (Conexão)' : lang === 'es' ? 'Información (Conexión)' : 'Info (Connection)'}</option>
            <option value="warning">{lang === 'pt' ? 'Aviso (GCode)' : lang === 'es' ? 'Aviso (GCode)' : 'Warning (GCode)'}</option>
            <option value="error">{lang === 'pt' ? 'Erros' : lang === 'es' ? 'Errores' : 'Errors'}</option>
          </select>
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto rounded-lg border border-zinc-850 bg-zinc-950">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-850 bg-zinc-900/60 text-zinc-400 text-xs font-extrabold uppercase tracking-wide select-none">
              <th className="p-3.5 pl-4 w-[160px]">{lang === 'pt' ? 'Horário' : lang === 'es' ? 'Hora' : 'Time'}</th>
              <th className="p-3.5 w-[140px]">{lang === 'pt' ? 'Impressora' : lang === 'es' ? 'Impresora' : 'Printer'}</th>
              <th className="p-3.5 w-[100px]">{lang === 'pt' ? 'Nível' : lang === 'es' ? 'Nivel' : 'Level'}</th>
              <th className="p-3.5">{lang === 'pt' ? 'Log / GCode Response' : lang === 'es' ? 'Log / Respuesta GCode' : 'Log / GCode Response'}</th>
              <th className="p-3.5 w-[130px] text-right pr-4">{lang === 'pt' ? 'Gatilho / Som' : lang === 'es' ? 'Disparador / Sonido' : 'Trigger / Sound'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const styling = getLogTypeStyling(log.type);
                return (
                  <tr 
                    key={log.id} 
                    id={`log-row-${log.id}`}
                    className="hover:bg-zinc-900/30 text-sm transition-colors text-zinc-300 pointer-events-auto"
                  >
                    <td className="p-3 pl-4 font-mono text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 font-sans font-bold text-zinc-300 whitespace-nowrap">
                      {log.printerName}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-black uppercase whitespace-nowrap ${styling.bg}`}>
                        {styling.icon}
                        {log.type === 'success' 
                          ? (lang === 'pt' ? 'Evento' : lang === 'es' ? 'Evento' : 'Event') 
                          : log.type === 'info' 
                          ? (lang === 'pt' ? 'Sistema' : lang === 'es' ? 'Sistema' : 'System') 
                          : log.type === 'warning' 
                          ? (lang === 'pt' ? 'Aviso' : lang === 'es' ? 'Aviso' : 'Warning') 
                          : (lang === 'pt' ? 'Erro' : lang === 'es' ? 'Error' : 'Error')}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs break-all max-w-[400px]">
                      {log.message}
                    </td>
                    <td className="p-3 text-right pr-4">
                      {log.eventTriggerName ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="text-right">
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold block whitespace-nowrap">
                              {log.eventTriggerName}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono block mt-0.5 uppercase tracking-wide">
                              {log.soundPlayed}
                            </span>
                          </div>
                          <button
                            id={`btn-replay-${log.id}`}
                            title={lang === 'pt' ? 'Tocar Alerta Novamente' : lang === 'es' ? 'Reproducir Alerta Nuevamente' : 'Replay Alarm Alert'}
                            onClick={() => onPlaySound(log)}
                            className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600 font-sans">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-12 text-center text-zinc-500 font-bold font-sans">
                  {lang === 'pt' ? 'Nenhum registro encontrado correspondente aos filtros.' : lang === 'es' ? 'No se encontraron registros que coincidan con los filtros.' : 'No log entries found matching selected filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
