# Base Volume Dashboard
-
Live web dashboard for a Base volume-bot wallet: big **total volume** on the home page, a **BUY / SELL** live feed, and wallet balance.

Data is read **directly from the blockchain** (Alchemy), not from the bot — so it stays accurate even if the bot is offline.

## Structure

```
public/              static frontend (no build step)
  index.html
  styles.css
  app.js
api/stats.js         Vercel serverless function (Alchemy -> volume)
tools/dev-server.mjs local / Codespaces dev server
vercel.json          pins framework=null, outputDirectory=public
```

No npm dependencies — the function uses the built-in `fetch`.

## How it works

1. `api/stats.js` calls Alchemy `alchemy_getAssetTransfers` for the wallet
   (incoming and outgoing: `external` + `erc20` + `internal`).
2. Transfers are grouped by transaction hash and classified:
   - **BUY**  = ETH out + token in
   - **SELL** = token out + ETH in
3. Volume, counts and the trade feed are returned as JSON.
4. The frontend polls `/api/stats` every 5 seconds and updates live.

## Environment variables

| Name | Required | Description |
|---|---|---|
| `ALCHEMY_RPC_URL` | yes | Alchemy HTTPS endpoint for Base mainnet |
| `WALLET_ADDRESS` | yes | Wallet to monitor (a default is baked in) |
| `TOKEN_ADDRESS` | no | Only count swaps of this token; empty = all tokens |

## Deploy on Vercel

1. Push this repo to GitHub.
2. Vercel -> **Add New Project** -> import the repo.
3. Framework Preset: **Other** (leave Build/Output empty — `vercel.json` handles it).
4. Add the environment variables above (Settings -> Environment Variables).
5. **Deploy**.

`vercel.json` sets `framework: null` and `outputDirectory: "public"`, which keeps
Vercel from treating the project as a Node server.

## Run locally / in GitHub Codespaces

```bash
cp .env.example .env      # fill in ALCHEMY_RPC_URL
npm start                 # = node tools/dev-server.mjs
```

Open <http://localhost:3000>. No install step, no dependencies.

### Codespaces: reach it from your phone

1. Start it: `npm start`
2. Open the **Ports** tab next to the Terminal.
3. Right-click port **3000** -> *Port Visibility* -> **Public**.
4. Copy the forwarded `https://<name>-3000.app.github.dev` URL.

> Codespaces stops when idle (default 30 min) and the URL changes on restart.
> For an always-on dashboard, deploy to Vercel instead.

## Notes

- Public RPCs do not support `alchemy_getAssetTransfers`; an Alchemy endpoint is required.
- Every transaction is linked to BaseScan for verification.
