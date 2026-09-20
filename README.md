# Foccus Desktop

Programa de computador (Windows e Mac) do Foccus, feito com Electron. A janela principal carrega o site (`https://foccus-six.vercel.app`, constante `SITE_URL` no topo do `main.js`). O cronômetro flutuante vira uma janelinha própria: sem borda, sempre por cima, sem barra de endereço.

## Rodar

```
npm install
npm start
```

Se o `npm install` avisar sobre scripts de instalação, o `package.json` já aprova `electron` e `electron-winstaller` (`allowScripts`). Para testar só a janelinha, sem o site: `npm run test:mini` (gera `preview-mini.png`).

## Gerar os instaladores

```
npm run dist:win   # dist/Foccus-Setup.exe  (NSIS x64, por usuário, sem admin)
npm run dist:mac   # dist/Foccus-<versão>-mac-universal.dmg (precisa rodar num Mac)
```

O GitHub Actions (`.github/workflows/build.yml`) faz os dois em `workflow_dispatch` e em tags `v*`, sobe os instaladores como artefatos e, em tag, como Release.

## Aviso: sem assinatura de código

Não há certificado, então o sistema desconfia do instalador:

- **Windows (SmartScreen):** clique em **Mais informações** e depois em **Executar assim mesmo**.
- **Mac:** clique com o **botão direito** no app, **Abrir**, e confirme em **Abrir** de novo. (Se o Mac disser que o app está "danificado": `xattr -cr /Applications/Foccus.app`.)

## Contrato com o site

O preload da janela principal expõe `window.foccusDesktop`:

```js
{
  isDesktop: true,
  platform: process.platform,          // 'win32' | 'darwin'
  mini: {
    open(state), update(state), close()
  },
  onMiniCommand(cb)                    // cb('play' | 'pause' | 'open' | 'closed')
}
```

`state = { title, level, time: 'MM:SS', frac: 0..1, running, cover: dataURL|null, theme: 'light'|'dark'|'black' }`

- `frac` é o quanto FALTA do tempo; o anel usa a mesma convenção do site (`stroke-dashoffset = 276.46 * frac`).
- `'open'` = clicou no título (a janela principal vem para a frente). `'closed'` = o usuário fechou a janelinha. `'play'`/`'pause'` chegam sem trazer a janela principal para a frente.
- O state é dado não confiável e é validado no processo main: `title` até 200 caracteres (cortado), `level` até 30 (cortado), `time` no formato `/^\d{1,3}:\d\d$/` (senão o state é descartado), `frac` limitado a 0..1, `cover` só `data:image/(jpeg|png|webp);base64` até 1,5 MB (senão vira `null`), `theme` só nos 3 valores (senão `light`). A janelinha usa só `textContent`, nunca `innerHTML`.
- Só a janela principal (na origem do Foccus) pode chamar `mini:*`; só a janelinha pode enviar comandos.
- A janela principal roda com `backgroundThrottling: false` para o cronômetro seguir contando quando ela está atrás da janelinha.
