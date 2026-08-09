# JC QuickTune — Stage 1 builder (chat)

Static storefront + **Stage 1 dual-mode builder chat** for B46/B48 MG1.

**Live (GitHub Pages):** https://chavezsd92-source.github.io/jc-quicktune-store/

## What you get on the page

- Dark JC QuickTune theme
- Product pitch (Stage 1 · Comfort / Sport on the fly)
- **Chat builder** with **next-step suggestion chips**
- Live package total ($149 base + add-ons)
- Order form (plain-text export)

## Chat modes

### Offline (default on GitHub Pages)

Works with no API key. Guided Q&A matching how we build tunes:

- vehicle → stock/mods → DME unlock → software → goals/add-ons → package

### Grok (SpaceXAI / xAI)

Optional. Deploy the same site on **Cloudflare Pages** with:

1. `functions/api/chat.js` (included)
2. Secret: `XAI_API_KEY` from https://console.x.ai

The browser calls `POST /api/chat` → `https://api.x.ai/v1/chat/completions` with model `grok-4.5`.

Never put `XAI_API_KEY` in frontend JS.

Optional override:

```html
<script>window.JCQT_CHAT_API = "https://your-worker.example/api/chat";</script>
```

## Requirements called out on site

- Full BIN flash
- DME already unlocked (B48 Quickflash or similar)
- Stock backup
- All-stock baseline figures; list mods for accuracy

## Deploy

```powershell
git add .
git commit -m "Update store + chat"
git push
```
