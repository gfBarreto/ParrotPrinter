/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthPreset, SoundType } from '../types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Synthesizes a high-quality electronic tone using standard Web Audio API
 */
export function playSynth(preset: SynthPreset | string) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (preset === 'chime-up') {
      // Ascending chime arpeggio (success / print started)
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const timeOffset = idx * 0.12;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gainNode.gain.setValueAtTime(0, now + timeOffset);
        gainNode.gain.linearRampToValueAtTime(0.15, now + timeOffset + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.5);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.6);
      });
    } else if (preset === 'chime-down' || preset === 'chime-down') {
      // Descending mellow chime
      const freqs = [880.00, 698.46, 587.33, 440.00]; // A5, F5, D5, A4
      freqs.forEach((freq, idx) => {
        const timeOffset = idx * 0.15;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gainNode.gain.setValueAtTime(0, now + timeOffset);
        gainNode.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.4);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.5);
      });
    } else if (preset === 'alarm-loop') {
      // High frequency double alert siren (failure / halt)
      const duration = 0.8;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      // Sweep pitch up and down
      osc.frequency.linearRampToValueAtTime(880, now + 0.2);
      osc.frequency.linearRampToValueAtTime(330, now + 0.4);
      osc.frequency.linearRampToValueAtTime(880, now + 0.6);
      osc.frequency.linearRampToValueAtTime(440, now + duration);

      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } else if (preset === 'beep-multiple') {
      // Quick double high alert beep (filament change / pause)
      [0, 0.2, 0.4].forEach((timeOffset) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now + timeOffset);

        gainNode.gain.setValueAtTime(0, now + timeOffset);
        gainNode.gain.linearRampToValueAtTime(0.15, now + timeOffset + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.12);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.15);
      });
    } else if (preset === 'laser') {
      // Laser sweep down (funny arcade feel)
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.4);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Default simple clean beep
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

/**
 * Speaks an alert message aloud in Portuguese or English using Text-to-Speech
 */
export function playSpeech(text: string, lang: 'pt-BR' | 'en-US' = 'pt-BR') {
  try {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech Synthesis not supported in this browser.');
      return;
    }

    // Cancel anything currently playing to prevent pile-up
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find an appropriate voice match
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(
      (v) => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase()
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Text-to-speech failed:', err);
  }
}

/**
 * Play standard audio files, either online URLs or base64 file data
 */
export function playAudioUrlOrBase64(source: string) {
  try {
    const audio = new Audio(source);
    audio.volume = 0.8;
    audio.play().catch((err) => {
      console.warn('Audio file playback blocked or failed:', err);
    });
  } catch (err) {
    console.warn('Failed to load/play audio source:', err);
  }
}

/**
 * Master controller to play sound based on trigger rules
 */
export function triggerSoundAlert(
  soundType: SoundType,
  soundValue: string,
  printerName: string,
  triggerName: string,
  lang: 'pt-BR' | 'en-US' = 'pt-BR'
) {
  if (soundType === 'synth') {
    playSynth(soundValue);
  } else if (soundType === 'speech') {
    // Generate spoken sentence
    let speechText = '';
    if (lang === 'pt-BR') {
      const phrasesSet: Record<string, string> = {
        'print_started': `Impressão iniciada na impressora ${printerName}.`,
        'print_done': `Atenção! A impressora ${printerName} concluiu a impressão com sucesso!`,
        'print_failed': `Alerta! Falha na impressão da impressora ${printerName}! Verifique por favor.`,
        'print_pause': `A impressora ${printerName} foi pausada.`,
        'filament_change': `Hora de trocar o filamento na impressora ${printerName}.`,
      };
      
      speechText = soundValue || phrasesSet[triggerName] || `Alerta da impressora ${printerName}: ${triggerName}`;
    } else {
      const phrasesSet: Record<string, string> = {
        'print_started': `Print started on printer ${printerName}.`,
        'print_done': `Attention! Printer ${printerName} has successfully completed the print!`,
        'print_failed': `Alert! Print failed on printer ${printerName}! Please check.`,
        'print_pause': `Printer ${printerName} has been paused.`,
        'filament_change': `Time to change the filament on printer ${printerName}.`,
      };
      
      speechText = soundValue || phrasesSet[triggerName] || `Alert on printer ${printerName}: ${triggerName}`;
    }

    playSpeech(speechText, lang);
  } else if (soundType === 'upload') {
    // soundValue contains base64 string
    playAudioUrlOrBase64(soundValue);
  } else if (soundType === 'url') {
    // soundValue contains external http link
    playAudioUrlOrBase64(soundValue);
  }
}
