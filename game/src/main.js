// Solmar — entry point. Builds the world, runs the loop, owns the screens, the input
// and the third-person camera, and ties every system together.
import * as THREE from 'three';
import { buildCity, PLACES } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

const game = {
  scene,
  camera,
  seed,
  state: 'title',
  shotMode: false,
  shotWaypoints: [],
  money: 0,
  time: 0,
  cameraRig: { mode: 'orbit', yaw: 0, pitch: 0.28, dist: 9, height: 3.5 },
};
game.audio = createAudio();
game.city = buildCity(scene, seed);
game.player = createPlayer(scene, game);
game.vehicles = createVehicles(game);
game.pedestrians = createPedestrians(game);
game.police = createPolice(game);
game.combat = createCombat(game);
game.missions = createMissions(game);
game.hud = createHud(game);
window.__solmar = game;

game.addMoney = (n) => {
  game.money += n;
  game.hud.setMoney(game.money);
};

game.saveProgress = () => {
  storeSave({ money: game.money, done: game.missions.list.filter((m) => m.done).map((m) => m.id) });
};

game.onPlayerDown = () => {
  game.state = 'over';
  game.audio.engine(false, 0);
  game.audio.siren(false);
  game.audio.setMusic(false);
  document.getElementById('over-title').textContent = game.police.wanted > 0 ? 'BUSTED' : 'WASTED';
  document.getElementById('over-text').textContent =
    game.police.wanted > 0
      ? 'The Solmar police finally caught up with Milo.'
      : 'Solmar got the better of Milo this time.';
  game.hud.showScreen('screen-over');
  if (document.pointerLockElement) document.exitPointerLock();
};

// ---- input ---------------------------------------------------------------
const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
  handbrake: false,
};
const KEYMAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'handbrake',
};
addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  const name = KEYMAP[e.code];
  if (name) input[name] = true;
  if (e.repeat) return;
  if (e.code === 'KeyE' && game.state === 'playing') onInteract();
  if (e.code === 'KeyF' && game.state === 'playing') game.combat.punch();
  if (e.code === 'KeyR' && game.state === 'playing') game.combat.reload();
  if (e.code === 'KeyM') toggleMissions();
  if (e.code === 'Escape') togglePause();
});
addEventListener('keyup', (e) => {
  const name = KEYMAP[e.code];
  if (name) input[name] = false;
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (game.state !== 'playing') return;
  game.cameraRig.yaw -= e.movementX * 0.0028;
  game.cameraRig.pitch = Math.max(-0.1, Math.min(0.9, game.cameraRig.pitch + e.movementY * 0.0022));
});
renderer.domElement.addEventListener('click', () => {
  if (game.state !== 'playing') return;
  game.audio.unlock();
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
    return;
  }
  game.combat.shoot();
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function onInteract() {
  if (game.missions.tryInteract()) return;
  if (game.player.onFoot) {
    const car = game.vehicles.nearestCar(game.player.pos, 4.5);
    if (car) game.vehicles.enterCar(car);
  } else {
    game.vehicles.exitCar();
  }
}

function toggleMissions() {
  if (game.state === 'playing') {
    game.state = 'missions';
    game.hud.renderMissionList();
    game.hud.showScreen('screen-missions');
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (game.state === 'missions') {
    game.state = 'playing';
    game.hud.showScreen(null);
  }
}

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    game.audio.engine(false, 0);
    game.hud.showScreen('screen-pause');
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (game.state === 'paused') {
    game.state = 'playing';
    game.hud.showScreen(null);
  }
}

// ---- screens -------------------------------------------------------------
function startGame(fresh) {
  game.audio.unlock();
  game.audio.setMusic(true);
  if (fresh) {
    game.money = 0;
    game.player.health = 100;
    game.player.dead = false;
    game.player.place(PLACES.spawn.x, PLACES.spawn.z, Math.PI / 2);
    game.missions.startNext();
    game.hud.setObjective(game.missions.objectiveText());
  }
  game.state = 'playing';
  game.hud.showScreen(null);
  game.cameraRig.yaw = game.player.yaw;
  game.cameraRig.pitch = 0.28;
  game.hud.setMoney(game.money);
  game.hud.setHealth(game.player.health);
  game.hud.setAmmo(game.combat.ammo, game.combat.magSize);
  game.hud.setWanted(game.police.wanted);
  renderer.domElement.requestPointerLock();
}

document.getElementById('btn-start').addEventListener('click', () => {
  game.audio.click();
  startGame(true);
});
document.getElementById('btn-continue').addEventListener('click', () => {
  game.audio.click();
  startGame(false);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  game.audio.click();
  game.state = 'playing';
  game.hud.showScreen(null);
});
document.getElementById('btn-restart').addEventListener('click', () => {
  game.audio.click();
  location.reload();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  game.saveProgress();
  location.reload();
});
document.getElementById('btn-retry').addEventListener('click', () => {
  game.audio.click();
  location.reload();
});
document.getElementById('btn-over-title').addEventListener('click', () => {
  game.saveProgress();
  location.reload();
});
document.getElementById('btn-close-missions').addEventListener('click', () => toggleMissions());

// ---- camera --------------------------------------------------------------
function updateCamera(dt) {
  const rig = game.cameraRig;
  const focus = new THREE.Vector3();
  if (game.vehicles.playerCar) {
    const car = game.vehicles.playerCar;
    focus.copy(car.pos);
    focus.y = 1.6;
    let yaw;
    if (rig.mode === 'chase') {
      yaw = car.yaw;
      rig.yaw = yaw;
    } else {
      yaw = rig.yaw;
    }
    const dist = rig.dist + 2;
    const cx = focus.x - Math.sin(yaw) * dist;
    const cz = focus.z - Math.cos(yaw) * dist;
    const cy = focus.y + rig.height + 1;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.exp(-6 * dt));
    camera.lookAt(focus.x, focus.y + 0.4, focus.z);
  } else {
    focus.copy(game.player.pos);
    focus.y = 1.8;
    const cx = focus.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
    const cz = focus.z - Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
    const cy = focus.y + Math.sin(rig.pitch) * rig.dist + 0.6;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.exp(-8 * dt));
    camera.lookAt(focus);
  }
}

// ---- boot ----------------------------------------------------------------
const saved = loadSave();
if (saved && (saved.money > 0 || saved.done.length > 0)) {
  game.money = saved.money;
  game.missions.restore(saved.done);
  document.getElementById('btn-continue').classList.remove('hidden');
  document.getElementById('btn-start').textContent = 'NEW GAME';
  game.player.place(PLACES.spawn.x, PLACES.spawn.z, Math.PI / 2);
  game.hud.setMoney(game.money);
} else {
  game.player.place(PLACES.spawn.x, PLACES.spawn.z, Math.PI / 2);
}

if (shot) {
  stageShot(game, shot);
} else {
  game.hud.showScreen('screen-start');
  game.cameraRig.yaw = Math.PI * 0.75;
  // A slow establishing orbit behind the title screen.
  game.titleOrbit = 0;
}

// ---- loop ----------------------------------------------------------------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.time += dt;
  const t = game.time;
  game.city.update(dt, t);
  if (game.state === 'playing') {
    game.player.update(dt, input, game.cameraRig.yaw);
    game.vehicles.update(dt, input);
    game.pedestrians.update(dt);
    game.police.update(dt);
    game.combat.update(dt);
    game.missions.update(dt, t);
    game.hud.update(dt);
    updateCamera(dt);
  } else if (game.state === 'title' && !shot) {
    game.titleOrbit += dt * 0.05;
    const a = game.titleOrbit;
    camera.position.set(Math.sin(a) * 90, 42, Math.cos(a) * 90);
    camera.lookAt(PLACES.plaza.x, 4, PLACES.plaza.z);
    game.pedestrians.update(dt);
    game.vehicles.update(dt, input);
  }
  renderer.render(scene, camera);
}
loop();
