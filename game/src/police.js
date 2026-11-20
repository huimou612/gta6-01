// The law in Solmar: a wanted level from 0 to 5 stars, police cruisers that chase,
// ram and flash their light bars, and heat that cools off when Milo stays clean.
import * as THREE from 'three';
import { CITY_EDGE } from './city.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(game) {
  const scene = game.scene;
  const cruisers = [];
  let heat = 0;
  let wanted = 0;
  let cleanTimer = 0;
  let flashT = 0;

  function wantedForHeat(h) {
    if (h <= 0) return 0;
    if (h < 25) return 1;
    if (h < 50) return 2;
    if (h < 80) return 3;
    if (h < 120) return 4;
    return 5;
  }

  function spawnCruiser() {
    const mesh = buildCarMesh(0xf0f0f0, true);
    // Appear at a road edge away from the player.
    const angle = Math.random() * Math.PI * 2;
    const x = game.player.pos.x + Math.cos(angle) * 90;
    const z = game.player.pos.z + Math.sin(angle) * 90;
    mesh.position.set(
      Math.max(-CITY_EDGE, Math.min(CITY_EDGE, x)),
      0,
      Math.max(-CITY_EDGE, Math.min(CITY_EDGE, z)),
    );
    scene.add(mesh);
    const cruiser = { mesh, pos: mesh.position, yaw: 0, speed: 0, ramCooldown: 0 };
    cruisers.push(cruiser);
    return cruiser;
  }

  function removeCruiser(cruiser) {
    scene.remove(cruiser.mesh);
    const i = cruisers.indexOf(cruiser);
    if (i >= 0) cruisers.splice(i, 1);
  }

  function syncCruisers() {
    const want = wanted === 0 ? 0 : Math.min(5, wanted + 1);
    while (cruisers.length < want) spawnCruiser();
    while (cruisers.length > want) removeCruiser(cruisers[cruisers.length - 1]);
  }

  function addHeat(n) {
    heat = Math.min(150, heat + n);
    cleanTimer = 0;
    const w = wantedForHeat(heat);
    if (w !== wanted) {
      wanted = w;
      syncCruisers();
      game.hud.setWanted(wanted);
      if (wanted > 0) game.hud.toast(`Wanted level ${wanted} — the police are coming!`);
    }
  }

  function setWanted(level) {
    const targets = [0, 12, 35, 65, 100, 140];
    heat = targets[Math.max(0, Math.min(5, level))];
    wanted = wantedForHeat(heat);
    syncCruisers();
    game.hud.setWanted(wanted);
  }

  function clearHeat() {
    heat = 0;
    wanted = 0;
    syncCruisers();
    game.hud.setWanted(0);
  }

  function chase(dt, cruiser, targetPos) {
    const dx = targetPos.x - cruiser.pos.x;
    const dz = targetPos.z - cruiser.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz);
    let diff = wantYaw - cruiser.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const topSpeed = 24 + wanted * 1.5;
    cruiser.speed = Math.min(cruiser.speed + 14 * dt, topSpeed);
    cruiser.yaw += Math.max(-1.4, Math.min(1.4, diff * 2.5)) * dt;
    cruiser.pos.x += Math.sin(cruiser.yaw) * cruiser.speed * dt;
    cruiser.pos.z += Math.cos(cruiser.yaw) * cruiser.speed * dt;
    game.city.collideCircle(cruiser.pos, 1.6);
    cruiser.mesh.position.copy(cruiser.pos);
    cruiser.mesh.rotation.y = cruiser.yaw;
    cruiser.ramCooldown -= dt;
    if (dist < 3.2 && cruiser.ramCooldown <= 0) {
      cruiser.ramCooldown = 1.2;
      game.audio.crash();
      if (game.vehicles.playerCar) {
        const car = game.vehicles.playerCar;
        car.speed *= 0.55;
        game.player.hurt(6);
      } else {
        game.player.hurt(10);
      }
      // A hard ram shoves the cruiser back so it can come around again.
      cruiser.pos.x -= Math.sin(cruiser.yaw) * 4;
      cruiser.pos.z -= Math.cos(cruiser.yaw) * 4;
      cruiser.speed = 4;
    }
  }

  function update(dt) {
    flashT += dt;
    const on = Math.floor(flashT * 6) % 2 === 0;
    for (const c of cruisers) {
      if (c.mesh.userData.lightRed) c.mesh.userData.lightRed.material.emissive.setHex(on ? 0xff0000 : 0x330000);
      if (c.mesh.userData.lightBlue) c.mesh.userData.lightBlue.material.emissive.setHex(on ? 0x0000ff : 0x000033);
    }
    if (wanted === 0) {
      game.audio.siren(false);
      return;
    }
    game.audio.siren(true);
    cleanTimer += dt;
    if (cleanTimer > 14) {
      // Staying clean cools the heat off, a star at a time.
      heat = Math.max(0, heat - 12 * dt);
      const w = wantedForHeat(heat);
      if (w !== wanted) {
        wanted = w;
        syncCruisers();
        game.hud.setWanted(wanted);
        if (wanted === 0) game.hud.toast('You lost the heat. Stay clean.');
      }
    }
    const targetPos = game.vehicles.playerCar ? game.vehicles.playerCar.pos : game.player.pos;
    for (const cruiser of [...cruisers]) chase(dt, cruiser, targetPos);
  }

  return {
    cruisers,
    get wanted() {
      return wanted;
    },
    get heat() {
      return heat;
    },
    addHeat,
    setWanted,
    clearHeat,
    update,
  };
}
