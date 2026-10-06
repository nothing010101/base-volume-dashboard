// Serverless function: /api/stats
// Reads the wallet's on-chain activity from Alchemy and computes live volume.

const DEFAULT_WALLET = '0x29d02e247f345a7f882BF67911407f465FFE2944';
const MAX_PAGES = 6;
const PAGE_SIZE = 1000;

function getRpcUrl() {
  return process.env.ALCHEMY_RPC_URL || process.env.RPC_URL || '';
}

async function rpc(method, params) {
  const url = getRpcUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }
  return data.result;
}

async function fetchTransfers({ direction, wallet, categories }) {
  const transfers = [];
  let pageKey;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = {
      fromBlock: '0x0',
      toBlock: 'latest',
      category: categories,
      maxCount: '0x' + PAGE_SIZE.toString(16),
      order: 'desc',
      withMetadata: true,
    };
    if (direction === 'in') params.toAddress = wallet;
    else params.fromAddress = wallet;
    if (pageKey) params.pageKey = pageKey;

    const result = await rpc('alchemy_getAssetTransfers', [params]);
    transfers.push(...(result.transfers || []));
    pageKey = result.pageKey;
    if (!pageKey) break;
  }
  return transfers;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Round to avoid float artifacts like 0.009899999999999999
function round(n, digits = 8) {
  return Number(Number(n).toFixed(digits));
}

function metaOf(transfer) {
  const raw = transfer.metadata && transfer.metadata.blockTimestamp;
  const timestamp = raw ? Math.floor(new Date(raw).getTime() / 1000) : 0;
  const block = transfer.blockNum ? parseInt(transfer.blockNum, 16) : 0;
  return { timestamp, block };
}

function countBy(list, key) {
  const out = {};
  for (const item of list) {
    const k = item[key] || 'none';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// alchemy_getAssetTransfers reports ERC20 metadata in `rawContract` (address +
// decimal) and `asset` (symbol). There is no `erc20Token` field here.
function tokenInfo(t) {
  if (t.category !== 'erc20') return null;
  const addr = t.rawContract && t.rawContract.address
    ? String(t.rawContract.address).toLowerCase()
    : null;
  return { address: addr, symbol: t.asset || null };
}

function summarize(t) {
  const info = tokenInfo(t);
  return {
    hash: (t.hash || '').slice(0, 12),
    category: t.category,
    value: t.value,
    asset: t.asset || null,
    rawContract: t.rawContract || null,
    token: info ? info.symbol + ':' + info.address : null,
  };
}

export default async function handler(req, res) {
  try {
    if (!getRpcUrl()) {
      res.status(500).json({ error: 'ALCHEMY_RPC_URL is not set on the server.' });
      return;
    }

    const wallet = (process.env.WALLET_ADDRESS || DEFAULT_WALLET).toLowerCase();
    const tokenFilter = (process.env.TOKEN_ADDRESS || '').toLowerCase();
    const debug = String(req.url || '').includes('debug=1');

    const [incoming, outgoing, balanceHex, blockHex] = await Promise.all([
      fetchTransfers({ direction: 'in', wallet, categories: ['external', 'erc20', 'internal'] }),
      fetchTransfers({ direction: 'out', wallet, categories: ['external', 'erc20'] }),
      rpc('eth_getBalance', [wallet, 'latest']),
      rpc('eth_blockNumber', []),
    ]);

    if (debug) {
      res.status(200).json({
        debug: true,
        wallet,
        tokenFilter,
        incomingCount: incoming.length,
        outgoingCount: outgoing.length,
        incomingCategories: countBy(incoming, 'category'),
        outgoingCategories: countBy(outgoing, 'category'),
        incomingSample: incoming.slice(0, 8).map(summarize),
        outgoingSample: outgoing.slice(0, 8).map(summarize),
      });
      return;
    }

    const txs = new Map();

    function slot(hash, meta) {
      if (!txs.has(hash)) {
        txs.set(hash, {
          hash,
          ethIn: 0,
          ethOut: 0,
          tokenIn: 0,
          tokenOut: 0,
          symbol: null,
          timestamp: 0,
          block: 0,
        });
      }
      const s = txs.get(hash);
      if (meta) {
        if (meta.timestamp) s.timestamp = meta.timestamp;
        if (meta.block) s.block = meta.block;
      }
      return s;
    }

    for (const t of outgoing) {
      if (!t.hash) continue;
      const info = tokenInfo(t);
      if (tokenFilter && info && info.address && info.address !== tokenFilter) continue;

      const s = slot(t.hash, metaOf(t));
      if (info) {
        s.tokenOut += toNumber(t.value);
        if (!s.symbol) s.symbol = info.symbol;
      } else if (t.category === 'external') {
        s.ethOut += toNumber(t.value);
      }
    }

    for (const t of incoming) {
      if (!t.hash) continue;
      const info = tokenInfo(t);
      if (tokenFilter && info && info.address && info.address !== tokenFilter) continue;

      const s = slot(t.hash, metaOf(t));
      if (info) {
        s.tokenIn += toNumber(t.value);
        if (!s.symbol) s.symbol = info.symbol;
      } else if (t.category === 'external' || t.category === 'internal') {
        s.ethIn += toNumber(t.value);
      }
    }

    const trades = [];
    let buyVolume = 0;
    let sellVolume = 0;
    let buyCount = 0;
    let sellCount = 0;
    let tokensBought = 0;
    let tokensSold = 0;

    for (const s of txs.values()) {
      if (s.ethOut > 0 && s.tokenIn > 0) {
        buyVolume += s.ethOut;
        buyCount += 1;
        tokensBought += s.tokenIn;
        trades.push({
          type: 'BUY',
          eth: s.ethOut,
          token: s.tokenIn,
          symbol: s.symbol,
          hash: s.hash,
          timestamp: s.timestamp,
          block: s.block,
        });
      } else if (s.tokenOut > 0 && s.ethIn > 0) {
        sellVolume += s.ethIn;
        sellCount += 1;
        tokensSold += s.tokenOut;
        trades.push({
          type: 'SELL',
          eth: s.ethIn,
          token: s.tokenOut,
          symbol: s.symbol,
          hash: s.hash,
          timestamp: s.timestamp,
          block: s.block,
        });
      }
    }

    trades.sort((a, b) => b.block - a.block || b.timestamp - a.timestamp);

    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    res.status(200).json({
      wallet,
      token: tokenFilter || null,
      balanceEth: round(Number(BigInt(balanceHex)) / 1e18, 6),
      buyVolume: round(buyVolume),
      sellVolume: round(sellVolume),
      totalVolume: round(buyVolume + sellVolume),
      buyCount,
      sellCount,
      tradeCount: buyCount + sellCount,
      tokensBought: round(tokensBought, 4),
      tokensSold: round(tokensSold, 4),
      lastBlock: parseInt(blockHex, 16),
      updatedAt: Math.floor(Date.now() / 1000),
      trades: trades.slice(0, 60),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
