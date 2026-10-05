# Base Volume Dashboard

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

## Local development

```bash
npm i -g vercel
cp .env.example .env      # fill in ALCHEMY_RPC_URL
vercel dev
```

`vercel dev` serves the static files **and** runs `api/stats.js` locally.

## Notes

- Public RPCs do not support `alchemy_getAssetTransfers`; an Alchemy endpoint is required.
- Every transaction is linked to BaseScan for verification.
