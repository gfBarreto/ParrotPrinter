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
  bytesReceived?: number;
  lastSeen?: string;
}

interface EventTrigger {
  id: string;
  name: string;
  pattern: string;
  soundType: 'synth' | 'speech' | 'upload' | 'url';
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
const connectionDetails = new Map<string, { ip: string; port: number }>();

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

// OS Audio Player using encoded PowerShell scripts for maximum escape-safety and reliability
function playLocalSystemAlert(trigger: EventTrigger, printerName: string, consoleLine: string) {
  if (process.platform !== 'win32') {
    console.log(`[Sound Bypassed] Alerta local faria som no Windows: "${trigger.name}" para a impressora ${printerName}`);
    return;
  }

  let psScript = '';

  if (trigger.soundType === 'synth') {
    const preset = trigger.soundValue;
    // We play built-in Windows WAV sounds using SoundPlayer for 100% guarantee that they play through default audio card/speakers (instead of motherboard pc beeper)
    if (preset === 'chime-up') {
      psScript = `
        $player = New-Object System.Media.SoundPlayer;
        $player.SoundLocation = "C:\\Windows\\Media\\Speech On.wav";
        if (Test-Path $player.SoundLocation) { $player.PlaySync() } else { [System.Media.SystemSounds]::Asterisk.Play() }
      `;
    } else if (preset === 'chime-down') {
      psScript = `
        $player = New-Object System.Media.SoundPlayer;
        $player.SoundLocation = "C:\\Windows\\Media\\Speech Off.wav";
        if (Test-Path $player.SoundLocation) { $player.PlaySync() } else { [System.Media.SystemSounds]::Hand.Play() }
      `;
    } else if (preset === 'alarm-loop') {
      psScript = `
        $player = New-Object System.Media.SoundPlayer;
        $player.SoundLocation = "C:\\Windows\\Media\\Alarm01.wav";
        if (-not (Test-Path $player.SoundLocation)) { $player.SoundLocation = "C:\\Windows\\Media\\Ring01.wav" };
        if (-not (Test-Path $player.SoundLocation)) { $player.SoundLocation = "C:\\Windows\\Media\\notify.wav" };
        if (Test-Path $player.SoundLocation) { 
          For ($i=0; $i -lt 3; $i++) { $player.PlaySync() }
        } else {
          For ($i=0; $i -lt 5; $i++) { [System.Media.SystemSounds]::Beep.Play(); Start-Sleep -Milliseconds 300 }
        }
      `;
    } else if (preset === 'beep-multiple') {
      psScript = `
        $player = New-Object System.Media.SoundPlayer;
        $player.SoundLocation = "C:\\Windows\\Media\\notify.wav";
        if (Test-Path $player.SoundLocation) {
          For ($i=0; $i -lt 3; $i++) { $player.PlaySync(); Start-Sleep -Milliseconds 80 }
        } else {
          For ($i=0; $i -lt 3; $i++) { [System.Media.SystemSounds]::Beep.Play(); Start-Sleep -Milliseconds 150 }
        }
      `;
    } else if (preset === 'laser') {
      psScript = `
        try {
          For ($f=1200; $f -gt 300; $f-=150) { [console]::beep($f, 40) }
        } catch {
          [System.Media.SystemSounds]::Asterisk.Play()
        }
      `;
    } else {
      psScript = `[System.Media.SystemSounds]::Beep.Play()`;
    }
  } else if (trigger.soundType === 'speech') {
    // Generate vocalized TTS
    let speakText = trigger.soundValue;
    if (!speakText) {
      if (trigger.name === 'Print Started') {
        speakText = `Impressão iniciada na impressora ${printerName}`;
      } else if (trigger.name === 'Print Done') {
        speakText = `Atenção! A impressora ${printerName} concluiu a impressão com sucesso!`;
      } else if (trigger.name === 'Print Failed') {
        speakText = `Alerta! Falha na impressão da impressora ${printerName}! Verifique por favor.`;
      } else if (trigger.name === 'Print Pause') {
        speakText = `A impressora ${printerName} foi pausada.`;
      } else if (trigger.name === 'Filament Change') {
        speakText = `Hora de trocar o filamento na impressora ${printerName}.`;
      } else {
        speakText = `Alerta customizado na impressora ${printerName}`;
      }
    }

    const cleanMsg = speakText.replace(/['"$;`()]/g, ''); // Clear quotes and control characters
    const voiceLang = trigger.voiceLanguage || 'pt-BR';

    psScript = `
      try {
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq '${voiceLang}' } | Select-Object -First 1;
        if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) };
        $synth.Speak("${cleanMsg}");
      } catch {
        [System.Media.SystemSounds]::Beep.Play()
      }
    `;
  } else if (trigger.soundType === 'upload' && trigger.soundValue.startsWith('data:audio/')) {
    try {
      const match = trigger.soundValue.match(/^data:audio\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'mpeg' ? 'mp3' : match[1];
        const base64Data = match[2];
        const tempFileName = `temp_alert_${trigger.id}.${ext}`;
        const tempFilePath = path.join(process.cwd(), tempFileName);
        
        fs.writeFileSync(tempFilePath, Buffer.from(base64Data, 'base64'));
        const escapedPath = tempFilePath.replace(/\\/g, '\\\\');

        psScript = `
          try {
            $player = New-Object -ComObject WMPlayer.OCX.7;
            $player.URL = "${escapedPath}";
            $player.controls.play();
            $count = 0;
            while ($player.playState -ne 1 -and $count -lt 35) { Start-Sleep -Milliseconds 200; $count++ }
          } catch {
            [System.Media.SystemSounds]::Asterisk.Play();
          } finally {
            if (Test-Path "${escapedPath}") { Remove-Item "${escapedPath}" -Force }
          }
        `;
      } else {
        psScript = `[System.Media.SystemSounds]::Asterisk.Play()`;
      }
    } catch (err) {
      console.error(`[Acoustic Driver] Falha ao processar arquivo de áudio carregado base64:`, err);
      psScript = `[System.Media.SystemSounds]::Asterisk.Play()`;
    }
  } else if (trigger.soundType === 'url' && trigger.soundValue) {
    const cleanUrl = trigger.soundValue.replace(/["'$;`]/g, '');
    const ext = cleanUrl.split('.').pop()?.split('?')[0] || 'mp3';
    const tempFileName = `temp_url_alert_${trigger.id}.${ext}`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    const escapedPath = tempFilePath.replace(/\\/g, '\\\\');

    psScript = `
      try {
        $webClient = New-Object System.Net.WebClient;
        $webClient.DownloadFile("${cleanUrl}", "${escapedPath}");
        if (Test-Path "${escapedPath}") {
          $player = New-Object -ComObject WMPlayer.OCX.7;
          $player.URL = "${escapedPath}";
          $player.controls.play();
          $count = 0;
          while ($player.playState -ne 1 -and $count -lt 35) { Start-Sleep -Milliseconds 200; $count++ }
        }
      } catch {
        [System.Media.SystemSounds]::Asterisk.Play();
      } finally {
        if (Test-Path "${escapedPath}") { Remove-Item "${escapedPath}" -Force }
      }
    `;
  } else {
    psScript = `[System.Media.SystemSounds]::Beep.Play()`;
  }

  // Execute using -EncodedCommand for 100% robust string/quote escaping on Windows Command Prompt
  if (psScript) {
    const utf16leBuffer = Buffer.from(psScript.trim(), 'utf16le');
    const base64Command = utf16leBuffer.toString('base64');
    const command = `powershell -NoProfile -EncodedCommand ${base64Command}`;

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(`[Acoustic Driver] Falha ao executar som em segundo plano:`, err.message);
      } else {
        console.log(`[Acoustic Driver] Alerta sonoro de segundo plano executado com sucesso (${trigger.soundType}) para a impressora "${printerName}".`);
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
    connectionDetails.delete(id);
  }

  // Clear timers
  if (reconnectTimers.has(id)) {
    clearTimeout(reconnectTimers.get(id)!);
    reconnectTimers.delete(id);
  }

  if (!printer.enabled) return;

  const wsUrl = `ws://${printer.ip}:${printer.port}/websocket`;
  console.log(`[Monitor Background] Tentando escuta direta em "${printer.name}" (${printer.ip}:${printer.port})...`);

  try {
    const ws = new NodeWebSocket(wsUrl, { handshakeTimeout: 5000 });
    activeConnections.set(id, ws);
    connectionDetails.set(id, { ip: printer.ip, port: printer.port });

    ws.on('open', () => {
      console.log(`[Monitor Background] Conectado e monitorando em segundo plano: "${printer.name}"!`);
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
                console.log(`[Monitor Background] Gatilho "${trig.name}" ativado por: "${line}"`);
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
      console.log(`[Monitor Background] Erro na conexao com a impressora "${printer.name}". Certifique-se que ela esta online.`);
    });

    ws.on('close', () => {
      console.log(`[Monitor Background] Conexão com "${printer.name}" perdida. Reconectando em 15s...`);
      activeConnections.delete(id);
      connectionDetails.delete(id);
      
      const timer = setTimeout(() => {
        connectBackgroundPrinter(printer);
      }, 15000);
      reconnectTimers.set(id, timer);
    });

  } catch (err) {
    console.warn(`[Monitor Background] Falha ao criar tunel WebSocket para "${printer.name}":`, err);
    const timer = setTimeout(() => {
      connectBackgroundPrinter(printer);
    }, 15000);
    reconnectTimers.set(id, timer);
  }
}

// Sincroniza conexoes de background
function rebuildConnections() {
  // Clear any timers
  for (const [id, timer] of reconnectTimers.entries()) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();

  // Close connections that are no longer enabled
  for (const [id, ws] of activeConnections.entries()) {
    const p = printers.find(x => x.id === id);
    if (!p || !p.enabled) {
      try {
        ws.close();
      } catch {}
      activeConnections.delete(id);
      connectionDetails.delete(id);
      console.log(`[Monitor Background] Desativada escuta para a impressora ID: ${id}`);
    }
  }

  // Connect or reconnect modified printers
  printers.forEach((p) => {
    if (p.enabled) {
      const activeWs = activeConnections.get(p.id);
      const details = connectionDetails.get(p.id);
      
      // If we don't have connection or IP/port changed, rebuild!
      if (!activeWs || !details || details.ip !== p.ip || details.port !== p.port) {
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
