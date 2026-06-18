/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Printer {
  id: string;
  name: string;
  ip: string;
  port: number;
  enabled: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorDetails?: string;
  lastSeen?: string;
  bytesReceived?: number;
  enabledTriggers?: string[];
}

export type SoundType = 'synth' | 'speech' | 'upload' | 'url';

export interface EventTrigger {
  id: string;
  name: string;
  pattern: string; // The text to search inside gcode responses (e.g. "// print_started" or "print_started")
  soundType: SoundType;
  soundValue: string; // Synth preset name, voice description, base64 audio data, or external URL
  voiceLanguage: 'pt-BR' | 'en-US';
  enabled: boolean;
  description: string;
  printerId?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string
  printerId: string;
  printerName: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  eventTriggerId?: string;
  eventTriggerName?: string;
  soundPlayed?: string;
}

export type SynthPreset = 'chime-up' | 'chime-down' | 'alarm-loop' | 'beep-multiple' | 'laser';
