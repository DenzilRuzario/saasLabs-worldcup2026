// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
const state = {
  todayMatches: [],
  recentMatches: [],
  upcomingMatches: [],
  pollVoted: false,
  scorePredictions: JSON.parse(localStorage.getItem('scorePredictions') || '[]'),
  crystalPrediction: JSON.parse(localStorage.getItem('crystalPrediction') || 'null'),
  refreshInterval: null,
};

// ─── TEAM DATA (fallback / modal quick info) ───────────────────────────────────
const TEAM_QUICK = {
  BRA: { flag:'🇧🇷', name:'Brazil', titles:5, appearances:22, summary:'Five-time champions with the most World Cup appearances in history. Home to Vinicius Jr., arguably the most dangerous attacker on the planet right now.', page:'team.html?team=brazil' },
  GER: { flag:'🇩🇪', name:'Germany', titles:4, appearances:20, summary:'Four-time winners rebuilding under Nagelsmann. Florian Wirtz and Jamal Musiala give them a creative core that terrifies any defence.', page:'team.html?team=germany' },
  ARG: { flag:'🇦🇷', name:'Argentina', titles:3, appearances:18, summary:'Reigning world champions led by Messi, possibly in his final World Cup. Tactically disciplined and tournament-hardened.', page:'team.html?team=argentina' },
  FRA: { flag:'🇫🇷', name:'France', titles:2, appearances:16, summary:'Joint-favourites with arguably the most complete squad in the tournament. Mbappé at 27 is in his prime and hungry for glory.', page:'team.html?team=france' },
};

// Map country codes from API to our codes
const CODE_MAP = {
  'Brazil': 'BRA', 'Germany': 'GER', 'Argentina': 'ARG', 'France': 'FRA',
  'England': 'ENG', 'Spain': 'ESP', 'Portugal': 'POR', 'Netherlands': 'NED',
  'Belgium': 'BEL', 'Italy': 'ITA', 'Croatia': 'CRO', 'Uruguay': 'URU',
  'Mexico': 'MEX', 'USA': 'USA', 'Canada': 'CAN', 'Japan': 'JPN',
  'South Korea': 'KOR', 'Morocco': 'MAR', 'Senegal': 'SEN', 'Australia': 'AUS',
  'Poland': 'POL', 'Switzerland': 'SUI', 'Denmark': 'DEN', 'Serbia': 'SRB',
  'Ecuador': 'ECU', 'Ghana': 'GHA', 'Cameroon': 'CMR', 'Saudi Arabia': 'KSA',
  'Iran': 'IRN', 'Wales': 'WAL', 'Tunisia': 'TUN', 'Costa Rica': 'CRC',
  'Scotland': 'SCO', 'Hungary': 'HUN',
};

// Flag emojis by code
const FLAG_MAP = {
  BRA:'🇧🇷', GER:'🇩🇪', ARG:'🇦🇷', FRA:'🇫🇷', ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  ESP:'🇪🇸', POR:'🇵🇹', NED:'🇳🇱', BEL:'🇧🇪', ITA:'🇮🇹',
  CRO:'🇭🇷', URU:'🇺🇾', MEX:'🇲🇽', USA:'🇺🇸', CAN:'🇨🇦',
  JPN:'🇯🇵', KOR:'🇰🇷', MAR:'🇲🇦', SEN:'🇸🇳', AUS:'🇦🇺',
  POL:'🇵🇱', SUI:'🇨🇭', DEN:'🇩🇰', SRB:'🇷🇸', ECU:'🇪🇨',
  GHA:'🇬🇭', CMR:'🇨🇲', KSA:'🇸🇦', IRN:'🇮🇷', WAL:'🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  TUN:'🇹🇳', CRC:'🇨🇷', SCO:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', HUN:'🇭🇺',
};

function getFlag(countryName) {
  const code = CODE_MAP[countryName] || 'XX';
  return FLAG_MAP[code] || '🏳';
}

function getCode(countryName) {
  return CODE_MAP[countryName] || countryName.slice(0,3).toUpperCase();
}

// ─── NAV ───────────────────────────────────────────────────────────────────────
function initNav() {
  const toggle = document.querySelector('.nav-mobile-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // Set active link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path || 
        (path === '' && a.getAttribute('href') === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ─── API FETCH ─────────────────────────────────────────────────────────────────
async function fetchScores(endpoint) {
  try {
    const res = await fetch(`/.netlify/functions/scores?endpoint=${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API error:', err);
    return null;
  }
}

// ─── FORMAT HELPERS ────────────────────────────────────────────────────────────
function formatMatchDate(utcDate) {
  const d = new Date(utcDate);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(utcDate) {
  const d = new Date(utcDate);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function matchStatusLabel(status, minute) {
  switch(status) {
    case 'IN_PLAY': return `<span class="match-status status-live"><span class="live-dot"></span>${minute || ''}'</span>`;
    case 'PAUSED': return `<span class="match-status status-live"><span class="live-dot"></span>HT</span>`;
    case 'LIVE': return `<span class="match-status status-live"><span class="live-dot"></span>LIVE</span>`;
    case 'FINISHED': return `<span class="match-status status-finished">FT</span>`;
    case 'SCHEDULED': return `<span class="match-status status-upcoming">Upcoming</span>`;
    case 'TIMED': return `<span class="match-status status-upcoming">Upcoming</span>`;
    default: return `<span class="match-status status-upcoming">${status}</span>`;
  }
}

function scoreDisplay(match) {
  const s = match.score;
  const home = s?.fullTime?.home ?? s?.halfTime?.home ?? null;
  const away = s?.fullTime?.away ?? s?.halfTime?.away ?? null;
  const st = match.status;

  if ((st === 'IN_PLAY' || st === 'PAUSED' || st === 'LIVE' || st === 'FINISHED') && home !== null) {
    return `<div class="match-score">${home} - ${away}</div>`;
  }
  return `<div class="match-score vs">VS</div>`;
}

function isLive(status) {
  return ['IN_PLAY','PAUSED','LIVE'].includes(status);
}

// ─── MATCH CARD ────────────────────────────────────────────────────────────────
function buildMatchCard(match) {
  const home = match.homeTeam?.name || 'TBD';
  const away = match.awayTeam?.name || 'TBD';
  const homeFlag = getFlag(home);
  const awayFlag = getFlag(away);
  const homeCode = getCode(home);
  const awayCode = getCode(away);
  const live = isLive(match.status);
  const minute = match.minute;
  const group = match.group ? `Group ${match.group}` : match.stage?.replace(/_/g,' ') || '';

  const homeQuick = TEAM_QUICK[CODE_MAP[home]];
  const awayQuick = TEAM_QUICK[CODE_MAP[away]];
  const homeLink = homeQuick ? `onclick="openModal('${homeCode}')"` : '';
  const awayLink = awayQuick ? `onclick="openModal('${awayCode}')"` : '';

  return `
    <div class="match-card ${live ? 'live' : ''} fade-in">
      <div class="match-meta">
        <span class="match-group">${group}</span>
        ${matchStatusLabel(match.status, minute)}
      </div>
      <div class="match-teams">
        <div class="match-team" ${homeLink} style="${homeQuick ? 'cursor:pointer' : ''}">
          <span class="match-flag-emoji">${homeFlag}</span>
          <span class="match-team-name">${home}</span>
          <span style="font-size:11px;color:var(--text3);font-weight:600">${homeCode}</span>
        </div>
        <div class="match-score-area">
          ${scoreDisplay(match)}
          <div class="match-time">${formatMatchDate(match.utcDate)}</div>
        </div>
        <div class="match-team" ${awayLink} style="${awayQuick ? 'cursor:pointer' : ''}">
          <span class="match-flag-emoji">${awayFlag}</span>
          <span class="match-team-name">${away}</span>
          <span style="font-size:11px;color:var(--text3);font-weight:600">${awayCode}</span>
        </div>
      </div>
      ${match.venue ? `<div class="match-venue">📍 ${match.venue?.name || ''}</div>` : ''}
    </div>
  `;
}

// ─── RESULT ROW ────────────────────────────────────────────────────────────────
function buildResultRow(match) {
  const home = match.homeTeam?.name || 'TBD';
  const away = match.awayTeam?.name || 'TBD';
  const homeFlag = getFlag(home);
  const awayFlag = getFlag(away);
  const homeCode = getCode(home);
  const awayCode = getCode(away);
  const s = match.score?.fullTime;
  const score = s ? `${s.home} - ${s.away}` : '- - -';

  const homeQuick = TEAM_QUICK[CODE_MAP[home]];
  const awayQuick = TEAM_QUICK[CODE_MAP[away]];

  return `
    <div class="result-row fade-in">
      <span class="result-date">${formatShortDate(match.utcDate)}</span>
      <div class="result-teams">
        <div class="result-team" ${homeQuick ? `onclick="openModal('${homeCode}')" style="cursor:pointer"` : ''}>
          <span class="result-team-flag">${homeFlag}</span>
          <span class="result-team-name">${home}</span>
        </div>
        <div class="result-score-box">${score}</div>
        <div class="result-team" ${awayQuick ? `onclick="openModal('${awayCode}')" style="cursor:pointer"` : ''}>
          <span class="result-team-flag">${awayFlag}</span>
          <span class="result-team-name">${away}</span>
        </div>
      </div>
    </div>
  `;
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(code) {
  const t = TEAM_QUICK[code];
  if (!t) return;

  const overlay = document.getElementById('teamModal');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <span class="modal-flag">${t.flag}</span>
    <h2 class="modal-name">${t.name}</h2>
    <div class="modal-stats">
      <div class="modal-stat">
        <div class="modal-stat-val">${t.titles}</div>
        <div class="modal-stat-lbl">World Cup Titles</div>
      </div>
      <div class="modal-stat">
        <div class="modal-stat-val">${t.appearances}</div>
        <div class="modal-stat-lbl">Appearances</div>
      </div>
    </div>
    <p class="modal-summary">${t.summary}</p>
    <a href="${t.page}" class="btn" style="display:inline-block;text-decoration:none">View Full Team →</a>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('teamModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── LOADING HELPERS ──────────────────────────────────────────────────────────
function showLoading(el) {
  el.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
}

function showError(el, msg) {
  el.innerHTML = `<div class="error-state">⚠️ ${msg}</div>`;
}

function showEmpty(el, msg) {
  el.innerHTML = `<div class="empty-state"><span class="icon">⚽</span><p>${msg}</p></div>`;
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
async function initHomePage() {
  const todayEl = document.getElementById('todayMatches');
  const recentEl = document.getElementById('recentResults');
  if (!todayEl) return;

  showLoading(todayEl);
  if (recentEl) showLoading(recentEl);

  // Fetch today + recent in parallel
  const [todayData, recentData, upcomingData] = await Promise.all([
    fetchScores('today'),
    fetchScores('recent'),
    fetchScores('upcoming'),
  ]);

  // Today's matches
  if (todayData?.matches?.length) {
    const html = todayData.matches.map(buildMatchCard).join('');
    todayEl.innerHTML = `<div class="matches-grid stagger">${html}</div>`;
  } else if (upcomingData?.matches?.length) {
    // Show next few upcoming if no matches today
    const next = upcomingData.matches.slice(0, 4);
    const html = next.map(buildMatchCard).join('');
    todayEl.innerHTML = `<div class="matches-grid stagger">${html}</div>`;
    document.getElementById('todayTitle').textContent = 'Upcoming Matches';
  } else {
    showEmpty(todayEl, 'No matches scheduled for today');
  }

  // Recent results
  if (recentEl) {
    if (recentData?.matches?.length) {
      const html = recentData.matches.slice(0, 6).map(buildResultRow).join('');
      recentEl.innerHTML = `<div class="results-list stagger">${html}</div>`;
    } else {
      showEmpty(recentEl, 'No recent results yet');
    }
  }

  // Auto-refresh live scores every 60 seconds
  startLiveRefresh(todayEl, todayData?.matches);
}

function startLiveRefresh(container, matches) {
  if (!matches?.some(m => isLive(m.status))) return;

  clearInterval(state.refreshInterval);
  state.refreshInterval = setInterval(async () => {
    const data = await fetchScores('today');
    if (data?.matches?.length) {
      const html = data.matches.map(buildMatchCard).join('');
      container.innerHTML = `<div class="matches-grid stagger">${html}</div>`;
      if (!data.matches.some(m => isLive(m.status))) {
        clearInterval(state.refreshInterval);
      }
    }
  }, 60000);
}

// ─── POLL ─────────────────────────────────────────────────────────────────────
const POLL_DATA = { brazil: 52, draw: 14, germany: 34 };

function initPoll() {
  const pollEl = document.getElementById('poll');
  if (!pollEl) return;

  const voted = localStorage.getItem('pollVoted');
  if (voted) {
    renderPollResults(pollEl, voted);
    return;
  }

  pollEl.querySelectorAll('.poll-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const choice = opt.dataset.choice;
      localStorage.setItem('pollVoted', choice);
      opt.closest('.poll-card')?.classList.add('poll-voted');
      renderPollResults(pollEl, choice);
    });
  });
}

function renderPollResults(pollEl, choice) {
  const card = pollEl.querySelector('.poll-card') || pollEl;
  card.classList.add('poll-voted');

  const pcts = { brazil: POLL_DATA.brazil, draw: POLL_DATA.draw, germany: POLL_DATA.germany };

  card.querySelectorAll('.poll-option').forEach(opt => {
    const c = opt.dataset.choice;
    if (c === choice) opt.classList.add('selected');
    const pct = pcts[c] || 0;
    opt.querySelector('.poll-option-fill').style.width = pct + '%';
    const pctEl = opt.querySelector('.poll-option-pct');
    if (pctEl) { pctEl.style.display = 'block'; pctEl.textContent = pct + '%'; }
  });
}

// ─── SCORE PREDICTION ─────────────────────────────────────────────────────────
function initScorePrediction() {
  const form = document.getElementById('scoreForm');
  if (!form) return;

  renderPredictionCards();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('predName').value.trim();
    const home = document.getElementById('predHome').value;
    const away = document.getElementById('predAway').value;

    if (!name) { alert('Please enter your name'); return; }

    const pred = { name, score: `${home} - ${away}`, ts: Date.now() };
    state.scorePredictions.unshift(pred);
    localStorage.setItem('scorePredictions', JSON.stringify(state.scorePredictions.slice(0,20)));

    form.reset();
    renderPredictionCards();

    const btn = form.querySelector('.btn');
    btn.textContent = '✓ Submitted!';
    setTimeout(() => btn.textContent = 'Submit Prediction', 2000);
  });
}

function renderPredictionCards() {
  const container = document.getElementById('predictionCards');
  if (!container) return;

  const sample = [
    { name: 'Rahul M.', score: '2 - 1', perfect: true, note: '🎯 Perfect Prediction' },
    { name: 'Priya S.', score: '1 - 0', perfect: false, note: '📍 1 goal off' },
    { name: 'Arjun K.', score: '3 - 2', perfect: false, note: '📍 Closest Score' },
  ];

  const userPreds = state.scorePredictions.map(p => ({
    name: p.name, score: p.score, perfect: false, note: '📝 Your prediction'
  }));

  const all = [...sample, ...userPreds].slice(0, 6);

  container.innerHTML = `<div class="predictions-cards stagger">
    ${all.map(p => `
      <div class="prediction-result-card ${p.perfect ? 'perfect' : ''}">
        <div class="pred-result-header">
          <span class="pred-result-icon">${p.perfect ? '🏆' : '⚽'}</span>
          <span class="pred-result-name">${p.name}</span>
        </div>
        <div class="pred-result-score">${p.score}</div>
        <div class="pred-result-note">${p.note}</div>
      </div>
    `).join('')}
  </div>`;
}

// ─── CRYSTAL BALL ─────────────────────────────────────────────────────────────
function initCrystalBall() {
  const form = document.getElementById('crystalForm');
  if (!form) return;

  // Pre-fill if previously submitted
  const saved = state.crystalPrediction;
  if (saved) {
    Object.keys(saved).forEach(k => {
      const el = document.getElementById(k);
      if (el) el.value = saved[k];
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fields = ['winner','runnerUp','goldenBoot','bestYoung','playerOfTournament',
                    'darkHorse','surpriseExit','breakoutStar','entertaining','shock'];
    const data = {};
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el) data[f] = el.value;
    });

    localStorage.setItem('crystalPrediction', JSON.stringify(data));
    state.crystalPrediction = data;

    const btn = form.querySelector('.btn');
    btn.textContent = '✓ Predictions Saved!';
    btn.style.background = 'var(--green)';
    setTimeout(() => {
      btn.textContent = 'Save My Predictions';
      btn.style.background = '';
    }, 3000);
  });
}

// ─── TEAM PAGE ────────────────────────────────────────────────────────────────
async function initTeamPage() {
  const params = new URLSearchParams(window.location.search);
  const teamSlug = params.get('team');
  if (!teamSlug) { window.location.href = 'teams.html'; return; }

  try {
    const res = await fetch(`data/${teamSlug}.json`);
    if (!res.ok) throw new Error('Team not found');
    const team = await res.json();
    renderTeamPage(team);
  } catch (err) {
    document.getElementById('teamContent').innerHTML = `
      <div class="container page">
        <div class="error-state">⚠️ Could not load team data. <a href="teams.html" style="color:var(--gold)">Back to teams</a></div>
      </div>`;
  }
}

function renderTeamPage(t) {
  document.title = `${t.name} — SaasLabs World Cup 2026`;
  const el = document.getElementById('teamContent');

  el.innerHTML = `
    <div class="team-hero" style="--team-color: ${t.color}22">
      <div class="container">
        <div class="team-hero-inner">
          <div class="team-flag-large">${t.flag}</div>
          <div class="team-hero-info">
            <a href="teams.html" style="font-size:13px;color:var(--text3);text-decoration:none;display:inline-block;margin-bottom:12px">← All Teams</a>
            <h1 class="team-hero-name">${t.name}</h1>
            <div class="team-hero-meta">
              <div class="team-meta-item">
                <div class="team-meta-label">FIFA Ranking</div>
                <div class="team-meta-value">#${t.fifaRanking}</div>
              </div>
              <div class="team-meta-item">
                <div class="team-meta-label">World Cup Titles</div>
                <div class="team-meta-value">${t.titles}</div>
              </div>
              <div class="team-meta-item">
                <div class="team-meta-label">Appearances</div>
                <div class="team-meta-value">${t.appearances}</div>
              </div>
              <div class="team-meta-item">
                <div class="team-meta-label">Group</div>
                <div class="team-meta-value">${t.group}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container page">

      <!-- OVERVIEW -->
      <section>
        <div class="section-header">
          <h2 class="section-title">Team <span>Overview</span></h2>
        </div>
        <div class="analysis-grid">
          <div class="analysis-card" style="grid-column: 1 / -1">
            <div class="analysis-card-label">📋 Overview</div>
            <p class="analysis-card-text">${t.overview}</p>
          </div>
          <div class="analysis-card">
            <div class="analysis-card-label">✅ What They Do Well</div>
            <p class="analysis-card-text">${t.doesWell}</p>
          </div>
          <div class="analysis-card">
            <div class="analysis-card-label">⚠️ Potential Weaknesses</div>
            <p class="analysis-card-text">${t.weaknesses}</p>
          </div>
          <div class="analysis-card">
            <div class="analysis-card-label">⭐ Player To Watch</div>
            <div class="analysis-card-name">${t.playerToWatch}</div>
            <p class="analysis-card-text">${t.playerToWatchDetail}</p>
          </div>
          <div class="analysis-card">
            <div class="analysis-card-label">🚀 Breakout Candidate</div>
            <div class="analysis-card-name">${t.breakoutCandidate}</div>
            <p class="analysis-card-text">${t.breakoutCandidateDetail}</p>
          </div>
          <div class="analysis-card" style="grid-column: 1 / -1">
            <div class="analysis-card-label">🏆 Tournament Outlook</div>
            <p class="analysis-card-text">${t.tournamentOutlook}</p>
          </div>
        </div>
      </section>

      <hr class="divider">

      <!-- COACHING STAFF -->
      <section>
        <div class="section-header">
          <h2 class="section-title">Coaching <span>Staff</span></h2>
        </div>
        <div class="coach-cards">
          <div class="coach-card">
            <div class="coach-role">Head Coach</div>
            <div class="coach-name">${t.coach.name}</div>
            <div class="coach-meta">${t.coach.nationality} · Since ${t.coach.since}</div>
          </div>
          ${t.assistantCoaches.map(c => `
            <div class="coach-card">
              <div class="coach-role">${c.role}</div>
              <div class="coach-name">${c.name}</div>
            </div>
          `).join('')}
        </div>
      </section>

      <hr class="divider">

      <!-- SQUAD -->
      <section>
        <div class="section-header">
          <h2 class="section-title">Squad</h2>
        </div>
        ${renderSquad('Goalkeepers', t.squad.goalkeepers)}
        ${renderSquad('Defenders', t.squad.defenders)}
        ${renderSquad('Midfielders', t.squad.midfielders)}
        ${renderSquad('Forwards', t.squad.forwards)}
      </section>

      <hr class="divider">

      <!-- FIXTURES & RESULTS -->
      <section>
        <div class="section-header">
          <h2 class="section-title">Fixtures & <span>Results</span></h2>
        </div>
        <div class="tabs">
          <button class="tab active" onclick="switchTab('fixtures')">Upcoming</button>
          <button class="tab" onclick="switchTab('results')">Results</button>
        </div>
        <div id="fixtures">
          <div class="fixture-list">
            ${t.fixtures.map(f => `
              <div class="fixture-row">
                <div class="fixture-date-info">
                  <div class="fixture-date">${new Date(f.date).toLocaleDateString([],{month:'short',day:'numeric'})}</div>
                  <div class="fixture-time">${f.time}</div>
                </div>
                <div class="fixture-opponent">vs ${f.opponent}</div>
                <div class="fixture-venue">${f.venue}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div id="results" style="display:none">
          <div class="results-list">
            ${t.results.map(r => `
              <div class="result-row">
                <span class="result-date">${new Date(r.date).toLocaleDateString([],{month:'short',day:'numeric'})}</span>
                <div class="result-teams">
                  <div class="result-team">
                    <span class="result-team-flag">${t.flag}</span>
                    <span class="result-team-name">${t.name}</span>
                  </div>
                  <div class="result-score-box">${r.score}</div>
                  <div class="result-team">
                    <span class="result-team-name">${r.opponent}</span>
                  </div>
                </div>
                <span style="font-size:11px;color:var(--text3)">${r.competition}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <hr class="divider">

      <!-- FACTS -->
      <section>
        <div class="section-header">
          <h2 class="section-title">Interesting <span>Facts</span></h2>
        </div>
        <div class="facts-list stagger">
          ${t.facts.map((f,i) => `
            <div class="fact-item">
              <span class="fact-num">0${i+1}</span>
              <p class="fact-text">${f}</p>
            </div>
          `).join('')}
        </div>
      </section>

    </div>
  `;
}

function renderSquad(position, players) {
  return `
    <div class="squad-section">
      <div class="position-title">${position}</div>
      <table class="squad-table">
        ${players.map(p => `
          <tr>
            <td>
              <div class="squad-player-name">
                ${p.name}
                ${p.captain ? '<span class="captain-badge">C</span>' : ''}
              </div>
            </td>
            <td class="squad-club">${p.club}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}

function switchTab(tab) {
  document.getElementById('fixtures').style.display = tab === 'fixtures' ? 'block' : 'none';
  document.getElementById('results').style.display = tab === 'results' ? 'block' : 'none';
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.classList.toggle('active', (i === 0 && tab === 'fixtures') || (i === 1 && tab === 'results'));
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();

  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '') {
    initHomePage();
  }

  if (page === 'team.html') {
    initTeamPage();
  }

  if (page === 'predictions.html') {
    initPoll();
    initScorePrediction();
    initCrystalBall();
  }

  // Modal close
  document.getElementById('teamModal')?.addEventListener('click', e => {
    if (e.target.id === 'teamModal') closeModal();
  });
});
