# Base Volume Dashboard
-
Live web dashboard for a Base volume-bot wallet: big **total volume** on the home page, a **BUY / SELL** live feed, and wallet balance.

Data is read **directly from the blockchain** (Alchemy), not from the bot — so it stays accurate even if the bot is offline.

## Stack

- Static frontend (`index.html`, `styles.css`, `app.js`) — no build step.
- One serverless function: `api/stats.js` (Vercel Node runtime).
- No npm dependencies (uses the built-in `fetch`).

## How it works

1. `api/stats.js` calls Alchemy `alchemy_getAssetTransfers` for the wallet (incoming and outgoing, `external` + `erc20` + `internal`).
2. Transfers are grouped by transaction hash and classified:
   - **BUY**  = ETH out + token in
   - **SELL** = token out + ETH in
3. Volume, counts and the trade feed are returned as JSON.
4. The frontend polls `/api/stats` every 5 seconds and updates the UI live.

## Environment variables

| Name | Required | Description |
|---|---|---|
| `ALCHEMY_RPC_URL` | yes | Alchemy HTTPS endpoint for Base mainnet |
| `WALLET_ADDRESS` | yes | Wallet to monitor (default is baked in) |
| `TOKEN_ADDRESS` | no | Only count swaps of this token; empty = all tokens |

## Deploy on Vercel

1. Push this repo to GitHub.
2. Vercel -> **Add New Project** -> import the repo.
3. Framework preset: **Other** (no build command needed).
4. Add the environment variables above (Project -> Settings -> Environment Variables).
5. **Deploy**.

## Run locally / in GitHub Codespaces

```bash
cp .env.example .env      # fill in ALCHEMY_RPC_URL
npm start                 # = node server.js
```

Open <http://localhost:3000>. No install step, no dependencies.

`server.js` serves the static files **and** runs `api/stats.js` on the same port,
so it works anywhere Node 18+ runs — including GitHub Codespaces.

### Codespaces: reach it from your phone

1. Start it: `npm start`
2. Open the **Ports** tab next to the Terminal.
3. Right-click port **3000** -> *Port Visibility* -> **Public**.
4. Copy the forwarded `https://<name>-3000.app.github.dev` URL and open it on your phone.

> Codespaces stops when idle (default 30 min) and the URL changes on restart.
> For an always-on dashboard, deploy to Vercel instead.

## Deploy on Vercel (alternative)

`vercel dev` also works and mirrors production, but needs an interactive login.

## Notes

- Public RPCs do not support `alchemy_getAssetTransfers`; an Alchemy endpoint is required.
- Every transaction is linked to BaseScan for verification.
