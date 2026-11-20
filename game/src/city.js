// Solmar, the city: a procedural coastal town built from boxes, planes and canvas
// textures. Streets run on a grid, downtown towers stand to the north, Solmar Plaza
// holds the fountain at the middle, and the beach and marina lie to the south.
import * as THREE from 'three';
import { makeRng } from './random.js';

export const STREETS = [-168, -112, -56, 0, 56, 112, 168];
export const ROAD_HALF = 6;
export const CITY_EDGE = 196;
export const BEACH_START = 196;
export const WATER_START = 250;

// The places the story cares about.
export const PLACES = {
  plaza: { x: -28, z: -28 },
  garage: { x: 84, z: 84 },
  garageFront: { x: 58, z: 84 },
  marina: { x: 112, z: 240 },
  docks: { x: 112, z: 292 },
  beachHouse: { x: 140, z: 218 },
  safehouse: { x: 140, z: 218 },
  spawn: { x: 58, z: 84 },
};

function facadeTexture(base, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 8 + col * 20;
      const y = 10 + row * 20;
      g.fillStyle = Math.random() < lit ? '#ffe9a8' : '#20242e';
      g.fillRect(x, y, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
  trunk.position.y = 3;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  group.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 6.1, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), leafMat);
  top.position.y = 6.2;
  top.scale.y = 0.6;
  group.add(top);
  return group;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const colliders = [];
  const animated = { water: null, fountainSpray: null, clouds: [] };

  // Sky, sun and light.
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0ea, 260, 700);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.7);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  // Ground: one big slab, then roads, sidewalks and sand on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ color: 0x9aa578 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xd8c95a });
  for (const s of STREETS) {
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(392, ROAD_HALF * 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (vertical) {
        road.rotation.z = Math.PI / 2;
        road.position.set(s, 0.02, 0);
      } else {
        road.position.set(0, 0.02, s);
      }
      scene.add(road);
      // Dashed centre line, built from small strips.
      for (let t = -186; t <= 186; t += 14) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        if (vertical) {
          dash.rotation.z = Math.PI / 2;
          dash.position.set(s, 0.03, t);
        } else {
          dash.position.set(t, 0.03, s);
        }
        scene.add(dash);
      }
    }
  }

  // Sidewalk slabs under every block.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  const blockCenters = [];
  for (let i = 0; i < STREETS.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const cx = (STREETS[i] + STREETS[i + 1]) / 2;
      const cz = (STREETS[j] + STREETS[j + 1]) / 2;
      blockCenters.push({ x: cx, z: cz });
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.01, cz);
      scene.add(slab);
    }
  }

  // Beach sand and the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(520, WATER_START - BEACH_START + 8),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.015, (BEACH_START + WATER_START) / 2);
  scene.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 220),
    new THREE.MeshPhongMaterial({ color: 0x1f7ab8, shininess: 120, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, WATER_START + 110);
  scene.add(water);
  animated.water = water;

  // Buildings, one per block, with a park here and there. The plaza block and the
  // garage block are left clear for their own landmarks.
  const facades = [
    facadeTexture('#a89a86', 0.35),
    facadeTexture('#93a5b5', 0.3),
    facadeTexture('#b3a593', 0.35),
    facadeTexture('#ab9c86', 0.25),
  ];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of blockCenters) {
    const isPlaza = Math.abs(b.x - PLACES.plaza.x) < 1 && Math.abs(b.z - PLACES.plaza.z) < 1;
    const isGarage = Math.abs(b.x - PLACES.garage.x) < 1 && Math.abs(b.z - PLACES.garage.z) < 1;
    if (isPlaza || isGarage) continue;
    if (rng.chance(0.14)) {
      // A pocket park: grass, a few palms and a bench block.
      for (let k = 0; k < 4; k++) {
        const palm = makePalm(rng);
        palm.position.set(b.x + rng.range(-16, 16), 0, b.z + rng.range(-16, 16));
        scene.add(palm);
      }
      const lawn = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshLambertMaterial({ color: 0x6f9e4f }),
      );
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(b.x, 0.02, b.z);
      scene.add(lawn);
      continue;
    }
    const downtown = b.z <= -84;
    const w = rng.range(22, 34);
    const d = rng.range(22, 34);
    const h = downtown ? rng.range(28, 62) : rng.range(9, 22);
    const tex = facades[rng.int(0, facades.length - 1)].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 12)));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const building = new THREE.Mesh(boxGeo, mat);
    building.scale.set(w, h, d);
    building.position.set(b.x, h / 2, b.z);
    scene.add(building);
    // A flat roof cap so the top reads as a roof, not stretched windows.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshLambertMaterial({ color: 0x4a4440 }),
    );
    roof.position.set(b.x, h + 0.25, b.z);
    scene.add(roof);
    colliders.push({ minX: b.x - w / 2, maxX: b.x + w / 2, minZ: b.z - d / 2, maxZ: b.z + d / 2 });
  }

  // Solmar Plaza: a fountain, palms and benches where the city meets itself.
  const plazaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 10, 0.8, 24),
    new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
  );
  plazaBase.position.set(PLACES.plaza.x, 0.4, PLACES.plaza.z);
  scene.add(plazaBase);
  const plazaWater = new THREE.Mesh(
    new THREE.CylinderGeometry(7.5, 7.5, 0.3, 24),
    new THREE.MeshPhongMaterial({ color: 0x3fa8d8, shininess: 100 }),
  );
  plazaWater.position.set(PLACES.plaza.x, 0.75, PLACES.plaza.z);
  scene.add(plazaWater);
  const spray = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 4.5, 10),
    new THREE.MeshPhongMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.75 }),
  );
  spray.position.set(PLACES.plaza.x, 3, PLACES.plaza.z);
  scene.add(spray);
  animated.fountainSpray = spray;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const palm = makePalm(rng);
    palm.position.set(PLACES.plaza.x + Math.cos(a) * 18, 0, PLACES.plaza.z + Math.sin(a) * 18);
    scene.add(palm);
  }
  colliders.push({
    minX: PLACES.plaza.x - 9, maxX: PLACES.plaza.x + 9,
    minZ: PLACES.plaza.z - 9, maxZ: PLACES.plaza.z + 9,
  });

  // Vega Motors, the garage: a wide low shed with a big sign board and a forecourt.
  const garageMat = new THREE.MeshLambertMaterial({ color: 0x3f6fb5 });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 20), garageMat);
  garage.position.set(PLACES.garage.x, 4.5, PLACES.garage.z);
  scene.add(garage);
  const garageRoof = new THREE.Mesh(
    new THREE.BoxGeometry(31, 0.6, 21),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
  );
  garageRoof.position.set(PLACES.garage.x, 9.3, PLACES.garage.z);
  scene.add(garageRoof);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(16, 2.4, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xf2e6c8 }),
  );
  sign.position.set(PLACES.garage.x - 8, 8, PLACES.garage.z - 10.4);
  scene.add(sign);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  for (const dz of [-5, 5]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), doorMat);
    door.position.set(PLACES.garage.x - 15.2, 3, PLACES.garage.z + dz);
    door.rotation.y = -Math.PI / 2;
    scene.add(door);
  }
  colliders.push({
    minX: PLACES.garage.x - 15, maxX: PLACES.garage.x + 15,
    minZ: PLACES.garage.z - 10, maxZ: PLACES.garage.z + 10,
  });

  // The marina pier, a low deck the player can walk, with its posts and moored boats.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 106), pierMat);
  pier.position.set(PLACES.marina.x, 0.15, 248);
  scene.add(pier);
  for (let k = 0; k < 4; k++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: [0xe8e8e8, 0xd84a4a, 0x3f6fb5, 0xe8c95a][k] }),
    );
    hull.position.y = 0.8;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.4, 4),
      new THREE.MeshLambertMaterial({ color: 0xf5f2ea }),
    );
    cabin.position.set(0, 2.2, -1);
    boat.add(cabin);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 7, 5),
      new THREE.MeshLambertMaterial({ color: 0x6b5d4f }),
    );
    mast.position.set(0, 5, 1);
    boat.add(mast);
    const side = k % 2 === 0 ? -1 : 1;
    boat.position.set(PLACES.marina.x + side * 9, 0.1, 222 + k * 20);
    scene.add(boat);
  }

  // The beach house, the safehouse at the end of the story.
  const house = new THREE.Group();
  const houseBody = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0e2c8 }),
  );
  houseBody.position.y = 3;
  house.add(houseBody);
  const houseRoof = new THREE.Mesh(
    new THREE.ConeGeometry(10, 4, 4),
    new THREE.MeshLambertMaterial({ color: 0xc96a3a }),
  );
  houseRoof.position.y = 8;
  houseRoof.rotation.y = Math.PI / 4;
  house.add(houseRoof);
  house.position.set(PLACES.beachHouse.x, 0, PLACES.beachHouse.z);
  scene.add(house);
  colliders.push({
    minX: PLACES.beachHouse.x - 7, maxX: PLACES.beachHouse.x + 7,
    minZ: PLACES.beachHouse.z - 5, maxZ: PLACES.beachHouse.z + 5,
  });

  // Palms along the sand and street lamps along the roads.
  for (let x = -180; x <= 180; x += 30) {
    const palm = makePalm(rng);
    palm.position.set(x + rng.range(-4, 4), 0, 208 + rng.range(-3, 3));
    scene.add(palm);
  }
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
  for (const s of STREETS) {
    for (let t = -168; t <= 168; t += 56) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 5), poleMat);
      pole.position.set(s + 7.5, 3.5, t);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
      lamp.position.set(s + 7.5, 7.1, t);
      scene.add(lamp);
    }
  }

  // Slow clouds for a living sky.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 11), 8, 6), cloudMat);
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-2, 2));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-300, 300), rng.range(90, 130), rng.range(-300, 300));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // Push a circle (a walker or a car) out of every building, the pier and the
  // fountain, and keep it inside the city and out of the sea.
  function collideCircle(pos, radius) {
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else if (d2 <= 0.0001) {
        pos.x = c.maxX + radius;
      }
    }
    pos.x = Math.max(-CITY_EDGE, Math.min(CITY_EDGE, pos.x));
    pos.z = Math.max(-CITY_EDGE, Math.min(WATER_START - 2, pos.z));
  }

  function update(dt, t) {
    if (animated.water) animated.water.position.y = 0.05 + Math.sin(t * 0.7) * 0.06;
    if (animated.fountainSpray) {
      const s = 1 + Math.sin(t * 3) * 0.12;
      animated.fountainSpray.scale.set(s, 1 + Math.sin(t * 5) * 0.08, s);
    }
    for (const cloud of animated.clouds) {
      cloud.position.x += dt * 1.5;
      if (cloud.position.x > 340) cloud.position.x = -340;
    }
  }

  return { colliders, collideCircle, update };
}
