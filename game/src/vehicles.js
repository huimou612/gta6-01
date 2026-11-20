// Cars: the meshes, arcade driving physics, parked cars to steal, traffic looping
// the road grid, and a simple autopilot the staged screenshots use.
import * as THREE from 'three';
import { STREETS, ROAD_HALF, PLACES } from './city.js';
import { makeRng } from './random.js';

const CAR_COLORS = [0xd84a4a, 0x3f6fb5, 0xe8c95a, 0x4a9e6a, 0x8a5fb5, 0xe8e8e8, 0x2c2f36, 0xd8803a];

export function buildCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0x666622 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    lamp.position.set(x, 0.6, 2.22);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd81f1f, emissive: 0x550000 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    lamp.position.set(x, 0.6, -2.22);
    group.add(lamp);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x880000 }),
    );
    red.position.set(-0.35, 1.68, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x000088 }),
    );
    blue.position.set(0.35, 1.68, -0.2);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  return group;
}

export function createVehicles(game) {
  const scene = game.scene;
  const rng = makeRng(game.seed + 77);
  const traffic = [];
  const parked = [];
  let playerCar = null;

  // A rectangular loop around one block, driven as a parametric perimeter walk so
  // cars on the same loop can never catch each other.
  function makeLoop(blockX, blockZ) {
    const half = 28;
    const left = blockX - half;
    const right = blockX + half;
    const top = blockZ - half;
    const bottom = blockZ + half;
    const corners = [
      { x: left, z: top },
      { x: right, z: top },
      { x: right, z: bottom },
      { x: left, z: bottom },
    ];
    const segLen = [];
    let total = 0;
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      segLen.push(len);
      total += len;
    }
    return {
      total,
      pointAt(s) {
        let d = ((s % total) + total) % total;
        for (let i = 0; i < 4; i++) {
          if (d <= segLen[i]) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            const t = d / segLen[i];
            return {
              x: a.x + (b.x - a.x) * t,
              z: a.z + (b.z - a.z) * t,
              yaw: Math.atan2(b.x - a.x, b.z - a.z),
            };
          }
          d -= segLen[i];
        }
        return { x: corners[0].x, z: corners[0].z, yaw: 0 };
      },
    };
  }

  function spawnTraffic() {
    const loops = [];
    for (const bx of [-140, -84, -28, 28, 84, 140]) {
      for (const bz of [-140, -84, -28, 28, 84, 140]) {
        if (Math.abs(bx - PLACES.plaza.x) < 1 && Math.abs(bz - PLACES.plaza.z) < 1) continue;
        if (Math.abs(bx - PLACES.garage.x) < 1 && Math.abs(bz - PLACES.garage.z) < 1) continue;
        loops.push(makeLoop(bx, bz));
      }
    }
    for (let i = 0; i < 14; i++) {
      const loop = loops[i % loops.length];
      const color = CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)];
      const mesh = buildCarMesh(color);
      scene.add(mesh);
      traffic.push({
        mesh,
        loop,
        s: rng.range(0, loop.total),
        speed: rng.range(7, 12),
        color,
        driver: true,
      });
    }
  }

  function spawnParked() {
    const spots = [
      { x: 62, z: 40, yaw: Math.PI / 2 },
      { x: 62, z: 100, yaw: Math.PI / 2 },
      { x: 50, z: -40, yaw: -Math.PI / 2 },
      { x: -50, z: 60, yaw: Math.PI / 2 },
      { x: 118, z: -20, yaw: -Math.PI / 2 },
      { x: -118, z: 140, yaw: Math.PI / 2 },
      { x: 6, z: 118, yaw: 0 },
      { x: -62, z: -100, yaw: -Math.PI / 2 },
      { x: 118, z: 84, yaw: Math.PI / 2 },
      { x: -6, z: -118, yaw: Math.PI },
    ];
    for (const spot of spots) {
      const color = CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)];
      const mesh = buildCarMesh(color);
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = spot.yaw;
      scene.add(mesh);
      parked.push({
        mesh,
        pos: mesh.position,
        yaw: spot.yaw,
        speed: 0,
        color,
        driver: rng.chance(0.4),
        occupied: false,
      });
    }
  }

  function driveCar(car, dt, input) {
    const maxSpeed = 34;
    const accel = 16;
    const brake = 30;
    if (input.forward) car.speed += accel * dt;
    else if (input.back) car.speed -= (car.speed > 0.5 ? brake : accel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    car.speed = Math.max(-12, Math.min(maxSpeed, car.speed));
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerAmount = steerInput * 0.55 * Math.min(1, Math.abs(car.speed) / 8);
    const grip = input.handbrake ? 0.35 : 1;
    car.yaw += steerAmount * Math.sign(car.speed) * dt * 1.9 * grip;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    if (input.handbrake && Math.abs(car.speed) > 6) {
      // A handbrake slide: the car keeps some of its old sideways motion.
      car.pos.x += Math.cos(car.yaw) * car.speed * 0.12 * dt;
      car.pos.z -= Math.sin(car.yaw) * car.speed * 0.12 * dt;
    }
    game.city.collideCircle(car.pos, 1.6);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
    car.mesh.rotation.z = -steerInput * 0.04 * Math.min(1, Math.abs(car.speed) / 12);
  }

  // Autopilot for staged screenshots: steer toward waypoints along a boulevard.
  function autoDrive(car, dt, waypoints) {
    const target = waypoints[car.wpIndex || 0];
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 8) {
      car.wpIndex = ((car.wpIndex || 0) + 1) % waypoints.length;
      return;
    }
    const wantYaw = Math.atan2(dx, dz);
    let diff = wantYaw - car.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.speed = Math.min(car.speed + 12 * dt, 20);
    car.yaw += Math.max(-1, Math.min(1, diff * 2)) * dt * 1.6;
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    game.city.collideCircle(car.pos, 1.6);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of [...parked, ...traffic]) {
      if (car === playerCar) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (car.driver && !car.occupied) {
      // Carjacking: the driver runs off and the law notices.
      car.driver = false;
      game.police.addHeat(20);
      game.hud.toast('You jacked the car! The driver ran for the police.');
      game.pedestrians.spawnFleeing(car.pos.x + 2, car.pos.z + 2);
    }
    playerCar = car;
    car.occupied = true;
    game.player.onFoot = false;
    game.player.group.visible = false;
    game.audio.engine(true, 0);
    game.hud.setDriving(true);
  }

  function exitCar() {
    if (!playerCar) return;
    const car = playerCar;
    playerCar = null;
    car.occupied = false;
    car.speed = 0;
    game.player.onFoot = true;
    game.player.group.visible = true;
    const side = { x: car.pos.x + Math.cos(car.yaw) * 2.2, z: car.pos.z - Math.sin(car.yaw) * 2.2 };
    game.city.collideCircle(side, 0.6);
    game.player.place(side.x, side.z, car.yaw);
    game.audio.engine(false, 0);
    game.hud.setDriving(false);
  }

  function update(dt, input) {
    for (const car of traffic) {
      car.s += car.speed * dt;
      const p = car.loop.pointAt(car.s);
      car.mesh.position.set(p.x, 0, p.z);
      car.mesh.rotation.y = p.yaw;
      car.pos = car.mesh.position;
      car.yaw = p.yaw;
    }
    if (playerCar) {
      if (game.shotMode) {
        autoDrive(playerCar, dt, game.shotWaypoints || []);
      } else {
        driveCar(playerCar, dt, input);
      }
      game.audio.engine(true, Math.abs(playerCar.speed) / 34);
      // Bumping a pedestrian at speed is a crime, and it hurts.
      for (const ped of game.pedestrians.list) {
        if (ped.down) continue;
        const d = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
        if (d < 2.2 && Math.abs(playerCar.speed) > 4) {
          game.pedestrians.knockDown(ped, playerCar.speed);
          game.police.addHeat(15);
          game.audio.crash();
        }
      }
    }
  }

  spawnTraffic();
  spawnParked();

  return {
    traffic,
    parked,
    get playerCar() {
      return playerCar;
    },
    update,
    nearestCar,
    enterCar,
    exitCar,
    autoDrive,
    // Put the player in a fresh car at a spot, for missions and staged shots.
    giveCar(x, z, yaw, color) {
      const mesh = buildCarMesh(color ?? 0xd84a4a);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = yaw;
      scene.add(mesh);
      const car = { mesh, pos: mesh.position, yaw, speed: 0, color: color ?? 0xd84a4a, driver: false, occupied: true, wpIndex: 0 };
      parked.push(car);
      playerCar = car;
      game.player.onFoot = false;
      game.player.group.visible = false;
      game.hud.setDriving(true);
      return car;
    },
  };
}
