# 🦜 ParrotPrinter

**Monitoramento por Voz e Alarmes de Áudio para Impressoras 3D (Klipper / Moonraker)**

ParrotPrinter é um assistente de voz e central de alarmes de áudio em tempo real para as suas impressoras 3D equipadas com Klipper/Moonraker. Ele detecta os códigos impressos ou mensagens de erro no console G-code e pronuncia de forma falada o nome da impressora correspondente e o evento atual ou dispara alarmes sonoros personalizados.

---

## 🛠️ Como Instalar e Executar o Projeto

Você pode rodar este projeto de forma automatizada no Windows (recomendado) ou de forma totalmente manual em qualquer sistema operacional (Linux, macOS, Windows).

### 🏷️ Opção 1: Inicialização em 1-Clique (Recomendado para Windows)

O projeto vem com scripts automatizados para facilitar a sua vida no Windows. Ele automaticamente baixa e configura o NodeJS, instala as dependências e abre o link no seu navegador do sistema.

1. Baixe o código fonte deste projeto (através da opção **Configurações > Download ZIP** no menu superior do AI Studio ou exportando para o GitHub).
2. Extraia o arquivo ZIP em uma pasta do seu computador.
3. Dê dois cliques no arquivo **`rodar-no-windows.bat`** na raiz do projeto.
4. O terminal fará a verificação: se o `node_modules` não existir, ele rodará `npm install` automaticamente.
5. Em segundos, o seu navegador padrão abrirá o endereço:  
   👉 **`http://localhost:3000`**

---

### 💻 Opção 2: Instalação e Execução Manual (Multiplataforma)

Se você preferir executar via terminal no Linux, macOS ou Windows:

#### Prerrequisitos
* Ter o **NodeJS** instalado (Versão 18 ou superior recomendada).

#### Passos
1. No terminal do seu computador, navegue até a pasta do projeto:
   ```bash
   cd caminho/para/o/projeto/parrot-printer
   ```

2. Instale todas as dependências necessárias listadas no `package.json`:
   ```bash
   npm install
   ```

3. Inicie o servidor local em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse pelo navegador:  
   👉 **`http://localhost:3000`**

#### 🚀 Executando em Produção (Modo Otimizado)
Se você quer construir um executável em segundo plano compilado e com desempenho otimizado:
```bash
# Compilar projeto frontend & backend
npm run build

# Iniciar o servidor de produção
npm run start
```

---

## 👻 Executando em Segundo Plano (Invisível no Windows)

Se você quer que o monitor de impressoras rode de maneira silenciosa no seu computador sempre que você ligar ou se quiser deixá-lo minimizado e sem barras pretas na tela do Windows:

1. Dê dois cliques em **`iniciar-com-o-windows.bat`** na raiz da pasta.
2. Pressione a opção **`1`** e confirme. O script instalará um atalho invisível que executa o `rodar-oculto.vbs` toda vez que você iniciar a rede local.
3. Para interromper o aplicativo rodando em segundo plano, clique em **`parar-sistema-oculto.bat`**.

---

## 💡 Por que rodar localmente?
Navegadores modernos impedem conexões WebSocket seguras (`https://...`) de se conectarem a conexões inseguras locais (`ws://192.168...`) devido às regras de **Mixed Content (Conteúdo Misto)**.  
Executando este projeto localmente em `http://localhost:3000`, a segurança do navegador permite conexões `ws://` locais transparentes, garantindo que você consiga ler e ouvir os avisos de todas as impressoras da sua oficina perfeitamente!
