
---

# FBVibeX 

![FBVibeX Logo](https://i.ibb.co/qM5Pygz1/1749100749262.jpg)  
**FBVibeX** is a wickedly fast, unofficial API for automating Facebook Messenger with **WebSocket** for real-time messaging and event handling. Built on the legacy of `fca-unofficial`, it’s loaded with next-level features, rock-solid stability, and full support for modern JavaScript. No official FB API token needed—just pure vibe! 🚀

> **⚠️ Yo, heads up**: This is an unofficial API. Use it responsibly and respect [Facebook's Terms of Service](https://www.facebook.com/terms). Overdoing it might get your account flagged.

---

## ✨ Epic Features

- 🔑 **Smooth Login Vibes**: Sign in with `appState` (session cookies) or email/password.  
- 💬 **Next-Gen Messaging**: Send texts, stickers, images, files, URLs, and emojis; catch messages and events (like user joins/leaves) in real-time with WebSocket.  
- 🛡️ **Stealth Mode**: Bypasses FB’s bot detection to keep your automation low-key.  
- 🔄 **Auto fb_dtsg Refresh**: Keeps your session fresh with daily token updates.  
- 🛠️ **Modern Dev Swag**: Full ES Module and TypeScript support with `index.d.ts` for type-safe coding.  
- ⚙️ **Customizable Flow**: Tweak bot settings like online status, event listening, and message read/delivery status.

---

## 📦 Get Started with FBVibeX

### Prerequisites
- **Node.js**: Version 16+ (ES modules ready) 🟢  
- **Dependencies**: `npmlog`, `cheerio`, `node-cron`, `fs`, `path`, `readline/promises`, and a custom `utils` module (see [Usage](#usage)).  
- **Facebook Credentials**: `appState` (session cookies) or email/password 📧  

### Install via npm
```bash
npm install fbvibex
```

### Install from GitHub (Bleeding Edge)
```bash
npm install git+https://github.com/haji-mix/fbvibex.git
```

### Project Setup
1. Kick off a new project:
   ```bash
   mkdir fbvibex-bot
   cd fbvibex-bot
   npm init -y
   ```
2. Enable ES modules in `package.json`:
   ```json
   {
     "name": "fbvibex-bot",
     "type": "module",
     "scripts": {
       "start": "node src/bot.js",
       "start:ts": "ts-node-esm src/bot.ts"
     },
     "dependencies": {
       "fbvibex": "^1.0.0",
       "cheerio": "^1.0.0",
       "node-cron": "^3.0.3",
       "npmlog": "^7.0.1"
     },
     "devDependencies": {
       "@types/node": "^22.7.4",
       "typescript": "^5.6.2",
       "ts-node": "^10.9.2"
     }
   }
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. For TypeScript, add `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "Node",
       "esModuleInterop": true,
       "allowSyntheticDefaultImports": true,
       "strict": true,
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"]
   }
   ```

---

## 🔑 Snagging Your AppState

To vibe with FBVibeX, grab an `appState` (session cookies) from a logged-in FB session:

1. Install **Kiwi Browser** (Android or Chromium-based) 📱  
2. Add the **c3c-ufc-utility** extension ([GitHub Releases](https://github.com/c3cbot/c3c-ufc-utility/releases)).  
3. Log in to Facebook manually.  
4. Use the extension to extract `appState` and save it as `appstate.json`.  

Or, use `api.getAppState()` after login to snag and save `appState` for future use. 💾

---

## 🚀 Usage

### Directory Structure
```
fbvibex-bot/
├── src/
│   ├── bot.ts (or bot.js) 🖥️
│   ├── index.js (FBVibeX module)
│   ├── index.d.ts (TypeScript declarations)
│   ├── utils.js (custom utilities)
│   └── src/ (extra API functions, e.g., listenMqtt.js, sendMessage.js, getThreadInfo.js)
├── appstate.json
├── package.json
└── tsconfig.json (for TypeScript)
```

### Example: Echo Bot (TypeScript) 🤖
Create `src/bot.ts`:
```typescript
import login from 'fbvibex';
import fs from 'fs/promises';
import type { API, LoginCredentials, LoginOptions } from 'fbvibex';

async function startBot() {
  const credentials: LoginCredentials = {
    appState: JSON.parse(await fs.readFile('appstate.json', 'utf8')),
    // Or use: { email: 'your_email@example.com', password: 'your_password' }
  };

  const options: LoginOptions = {
    online: true,
    listenEvents: true,
    autoMarkRead: true,
    forceLogin: true,
    logLevel: 'silent',
  };

  try {
    const api = await login(credentials, options);
    console.log('Bot’s live and vibin’! 😎');

    // Listen for messages via WebSocket (requires src/listen.js)
    api.listenMqtt((err: Error | null, event: any) => {
      if (err) {
        console.error('Listen error:', err);
        return;
      }
      if (event.type === 'message') {
        if (event.body.toLowerCase() === 'test') {
          api.sendMessage(`Echo: ${event.body} 🔊`, event.threadID);
        }
        if (event.body.toLowerCase() === '/info') {
          api.getThreadInfo(event.threadID, (err, info) => {
            if (err) return console.error('Thread info error:', err);
            api.sendMessage(`Thread Name: ${info.threadName} 😎`, event.threadID);
          });
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
  }
}

startBot();
```

### Example: Echo Bot (JavaScript) 🖱️
Create `src/bot.js`:
```javascript
import login from 'fbvibex';
import fs from 'fs/promises';

async function startBot() {
  const credentials = {
    appState: JSON.parse(await fs.readFile('appstate.json', 'utf8')),
  };

  const options = {
    online: true,
    listenEvents: true,
    autoMarkRead: true,
    forceLogin: true,
    logLevel: 'silent',
  };

  try {
    const api = await login(credentials, options);
    console.log('Bot’s live and vibin’! 😎');

    // Listen for messages via WebSocket (requires src/listen.js)
    api.listenMqtt((err, event) => {
      if (err) {
        console.error('Listen error:', err);
        return;
      }
      if (event.type === 'message') {
        if (event.body.toLowerCase() === 'test') {
          api.sendMessage(`Echo: ${event.body} 🔊`, event.threadID);
        }
        if (event.body.toLowerCase() === '/info') {
          api.getThreadInfo(event.threadID, (err, info) => {
            if (err) return console.error('Thread info error:', err);
            api.sendMessage(`Thread Name: ${info.threadName} 😎`, event.threadID);
          });
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
  }
}

startBot();
```

### Run the Bot
- **JavaScript**:
  ```bash
  npm start
  ```
- **TypeScript**:
  ```bash
  npm run start:ts
  ```

---

## 📚 API Reference

### `login(credentials, options?)`
Logs you into FB and returns a dope API object. 🔑  

- **Parameters**:  
  - `credentials`: `{ appState?: Cookie[] | string | { cookies: Cookie[] }, email?: string, password?: string }`  
  - `options?`: `{ online?: boolean, listenEvents?: boolean, forceLogin?: boolean, ... }`  
- **Returns**: `Promise<API>`

### `API` Methods
- `setOptions(options)`: Tunes your bot’s vibe (e.g., `online`, `listenEvents`). ⚙️  
- `getAppState()`: Grabs session cookies for later use. 💾  
- `getCookie()`: Returns cookies as a semicolon-separated string. 🍪  
- `listen(callback)`: Catches messages/events in real-time via WebSocket (requires `src/listen.js`). 📡  
- `sendMessage(message, threadID, callback?)`: Drops a message in the chat (requires `src/sendMessage.js`). ✉️  
- `getThreadInfo(threadID, callback)`: Fetches details about a chat thread, like name or members (requires `src/getThreadInfo.js`). ℹ️  
- `sendTypingIndicator(threadID, state)`: Shows or hides the typing indicator in a thread (requires `src/sendTypingIndicator.js`). ⌨️  
- `reactToMessage(messageID, reaction, callback?)`: Adds a reaction (e.g., 👍) to a message (requires `src/reactToMessage.js`). 😍  
- `getUserInfo(userIDs, callback)`: Grabs user details like name or profile (requires `src/getUserInfo.js`). 👤  

> **Note**: More API methods are available! Check out the full list in [API Documentation](https://github.com/VangBanLaNhat/fca-unofficial/blob/master/DOCS.md) for the latest features and updates. 🌟

### Configuration Options
| Option             | Type      | Default | Description                              |
|--------------------|-----------|---------|------------------------------------------|
| `online`           | `boolean` | `true`  | Sets bot online status. 🌐              |
| `listenEvents`     | `boolean` | `true`  | Enables WebSocket event listening. 📡   |
| `forceLogin`       | `boolean` | `false` | Forces a fresh login. 🔄               |
| `autoMarkRead`     | `boolean` | `true`  | Auto-marks messages as read. ✅         |
| `logLevel`         | `string`  | -       | Sets logging level (e.g., `silent`). 📝|
| `bypassRegion`     | `string`  | -       | Overrides region (e.g., `PRN`). 🌍     |

---

## ❓ FAQ

### How do I log in without credentials?  
Use the `c3c-ufc-utility` extension to snag `appState` after manually logging into FB. 🔐  

### Can FBVibeX send media?  
Yup, `sendMessage` supports attachments like images and files (requires `src/sendMessage.js`). 📸  

### How do I keep sessions alive?  
Auto-refresh `fb_dtsg` keeps things rolling. Save `appState` with `api.getAppState()` for reuse. 🔄  

### Is TypeScript supported?  
Totally! `index.d.ts` gives you type-safe coding vibes. 🛠️  

### Where can I find more API methods?  
Dive into the full API docs at [Fca-Unofficial API Reference](https://github.com/VangBanLaNhat/fca-unofficial/blob/master/DOCS.md) for all the juicy details! 🌟  

---

## 🤝 Contribute to the Vibe

Wanna make **FBVibeX** even cooler? 😎 Here’s how:  
1. Fork the repo. 🍴  
2. Create a feature branch (`git checkout -b feature/epic-feature`).  
3. Drop a pull request with a clear description.  

Report bugs or suggest ideas on the [GitHub Issues](https://github.com/haji-mix/fbvibex/issues) page. 🐞

---

## 🌐 Join the Group

Vibe with our community for support and chats:  
- **ChatBot Community**: [Facebook Group](https://www.facebook.com/groups/coders.dev) 👥  
- **Contact**: [JR Busaco](https://www.facebook.com/jr.busaco.271915), [Kenneth Panio](https://www.facebook.com/atomyc2727), [Aljur Pogoy](https://www.facebook.com/cid.kagenou.635584) 📩  

---

## 📜 License

Licensed under the [MIT License](https://github.com/VangBanLaNhat/fca-unofficial?tab=MIT-1-ov-file). 📄  

---
