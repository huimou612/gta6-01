// The HUD: health, money, wanted stars, speed and ammo, a canvas minimap, the
// objective line and dialogue, plus the start, pause, game-over and mission screens.
// All of it is plain DOM over the WebGL canvas.
import { STREETS, CITY_EDGE, BEACH_START, WATER_START, PLACES } from './city.js';

export function createHud(game) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="health-row"><span class="hud-label">HEALTH</span><div id="health-bar"><div id="health-fill"></div></div></div>
      <div id="money-row"><span class="hud-label">CASH</span><span id="money">$0</span></div>
      <div id="stars-row"></div>
    </div>
    <div id="hud-top-right"><canvas id="minimap" width="180" height="180"></canvas></div>
    <div id="objective"></div>
    <div id="dialogue"></div>
    <div id="toast"></div>
    <div id="hud-bottom-left"><div id="speed">0 mph</div><div id="ammo"></div></div>
    <div id="crosshair">+</div>
    <div id="damage-flash"></div>
    <div id="screen-start" class="screen">
      <h1>SOLMAR</h1>
      <p class="tagline">A sun-soaked open-world crime story</p>
      <p class="story">Milo Vega drives for his sister Ana's garage, Vega Motors — and the garage owes
      loan shark Dom Falco $1,200. Three jobs. One city. No brakes.</p>
      <div class="controls">
        <div><b>WASD</b> move / drive</div><div><b>Mouse</b> look</div>
        <div><b>Shift</b> run</div><div><b>E</b> enter / exit car</div>
        <div><b>Space</b> handbrake</div><div><b>F</b> punch &nbsp; <b>Click</b> shoot</div>
        <div><b>R</b> reload</div><div><b>M</b> missions &nbsp; <b>Esc</b> pause</div>
      </div>
      <button id="btn-start">START ENGINE</button>
      <button id="btn-continue" class="hidden">CONTINUE</button>
      <p class="hint">Click START, then click the game to lock the mouse.</p>
    </div>
    <div id="screen-pause" class="screen hidden">
      <h1>PAUSED</h1>
      <p class="story">Solmar waits for no one. Well — right now it does.</p>
      <button id="btn-resume">RESUME</button>
      <button id="btn-restart">RESTART</button>
      <button id="btn-quit">SAVE &amp; QUIT TO TITLE</button>
    </div>
    <div id="screen-over" class="screen hidden">
      <h1 id="over-title">WASTED</h1>
      <p class="story" id="over-text">Solmar got the better of Milo this time.</p>
      <button id="btn-retry">TRY AGAIN</button>
      <button id="btn-over-title">TITLE SCREEN</button>
    </div>
    <div id="screen-missions" class="screen hidden">
      <h1>JOBS</h1>
      <div id="mission-list"></div>
      <button id="btn-close-missions">CLOSE (M)</button>
    </div>`;

  const moneyEl = document.getElementById('money');
  const healthFill = document.getElementById('health-fill');
  const starsRow = document.getElementById('stars-row');
  const objectiveEl = document.getElementById('objective');
  const dialogueEl = document.getElementById('dialogue');
  const toastEl = document.getElementById('toast');
  const speedEl = document.getElementById('speed');
  const ammoEl = document.getElementById('ammo');
  const crosshair = document.getElementById('crosshair');
  const damageFlashEl = document.getElementById('damage-flash');
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');
  let dialogueTimer = null;
  let toastTimer = null;
  let driving = false;

  function showScreen(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    if (id) document.getElementById(id).classList.remove('hidden');
    const inGame = !id;
    root.classList.toggle('playing', inGame);
    crosshair.style.display = inGame && game.player.onFoot ? 'block' : 'none';
  }

  function setHealth(h) {
    healthFill.style.width = `${Math.max(0, Math.min(100, h))}%`;
    healthFill.style.background = h > 50 ? '#4caf50' : h > 25 ? '#ff9800' : '#f44336';
  }

  function setMoney(m) {
    moneyEl.textContent = `$${Math.floor(m)}`;
  }

  function setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < n ? '★' : '☆';
    starsRow.textContent = stars;
    starsRow.style.color = n > 0 ? '#ffd23a' : '#ffffff88';
  }

  function setObjective(text) {
    objectiveEl.textContent = text;
  }

  function setAmmo(ammo, mag, reloading) {
    ammoEl.textContent = reloading ? 'RELOADING…' : `AMMO ${ammo} / ${mag}`;
  }

  function setDriving(d) {
    driving = d;
    speedEl.style.display = d ? 'block' : 'none';
    ammoEl.style.display = d ? 'none' : 'block';
  }

  function showDialogue(text, seconds) {
    dialogueEl.textContent = text;
    dialogueEl.classList.add('visible');
    if (dialogueTimer) clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => dialogueEl.classList.remove('visible'), (seconds || 5) * 1000);
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 4000);
  }

  function damageFlash() {
    damageFlashEl.style.opacity = '0.45';
    setTimeout(() => {
      damageFlashEl.style.opacity = '0';
    }, 120);
  }

  function renderMissionList() {
    const list = document.getElementById('mission-list');
    list.innerHTML = game.missions.list
      .map(
        (m) => `<div class="mission-item ${m.done ? 'done' : ''}">
          <div class="mission-name">${m.done ? '✓ ' : ''}${m.name} — $${m.reward}</div>
          <div class="mission-desc">${m.desc}</div>
          <div class="mission-state">${m.done ? 'COMPLETE' : game.missions.active === m ? 'IN PROGRESS' : 'LOCKED UNTIL THE LAST JOB IS DONE'}</div>
        </div>`,
      )
      .join('');
  }

  // The minimap: roads, beach, the player arrow, police dots and the mission diamond.
  function drawMinimap() {
    const W = 180;
    const H = 180;
    const span = CITY_EDGE + 80;
    const toMap = (x, z) => [((x + span) / (span * 2)) * W, ((z + span) / (span * 2)) * H];
    mm.fillStyle = '#1d2b1d';
    mm.fillRect(0, 0, W, H);
    // Sea and sand.
    const [, wy] = toMap(0, WATER_START);
    mm.fillStyle = '#1f6fa8';
    mm.fillRect(0, wy, W, H - wy);
    const [, by] = toMap(0, BEACH_START);
    mm.fillStyle = '#e8d49a';
    mm.fillRect(0, by, W, wy - by);
    // Roads.
    mm.strokeStyle = '#555a63';
    mm.lineWidth = 4;
    for (const s of STREETS) {
      const [x1] = toMap(s, 0);
      mm.beginPath();
      mm.moveTo(x1, 0);
      mm.lineTo(x1, H);
      mm.stroke();
      const [, z1] = toMap(0, s);
      mm.beginPath();
      mm.moveTo(0, z1);
      mm.lineTo(W, z1);
      mm.stroke();
    }
    // Plaza and garage.
    const [px, pz] = toMap(PLACES.plaza.x, PLACES.plaza.z);
    mm.fillStyle = '#ffd23a';
    mm.beginPath();
    mm.arc(px, pz, 4, 0, Math.PI * 2);
    mm.fill();
    const [gx, gz] = toMap(PLACES.garage.x, PLACES.garage.z);
    mm.fillStyle = '#3f6fb5';
    mm.fillRect(gx - 4, gz - 4, 8, 8);
    // Mission diamond.
    const target = game.missions.target;
    if (target) {
      const [tx, tz] = toMap(target.x, target.z);
      mm.fillStyle = '#ffd23a';
      mm.beginPath();
      mm.moveTo(tx, tz - 7);
      mm.lineTo(tx + 6, tz);
      mm.lineTo(tx, tz + 7);
      mm.lineTo(tx - 6, tz);
      mm.closePath();
      mm.fill();
    }
    // Traffic as grey dots, police as red dots.
    mm.fillStyle = '#bbbbbb';
    for (const car of game.vehicles.traffic) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      mm.fillRect(cx - 1, cz - 1, 2, 2);
    }
    mm.fillStyle = '#ff4040';
    for (const c of game.police.cruisers) {
      const [cx, cz] = toMap(c.pos.x, c.pos.z);
      mm.beginPath();
      mm.arc(cx, cz, 3, 0, Math.PI * 2);
      mm.fill();
    }
    // The player arrow, pointing where Milo (or his car) faces.
    const pp = game.vehicles.playerCar ? game.vehicles.playerCar.pos : game.player.pos;
    const yaw = game.vehicles.playerCar ? game.vehicles.playerCar.yaw : game.player.yaw;
    const [ux, uz] = toMap(pp.x, pp.z);
    mm.save();
    mm.translate(ux, uz);
    mm.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) + Math.PI);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.restore();
  }

  function update(dt) {
    setHealth(game.player.health);
    setMoney(game.money);
    if (game.vehicles.playerCar) {
      speedEl.textContent = `${Math.round(Math.abs(game.vehicles.playerCar.speed) * 2.2)} mph`;
      speedEl.style.display = 'block';
      ammoEl.style.display = 'none';
    } else {
      speedEl.style.display = 'none';
      ammoEl.style.display = 'block';
    }
    drawMinimap();
    if (game.player.onFoot) crosshair.style.display = 'block';
    else crosshair.style.display = 'none';
  }

  return {
    showScreen,
    setHealth,
    setMoney,
    setWanted,
    setObjective,
    setAmmo,
    setDriving,
    showDialogue,
    toast,
    damageFlash,
    renderMissionList,
    update,
  };
}
