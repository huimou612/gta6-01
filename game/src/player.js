// Milo Vega on foot: a simple articulated figure, third-person movement relative to
// the camera, a walk cycle from swinging limbs, and a health pool the world can hurt.
import * as THREE from 'three';

export function createPlayer(scene, game) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e7d4f });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
  torso.position.y = 1.35;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 2.1;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.54), hair);
  hairTop.position.y = 2.38;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
  legL.position.set(-0.22, 0.43, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
  legR.position.set(0.22, 0.43, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), shirt);
  armL.position.set(-0.58, 1.35, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), shirt);
  armR.position.set(0.58, 1.35, 0);
  group.add(armR);
  scene.add(group);

  const player = {
    group,
    pos: group.position,
    yaw: 0,
    health: 100,
    onFoot: true,
    walkPhase: 0,
    moving: false,
    speed: 0,
    dead: false,

    place(x, z, yaw) {
      group.position.set(x, 0, z);
      this.yaw = yaw;
      group.rotation.y = yaw;
    },

    hurt(amount) {
      if (this.dead) return;
      this.health -= amount;
      game.audio.hurt();
      game.hud.damageFlash();
      if (this.health <= 0) {
        this.health = 0;
        this.dead = true;
        game.onPlayerDown();
      }
    },

    heal(amount) {
      this.health = Math.min(100, this.health + amount);
    },

    update(dt, input, camYaw) {
      if (!this.onFoot || this.dead) {
        this.moving = false;
        return;
      }
      let fx = 0;
      let fz = 0;
      if (input.forward) fz -= 1;
      if (input.back) fz += 1;
      if (input.left) fx -= 1;
      if (input.right) fx += 1;
      const len = Math.hypot(fx, fz);
      this.moving = len > 0;
      if (!this.moving) {
        this.speed = 0;
        legL.rotation.x = 0;
        legR.rotation.x = 0;
        armL.rotation.x = 0;
        armR.rotation.x = 0;
        return;
      }
      fx /= len;
      fz /= len;
      // Movement is relative to where the camera looks.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = fx * cos - fz * sin;
      const wz = fx * sin + fz * cos;
      const run = input.run ? 10.5 : 6;
      this.speed = run;
      const step = run * dt;
      group.position.x += wx * step;
      group.position.z += wz * step;
      this.yaw = Math.atan2(wx, wz);
      group.rotation.y = this.yaw;
      game.city.collideCircle(group.position, 0.6);
      // Walk cycle: legs and arms swing in opposition.
      this.walkPhase += dt * (input.run ? 13 : 9);
      const swing = Math.sin(this.walkPhase) * 0.55;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
    },
  };
  return player;
}

// A generic walker figure, reused for pedestrians and hostiles with a shirt colour.
export function makeWalkerFigure(scene, shirtColor, pantsColor = 0x3a3a44) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.42), shirt);
  torso.position.y = 1.3;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
  head.position.y = 2.02;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.34), pants);
  legL.position.set(-0.2, 0.4, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.34), pants);
  legR.position.set(0.2, 0.4, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), shirt);
  armL.position.set(-0.55, 1.3, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), shirt);
  armR.position.set(0.55, 1.3, 0);
  group.add(armR);
  scene.add(group);
  return { group, legL, legR, armL, armR };
}
