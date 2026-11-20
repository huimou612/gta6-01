// Combat: a punch for close quarters and a pistol with a 12-round magazine,
// a muzzle flash, and armed hostiles for the final mission.
import * as THREE from 'three';
import { makeWalkerFigure } from './player.js';
import { makeRng } from './random.js';

const MAG_SIZE = 12;

export function createCombat(game) {
  const scene = game.scene;
  const rng = makeRng(game.seed + 55);
  const hostiles = [];
  let ammo = MAG_SIZE;
  let reloading = false;
  let reloadTimer = 0;
  let punchCooldown = 0;
  let flash = null;
  let flashTimer = 0;
  const raycaster = new THREE.Raycaster();

  function makeFlash() {
    const light = new THREE.PointLight(0xffc860, 0, 18);
    scene.add(light);
    const sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    scene.add(sprite);
    flash = { light, sprite };
  }
  makeFlash();

  function spawnHostiles(x, z, count) {
    for (let i = 0; i < count; i++) {
      const fig = makeWalkerFigure(scene, 0x1c1c22, 0x1c1c22);
      fig.group.position.set(x + rng.range(-4, 4), 0, z + rng.range(-4, 4));
      const hostile = {
        ...fig,
        pos: fig.group.position,
        yaw: rng.range(0, Math.PI * 2),
        health: 60,
        shootTimer: rng.range(1, 2.5),
        alive: true,
      };
      fig.group.rotation.y = hostile.yaw;
      // A dark pistol in the right hand.
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.55, 1.5, 0.35);
      fig.group.add(gun);
      hostiles.push(hostile);
    }
  }

  function punch() {
    if (punchCooldown > 0 || !game.player.onFoot || game.player.dead) return;
    punchCooldown = 0.5;
    game.audio.punch();
    const pp = game.player.pos;
    const forward = { x: Math.sin(game.player.yaw), z: Math.cos(game.player.yaw) };
    let hitAnything = false;
    for (const h of hostiles) {
      if (!h.alive) continue;
      const dx = h.pos.x - pp.x;
      const dz = h.pos.z - pp.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.6 && dx * forward.x + dz * forward.z > 0) {
        damageHostile(h, 25, pp);
        hitAnything = true;
      }
    }
    if (!hitAnything) {
      for (const ped of game.pedestrians.list) {
        if (ped.down) continue;
        const dx = ped.pos.x - pp.x;
        const dz = ped.pos.z - pp.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.4 && dx * forward.x + dz * forward.z > 0) {
          game.pedestrians.knockDown(ped, 5);
          game.police.addHeat(10);
          hitAnything = true;
        }
      }
    }
  }

  function shoot() {
    if (!game.player.onFoot || game.player.dead) return;
    if (reloading) return;
    if (ammo <= 0) {
      reload();
      return;
    }
    ammo--;
    game.audio.gunshot();
    game.police.addHeat(6);
    game.pedestrians.fleeAll(game.player.pos);
    // The shot goes from the camera through the crosshair.
    raycaster.setFromCamera({ x: 0, y: 0 }, game.camera);
    const targets = [];
    for (const h of hostiles) if (h.alive) targets.push(h.group);
    for (const ped of game.pedestrians.list) if (!ped.down) targets.push(ped.group);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const hit = hits[0];
      let obj = hit.object;
      while (obj.parent && obj.parent !== scene) obj = obj.parent;
      const hostile = hostiles.find((h) => h.group === obj);
      if (hostile) damageHostile(hostile, 34, game.player.pos);
      else {
        const ped = game.pedestrians.list.find((p) => p.group === obj);
        if (ped) {
          game.pedestrians.knockDown(ped, 8);
          game.police.addHeat(12);
        }
      }
    }
    // Muzzle flash at the player's hand, facing the camera.
    const hand = new THREE.Vector3();
    hand.copy(game.player.pos);
    hand.y = 1.5;
    hand.x += Math.sin(game.player.yaw) * 0.6;
    hand.z += Math.cos(game.player.yaw) * 0.6;
    flash.light.position.copy(hand);
    flash.light.intensity = 60;
    flash.sprite.position.copy(hand);
    flash.sprite.lookAt(game.camera.position);
    flash.sprite.material.opacity = 0.95;
    flashTimer = 0.07;
    game.hud.setAmmo(ammo, MAG_SIZE);
    if (ammo === 0) reload();
  }

  function damageHostile(hostile, amount, fromPos) {
    hostile.health -= amount;
    if (hostile.health <= 0 && hostile.alive) {
      hostile.alive = false;
      hostile.group.rotation.x = -Math.PI / 2;
      hostile.group.position.y = 0.4;
      game.missions.onHostileDown();
    } else {
      // A wounded hostile turns on whoever shot him.
      hostile.yaw = Math.atan2(fromPos.x - hostile.pos.x, fromPos.z - hostile.pos.z);
    }
  }

  function reload() {
    if (reloading || ammo === MAG_SIZE) return;
    reloading = true;
    reloadTimer = 1.2;
    game.audio.reload();
    game.hud.setAmmo(ammo, MAG_SIZE, true);
  }

  function update(dt) {
    punchCooldown = Math.max(0, punchCooldown - dt);
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flash.light.intensity = 0;
        flash.sprite.material.opacity = 0;
      }
    }
    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        reloading = false;
        ammo = MAG_SIZE;
        game.hud.setAmmo(ammo, MAG_SIZE);
      }
    }
    // Hostiles close in and shoot at Milo, badly but steadily.
    for (const h of hostiles) {
      if (!h.alive) continue;
      const pp = game.player.pos;
      const dx = pp.x - h.pos.x;
      const dz = pp.z - h.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 26) {
        const wantYaw = Math.atan2(dx, dz);
        h.yaw = wantYaw;
        h.pos.x += Math.sin(h.yaw) * 3.2 * dt;
        h.pos.z += Math.cos(h.yaw) * 3.2 * dt;
        h.group.rotation.y = h.yaw;
      } else {
        h.yaw = Math.atan2(dx, dz);
        h.group.rotation.y = h.yaw;
        h.shootTimer -= dt;
        if (h.shootTimer <= 0) {
          h.shootTimer = rng.range(1.2, 2.4);
          game.audio.gunshot();
          if (Math.random() < 0.45) game.player.hurt(7);
        }
      }
    }
  }

  return {
    hostiles,
    get ammo() {
      return ammo;
    },
    get magSize() {
      return MAG_SIZE;
    },
    punch,
    shoot,
    reload,
    spawnHostiles,
    update,
  };
}
