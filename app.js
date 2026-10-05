'use strict';

const REFRESH_MS = 5000;
const BASESCAN = 'https://basescan.org';

const els = {
  statusDot: document.getElementById('statusDot'),
  walletAddr: document.getElementById('walletAddr'),
  balance: document.getElementById('balance'),
  totalVolume: document.getElementById('totalVolume'),
  tradeCount: document.getElementById('tradeCount'),
  updatedAt: document.getElementById('updatedAt'),
  buyVolume: document.getElementById('buyVolume'),
  sellVolume: document.getElementById('sellVolume'),
  buyCount: document.getElementById('buyCount'),
  sellCount: document.getElementById('sellCount'),
  ratioBuy: document.getElementById('ratioBuy'),
  ratioSell: document.getElementById('ratioSell'),
  feed: document.getElementById('feed'),
  feedNote: document.getElementById('feedNote'),
  lastBlock: document.getElementById('lastBlock'),
  tokenLabel: document.getElementById('tokenLabel'),
};

let knownHashes = new Set();
let firstLoad = true;

function shortAddr(a) {
  if (!a || a.length < 12) return a || '—';
  return a.slice(0, 6) + '…' + a.slice(-4);
}

function fmtNum(n, digits) {
  const d = digits === undefined ? 4 : digits;
  if (!Number.isFinite(n)) return '0.' + '0'.repeat(d);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return diff + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function setStatus(cls) {
  els.statusDot.className = 'pulse ' + cls;
}

function renderFeed(trades) {
  if (!trades.length) {
    els.feed.innerHTML = '<div class="empty">Belum ada trade.</div>';
    return;
  }

  const html = trades
    .map((t) => {
      const isNew = !firstLoad && !knownHashes.has(t.hash);
      const cls = t.type === 'BUY' ? 'buy' : 'sell';
      const tok = t.symbol ? t.symbol : 'token';
      return (
        '<div class="row ' + cls + (isNew ? ' new' : '') + '">' +
          '<span class="side">' + t.type + '</span>' +
          '<div class="main">' +
            '<div class="eth">' + fmtNum(t.eth, 6) + ' ETH</div>' +
            '<div class="meta">' +
              fmtNum(t.token, 2) + ' ' + tok +
              ' · <a href="' + BASESCAN + '/tx/' + t.hash + '" target="_blank" rel="noreferrer">' +
              t.hash.slice(0, 10) + '…</a>' +
            '</div>' +
          '</div>' +
          '<span class="time">' + timeAgo(t.timestamp) + '</span>' +
        '</div>'
      );
    })
    .join('');

  els.feed.innerHTML = html;
}

function render(data) {
  els.walletAddr.textContent = shortAddr(data.wallet);
  els.walletAddr.href = BASESCAN + '/address/' + data.wallet;
  els.balance.textContent = fmtNum(data.balanceEth, 4) + ' ETH';

  els.totalVolume.textContent = fmtNum(data.totalVolume, 4);
  els.tradeCount.textContent = data.tradeCount;
  els.updatedAt.textContent = 'update ' + timeAgo(data.updatedAt) + ' lalu';

  els.buyVolume.textContent = fmtNum(data.buyVolume, 4);
  els.sellVolume.textContent = fmtNum(data.sellVolume, 4);
  els.buyCount.textContent = data.buyCount + ' tx';
  els.sellCount.textContent = data.sellCount + ' tx';

  const total = data.totalVolume || 1;
  const buyPct = Math.min(100, Math.max(0, (data.buyVolume / total) * 100));
  els.ratioBuy.style.width = buyPct + '%';
  els.ratioSell.style.width = 100 - buyPct + '%';

  const newCount = data.trades.filter((t) => !knownHashes.has(t.hash)).length;
  els.feedNote.textContent =
    firstLoad ? data.trades.length + ' trade terakhir' : (newCount ? newCount + ' baru' : 'live');

  renderFeed(data.trades);

  els.lastBlock.textContent = 'Block ' + (data.lastBlock || 0).toLocaleString('en-US');
  els.tokenLabel.textContent = data.token ? 'Token ' + shortAddr(data.token) : 'Semua token';

  knownHashes = new Set(data.trades.map((t) => t.hash));
  firstLoad = false;
  setStatus('live');
}

async function poll() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'HTTP ' + res.status);
    }
    render(data);
  } catch (err) {
    setStatus('err');
    els.feedNote.textContent = 'error';
    if (firstLoad) {
      els.feed.innerHTML = '<div class="empty">Gagal memuat: ' + err.message + '</div>';
    }
  }
}

poll();
setInterval(poll, REFRESH_MS);
