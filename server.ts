import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { WebSocket as NodeWebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface Printer {
  id: string;
  name: string;
  ip: string;
  port: number;
  enabled: boolean;
  connectionStatus?: string;
}

interface EventTrigger {
  id: string;
  name: string;
  pattern: string;
  soundType: 'synth' | 'speech' | 'audio';
  soundValue: string;
  voiceLanguage?: 'pt-BR' | 'en-US';
  enabled: boolean;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), "klipper-hub-config.json");

// Load existing configs or initialize
let printers: Printer[] = [];
let triggers: EventTrigger[] = [];

try {
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.printers) printers = parsed.printers;
    if (parsed.triggers) triggers = parsed.triggers;
    console.log(`[Background Agent] Configuração carregada com sucesso (${printers.length} impressoras, ${triggers.length} gatilhos).`);
  }
} catch (err) {
  console.warn("[Background Agent] Falha ao carregar arquivo de configuração local, iniciando limpo:", err);
}

// Background Moonraker WS connection registry
const activeConnections = new Map<string, NodeWebSocket>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();

function checkLineMatchesPattern(line: string, pattern: string): boolean {
  const cleanLine = line.toLowerCase().trim();
  const cleanPattern = pattern.toLowerCase().trim();

  // 1. Direct match
  if (cleanLine.includes(cleanPattern)) return true;

  // 2. Comments or action keywords
  if (cleanPattern.startsWith('//')) {
    const keyword = cleanPattern.replace(/^\/\/\s*/, '');
    if (keyword && cleanLine.includes(keyword)) {
      if (cleanLine.includes('//') || cleanLine.includes('action:') || cleanLine.includes('echo:')) {
        return true;
      }
    }
  }
  return false;
}

// OS Audio Player using built-in PowerShell commands (no extra NPM dependencies required!)
function playLocalSystemAlert(trigger: EventTrigger, printerName: string, consoleLine: string) {
  if (process.platform !== 'win32') {
    console.log(`[Sound Bypassed] Alerta local faria som no Windows: "${trigger.name}" para a impressora ${printerName}`);
    return;
  }

  let psScript = '';

  if (trigger.soundType === 'synth') {
    const preset = trigger.soundValue;
    if (preset === 'chime-up') {
      psScript = `[console]::beep(523, 100); [console]::beep(659, 100); [console]::beep(784, 100); [console]::beep(1046, 150)`;
    } else if (preset === 'chime-down') {
      psScript = `[console]::beep(880, 120); [console]::beep(698, 120); [console]::beep(587, 120); [console]::beep(440, 150)`;
    } else if (preset === 'alarm-loop') {
      psScript = `For ($i=0; $i -lt 3; $i++) { [console]::beep(880, 150); [console]::beep(660, 150) }`;
    } else if (preset === 'beep-multiple') {
      psScript = `[console]::beep(1200, 80); Start-Sleep -Milliseconds 50; [console]::beep(1200, 80); Start-Sleep -Milliseconds 50; [console]::beep(1200, 80)`;
    } else if (preset === 'laser') {
      psScript = `For ($f=1500; $f -gt 240; $f-=120) { [console]::beep($f, 20) }`;
    } else {
      psScript = `[console]::beep(440, 300)`;
    }
  } else if (trigger.soundType === 'speech') {
    // Generate vocalized TTS
    let speakText = trigger.soundValue;
    if (!speakText) {
      if (trigger.name === 'Print Started') {
        speakText = `Impressão iniciada na ${printerName}`;
      } else if (trigger.name === 'Print Done') {
        speakText = `Impressão concluída na ${printerName}`;
      } else if (trigger.name === 'Print Failed') {
        speakText = `Atenção: A impressão na ${printerName} falhou`;
      } else if (trigger.name === 'Print Pause') {
        speakText = `A impressão na ${printerName} foi pausada`;
      } else if (trigger.name === 'Filament Change') {
        speakText = `Aviso: Troca de filamento necessária na ${printerName}`;
      } else {
        speakText = `Aviso acionado na impressora ${printerName}`;
      }
    }

    // Sanitize string to prevent PowerShell code injection
    const cleanMsg = speakText.replace(/[^a-zA-Z0-9 áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ:\-!,.]/g, '');
    const voiceLang = trigger.voiceLanguage || 'pt-BR';

    psScript = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq '${voiceLang}' } | Select-Object -First 1;
      if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) };
      $synth.Speak('${cleanMsg}');
    `.trim().replace(/\s+/g, ' ');
  } else {
    // Default simple Windows system chime
    psScript = `[System.Media.SystemSounds]::Beep.Play()`;
  }

  // Run the code
  if (psScript) {
    const command = `powershell -NoProfile -Command "${psScript}"`;
    exec(command, (err) => {
      if (err) {
        console.error(`[Acoustic Driver] Falha ao tocar som em segundo plano via PowerShell:`, err.message);
      } else {
        console.log(`[Acoustic Driver] Sucesso no som em segundo plano (${trigger.soundType}) para "${printerName}"!`);
      }
    });
  }
}

// Background Websocket Monitor Loop
function connectBackgroundPrinter(printer: Printer) {
  const id = printer.id;
  
  // Close any existing connection first
  if (activeConnections.has(id)) {
    try {
      activeConnections.get(id)?.close();
    } catch {}
    activeConnections.delete(id);
  }

  // Clear timers
  if (reconnectTimers.has(id)) {
    clearTimeout(reconnectTimers.get(id)!);
    reconnectTimers.delete(id);
  }

  if (!printer.enabled) return;

  const wsUrl = `ws://${printer.ip}:${printer.port}/websocket`;
  console.log(`[Monitor Background] Conectando ao Moonraker de "${printer.name}" (${printer.ip}:${printer.port})...`);

  try {
    const ws = new NodeWebSocket(wsUrl, { handshakeTimeout: 5000 });
    activeConnections.set(id, ws);

    ws.on('open', () => {
      console.log(`[Monitor Background] Conectado com sucesso em "${printer.name}"!`);
      // Subscribe to logs
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'printer.objects.subscribe',
        params: {},
        id: 1122
      }));
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.method === 'notify_gcode_response') {
          const lines: string[] = parsed.params || [];
          lines.forEach((line) => {
            // Compare each line with the live triggers list
            triggers.forEach((trig) => {
              if (trig.enabled && checkLineMatchesPattern(line, trig.pattern)) {
                console.log(`[Gatilho ATIVADO] "${trig.name}" correspondido em "${printer.name}": "${line}"`);
                playLocalSystemAlert(trig, printer.name, line);
              }
            });
          });
        }
      } catch (err) {
        // Safe bypass parsing failures
      }
    });

    ws.on('error', (err) => {
      console.log(`[Monitor Background] Erro de conexao em "${printer.name}" ou impressora offline.`);
    });

    ws.on('close', () => {
      console.log(`[Monitor Background] Conexao com "${printer.name}" fechada. Reconectando em 15s...`);
      activeConnections.delete(id);
      
      const timer = setTimeout(() => {
        connectBackgroundPrinter(printer);
      }, 15000);
      reconnectTimers.set(id, timer);
    });

  } catch (err) {
    console.warn(`[Monitor Background] Falha ao criar tunel WebSocket em "${printer.name}":`, err);
    const timer = setTimeout(() => {
      connectBackgroundPrinter(printer);
    }, 15000);
    reconnectTimers.set(id, timer);
  }
}

// Sincroniza todas as conexoes de background com as novas configuracoes do client
function rebuildConnections() {
  // Clear any timers
  for (const [id, timer] of reconnectTimers.entries()) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();

  // Close other connections not present or now disabled
  for (const [id, ws] of activeConnections.entries()) {
    const p = printers.find(x => x.id === id);
    if (!p || !p.enabled) {
      try {
        ws.close();
      } catch {}
      activeConnections.delete(id);
      console.log(`[Monitor Background] Conexao encerrada ou desabilitada para impressora ID ${id}.`);
    }
  }

  // Connect or re-evaluate enabled printers
  printers.forEach((p) => {
    if (p.enabled) {
      const activeWs = activeConnections.get(p.id);
      // If we don't have connection or IP/port changed, rebuild!
      if (!activeWs) {
        connectBackgroundPrinter(p);
      }
    }
  });
}

// Initial establish of Klipper webhooks
rebuildConnections();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // APIs para sincronizar e ler as configuracoes de impressoras e gatilhos da rede
  app.get("/api/config", (req, res) => {
    res.json({ printers, triggers });
  });

  app.post("/api/config", (req, res) => {
    const body = req.body;
    if (body) {
      if (Array.isArray(body.printers)) printers = body.printers;
      if (Array.isArray(body.triggers)) triggers = body.triggers;

      // Save to disk to remember setup on app restart automatically
      try {
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({ printers, triggers }, null, 2));
      } catch (err) {
        console.error("[Background Server] Erro ao salvar arquivo persistente de backup local:", err);
      }

      // Re-evaluate connections immediately based on modifications
      rebuildConnections();
      res.json({ success: true, message: "Modo background atualizado com sucesso!" });
    } else {
      res.status(400).json({ error: "Corpo incorreto" });
    }
  });

  // G-Code Simulated test bench proxy line simulation directly inside the background sound card engine too
  app.post("/api/simulate", (req, res) => {
    const { printerId, line } = req.body;
    if (!printerId || !line) {
      return res.status(400).json({ error: "Faltam argumentos" });
    }

    const printer = printers.find(p => p.id === printerId);
    if (!printer) {
      return res.status(404).json({ error: "Impressora nao encontrada" });
    }

    console.log(`[Simulação Background] Recebida simulacao manual para ${printer.name}: "${line}"`);

    // Compare and play audios on host machine
    triggers.forEach((trig) => {
      if (trig.enabled && checkLineMatchesPattern(line, trig.pattern)) {
        console.log(`[Simulação Background] Coincidencia detectada com "${trig.name}"!`);
        playLocalSystemAlert(trig, printer.name, line);
      }
    });

    res.json({ success: true, message: "Amostra simulada analisada e tocada no servidor se compativel!" });
  });

  // Vite integration pattern
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Backend] Rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
