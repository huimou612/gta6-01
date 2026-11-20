// Pedestrians: Solmar's walkers. They stroll the sidewalks, run from gunfire, and
// go down when a car or a bullet catches them.
import * as THREE from 'three';
import { STREETS } from './city.js';
import { makeRng } from './random.js';
import { makeWalkerFigure } from './player.js';

const SHIRTS = [0xc96a3a, 0x3f6fb5, 0xe8c95a, 0x8a5fb5, 0xd84a4a, 0x4a9e6a, 0xe8e8e8, 0x5a7a8a];

export function createPedestrians(game) {
  const scene = game.scene;
  const rng = makeRng(game.seed + 31);
  const list = [];

  function sidewalkPoint() {
    // A point just off a road, on a sidewalk edge.
    const s = STREETS[rng.int(0, STREETS.length - 1)];
    const t = rng.range(-180, 180);
    const side = rng.chance(0.5) ? 8 : -8;
    return rng.chance(0.5) ? { x: s + side, z: t } : { x: t, z: s + side };
  }

  function spawnOne(x, z) {
    const fig = makeWalkerFigure(scene, SHIRTS[rng.int(0, SHIRTS.length - 1)]);
    const start = x !== undefined ? { x, z } : sidewalkPoint();
    fig.group.position.set(start.x, 0, start.z);
    const ped = {
      ...fig,
      pos: fig.group.position,
      yaw: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      phase: rng.range(0, Math.PI * 2),
      state: 'walk',
      down: false,
      downTimer: 0,
      target: sidewalkPoint(),
      fleeFrom: null,
    };
    fig.group.rotation.y = ped.yaw;
    list.push(ped);
    return ped;
  }

  for (let i = 0; i < 22; i++) spawnOne();

  function spawnFleeing(x, z) {
    const ped = spawnOne(x, z);
    ped.state = 'flee';
    ped.fleeFrom = { x, z };
    return ped;
  }

  function knockDown(ped, speed) {
    if (ped.down) return;
    ped.down = true;
    ped.downTimer = 6;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.4;
    ped.state = 'down';
  }

  function fleeAll(from) {
    for (const ped of list) {
      if (ped.down) continue;
      const d = Math.hypot(ped.pos.x - from.x, ped.pos.z - from.z);
      if (d < 30) {
        ped.state = 'flee';
        ped.fleeFrom = { x: from.x, z: from.z };
      }
    }
  }

  function update(dt) {
    for (const ped of list) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.state = 'walk';
          ped.group.rotation.x = 0;
          ped.group.position.y = 0;
          ped.target = sidewalkPoint();
        }
        continue;
      }
      let tx;
      let tz;
      let speed = ped.speed;
      if (ped.state === 'flee' && ped.fleeFrom) {
        // Run away from the scare, then calm down and stroll again.
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.pos.x + (dx / d) * 20;
        tz = ped.pos.z + (dz / d) * 20;
        speed = 5.5;
        if (d > 40) {
          ped.state = 'walk';
          ped.target = sidewalkPoint();
        }
      } else {
        tx = ped.target.x;
        tz = ped.target.z;
        const d = Math.hypot(tx - ped.pos.x, tz - ped.pos.z);
        if (d < 1.5) ped.target = sidewalkPoint();
      }
      const dx = tx - ped.pos.x;
      const dz = tz - ped.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const wantYaw = Math.atan2(dx, dz);
        let diff = wantYaw - ped.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.yaw += Math.max(-3, Math.min(3, diff * 6)) * dt;
        ped.pos.x += Math.sin(ped.yaw) * speed * dt;
        ped.pos.z += Math.cos(ped.yaw) * speed * dt;
        ped.phase += dt * (ped.state === 'flee' ? 12 : 7);
        const swing = Math.sin(ped.phase) * 0.5;
        ped.legL.rotation.x = swing;
        ped.legR.rotation.x = -swing;
        ped.armL.rotation.x = -swing * 0.8;
        ped.armR.rotation.x = swing * 0.8;
        game.city.collideCircle(ped.pos, 0.5);
      }
      ped.group.rotation.y = ped.yaw;
    }
  }

  return { list, update, spawnOne, spawnFleeing, knockDown, fleeAll };
}
