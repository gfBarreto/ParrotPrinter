/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer } from '../types';
import { Play, Square, Settings, HardDrive, Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2, Edit } from 'lucide-react';

interface PrinterCardProps {
  printer: Printer;
  onToggleEnabled: (id: string) => void;
  onEdit: (printer: Printer) => void;
  onDelete: (id: string) => void;
  onManualConnect: (id: string) => void;
  key?: string | number;
}

export function PrinterCard({
  printer,
  onToggleEnabled,
  onEdit,
  onDelete,
  onManualConnect
}: PrinterCardProps) {
  const getStatusColor = (status: Printer['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500 border-emerald-400';
      case 'connecting':
        return 'bg-amber-500 border-amber-400';
      case 'error':
        return 'bg-rose-500 border-rose-400';
      default:
        return 'bg-zinc-500 border-zinc-400';
    }
  };

  const getStatusLabel = (status: Printer['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'error':
        return 'Erro de Conexão';
      default:
        return 'Desconectado';
    }
  };

  const formattedTime = printer.lastSeen 
    ? new Date(printer.lastSeen).toLocaleTimeString() 
    : 'Nunca';

  return (
    <div 
      id={`printer-card-${printer.id}`}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden transition-all duration-300 hover:border-zinc-750"
    >
      {/* Top Background Pattern */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-zinc-800/20 to-transparent pointer-events-none rounded-bl-3xl" />

      {/* Header */}
      <div className="flex items-start justify-between relative z-10 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-sans font-semibold text-lg text-white tracking-tight">{printer.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-sans border/10 ${
              printer.enabled 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
            }`}>
              {printer.enabled ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="font-mono text-xs text-zinc-400 mt-1 select-all">
            {printer.ip}:{printer.port}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            id={`btn-edit-${printer.id}`}
            title="Editar Impressora"
            onClick={() => onEdit(printer)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            id={`btn-delete-${printer.id}`}
            title="Deletar Impressora"
            onClick={() => onDelete(printer.id)}
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Network Connection status */}
      <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-850 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {printer.connectionStatus === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
            )}
            {printer.connectionStatus === 'connecting' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-450 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor(printer.connectionStatus)}`}></span>
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider font-sans">Status</div>
            <div className="font-sans font-medium text-sm text-zinc-200">
              {getStatusLabel(printer.connectionStatus)}
            </div>
          </div>
        </div>

        {printer.enabled ? (
          <button
            id={`btn-reconnect-${printer.id}`}
            onClick={() => onManualConnect(printer.id)}
            disabled={printer.connectionStatus === 'connecting'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-semibold text-zinc-200 rounded-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${printer.connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
            Reconectar
          </button>
        ) : (
          <button
            id={`btn-enable-${printer.id}`}
            onClick={() => onToggleEnabled(printer.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-emerald-900 border border-zinc-750 text-xs font-semibold text-zinc-200 rounded-md transition-colors"
          >
            Ativar Monitor
          </button>
        )}
      </div>

      {/* Metrics / Details */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-850/60">
          <div className="text-[10px] text-zinc-500 font-sans uppercase font-bold">Última Resposta</div>
          <div className="font-mono text-xs text-zinc-300 mt-0.5">{formattedTime}</div>
        </div>
        <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-850/60">
          <div className="text-[10px] text-zinc-500 font-sans uppercase font-bold">Dados Lidos</div>
          <div className="font-mono text-xs text-zinc-300 mt-0.5">
            {printer.bytesReceived ? `${(printer.bytesReceived / 1024).toFixed(1)} KB` : '0 KB'}
          </div>
        </div>
      </div>

      {/* Error detail notification if present */}
      {printer.connectionStatus === 'error' && printer.errorDetails && (
        <div className="flex items-start gap-2 p-2.5 bg-rose-955 border border-rose-900 rounded-lg text-rose-300 text-xs mt-2 relative">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span className="font-sans line-clamp-2" title={printer.errorDetails}>
            {printer.errorDetails}
          </span>
        </div>
      )}

      {/* Bottom Switch toggle */}
      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4 mt-2">
        <span className="text-xs text-zinc-400 font-sans font-medium">Habilitar escuta remota</span>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            id={`toggle-enable-input-${printer.id}`}
            type="checkbox"
            checked={printer.enabled}
            onChange={() => onToggleEnabled(printer.id)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white border border-zinc-700" />
        </label>
      </div>
    </div>
  );
}
