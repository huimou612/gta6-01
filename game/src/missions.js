// The story of Solmar: three missions for Milo Vega, each with an objective, a
// pulsing beacon, dialogue, and a cash reward. Vega Motors owes Dom Falco $1,200,
// and these jobs are how Milo pays it back.
import * as THREE from 'three';
import { PLACES } from './city.js';

const SAFEHOUSE = { x: -140, z: 218 };

export function createMissions(game) {
  const scene = game.scene;

  // The beacon: a light pillar, a pulsing ring and a floating diamond over the target.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 70, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 35;
  scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.28, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  scene.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.3),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  scene.add(diamond);

  // The safehouse hut, at the far west end of the beach.
  const hut = new THREE.Group();
  const hutBody = new THREE.Mesh(
    new THREE.BoxGeometry(8, 4.5, 7),
    new THREE.MeshLambertMaterial({ color: 0x7a9e7a }),
  );
  hutBody.position.y = 2.25;
  hut.add(hutBody);
  const hutRoof = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 3, 4),
    new THREE.MeshLambertMaterial({ color: 0x8a5a3a }),
  );
  hutRoof.position.y = 6;
  hutRoof.rotation.y = Math.PI / 4;
  hut.add(hutRoof);
  hut.position.set(SAFEHOUSE.x, 0, SAFEHOUSE.z);
  scene.add(hut);
  game.city.colliders.push({
    minX: SAFEHOUSE.x - 4, maxX: SAFEHOUSE.x + 4,
    minZ: SAFEHOUSE.z - 3.5, maxZ: SAFEHOUSE.z + 3.5,
  });

  const list = [
    {
      id: 'first-fare',
      name: 'First Fare',
      desc: 'Ana needs a fare driven from Solmar Plaza to the marina. Wheels up, little brother.',
      reward: 150,
      done: false,
    },
    {
      id: 'hot-package',
      name: 'Hot Package',
      desc: 'Pick up Dom Falco\u2019s package at the docks. It will not be a quiet pickup.',
      reward: 300,
      done: false,
    },
    {
      id: 'getaway',
      name: 'The Getaway',
      desc: 'Meet the buyer at the beach house. Then get to the safehouse, whatever it takes.',
      reward: 500,
      done: false,
    },
  ];
  let active = null;
  let step = 0;
  let target = null;
  let targetRadius = 8;
  let hostilesDown = 0;
  let packageHeld = false;
  let storyDone = false;

  function setTarget(x, z, radius) {
    target = { x, z };
    targetRadius = radius || 8;
    beam.position.x = x;
    beam.position.z = z;
    ring.position.x = x;
    ring.position.z = z;
    diamond.position.set(x, 7, z);
    beam.visible = true;
    ring.visible = true;
    diamond.visible = true;
  }

  function hideBeacon() {
    beam.visible = false;
    ring.visible = false;
    diamond.visible = false;
    target = null;
  }

  function startMission(mission) {
    active = mission;
    step = 0;
    hostilesDown = 0;
    packageHeld = false;
    if (mission.id === 'first-fare') {
      game.hud.showDialogue('Ana: "Milo! A fare is waiting at Solmar Plaza. Take them to the marina — and don\u2019t scratch the paint."', 6);
      setTarget(PLACES.plaza.x, PLACES.plaza.z, 9);
    } else if (mission.id === 'hot-package') {
      game.hud.showDialogue('Ana: "Dom\u2019s package is on the docks, end of the pier. Grab it fast. The cops watch that pier."', 6);
      setTarget(PLACES.docks.x, PLACES.docks.z, 7);
    } else if (mission.id === 'getaway') {
      game.hud.showDialogue('Ana: "A buyer waits at the beach house with the rest of what we owe Dom. Go. And Milo — trust nobody."', 6);
      setTarget(PLACES.beachHouse.x, PLACES.beachHouse.z, 9);
    }
    game.hud.setObjective(objectiveText());
  }

  function startNext() {
    const next = list.find((m) => !m.done);
    if (!next) {
      storyDone = true;
      hideBeacon();
      game.hud.setObjective('Story complete — Solmar is yours, Milo.');
      game.hud.showDialogue('Ana: "That\u2019s the last of it. Dom\u2019s paid. Vega Motors stays open — because of you."', 8);
      return;
    }
    startMission(next);
  }

  function objectiveText() {
    if (!active) {
      const next = list.find((m) => !m.done);
      return next ? `Next job: ${next.name}` : 'Story complete — Solmar is yours, Milo.';
    }
    if (active.id === 'first-fare') {
      return step === 0 ? 'Pick up the fare at Solmar Plaza' : 'Drive the fare to the marina';
    }
    if (active.id === 'hot-package') {
      if (step === 0) return packageHeld ? 'Package grabbed — deliver it to Vega Motors' : 'Go to the docks at the marina (press E to grab the package)';
      return 'Deliver the package to Vega Motors';
    }
    if (active.id === 'getaway') {
      if (step === 0) return 'Meet the buyer at the beach house';
      if (step === 1) return `Deal with Dom\u2019s men (${hostilesDown}/3 down)`;
      return 'Lose the heat and reach the safehouse on the west beach';
    }
    return '';
  }

  function completeMission() {
    const m = active;
    m.done = true;
    game.addMoney(m.reward);
    game.audio.cash();
    game.audio.missionDone();
    game.hud.toast(`Mission complete: ${m.name} — $${m.reward}`);
    game.hud.showDialogue(`Ana: "Good work. $${m.reward} in the till. We still owe Dom $${Math.max(0, 1200 - game.money)}."`, 6);
    game.saveProgress();
    active = null;
    step = 0;
    startNext();
  }

  function advance() {
    step++;
    if (active.id === 'first-fare' && step === 1) {
      game.hud.showDialogue('Fare: "The marina, please — and step on it, I\u2019m late for my boat."', 5);
      setTarget(PLACES.marina.x, PLACES.marina.z, 9);
    } else if (active.id === 'hot-package' && step === 1) {
      setTarget(PLACES.garage.x - 24, PLACES.garage.z, 9);
    } else if (active.id === 'getaway' && step === 1) {
      // The double-cross: Dom's men open fire and the heat lands.
      game.combat.spawnHostiles(PLACES.beachHouse.x, PLACES.beachHouse.z, 3);
      game.police.setWanted(3);
      game.hud.showDialogue('Dom\u2019s man: "Falco says the debt just went up. Take him!"', 5);
      setTarget(PLACES.beachHouse.x, PLACES.beachHouse.z, 12);
    } else if (active.id === 'getaway' && step === 2) {
      game.police.clearHeat();
      game.hud.showDialogue('Ana (phone): "The heat\u2019s off. Get to the safehouse on the west beach. Now."', 6);
      setTarget(SAFEHOUSE.x, SAFEHOUSE.z, 9);
    }
    game.hud.setObjective(objectiveText());
  }

  // The E key while a mission step is waiting for a pickup.
  function tryInteract() {
    if (!active) return false;
    if (active.id === 'hot-package' && step === 0 && !packageHeld) {
      const pp = game.player.onFoot ? game.player.pos : game.vehicles.playerCar.pos;
      const d = Math.hypot(pp.x - PLACES.docks.x, pp.z - PLACES.docks.z);
      if (d < 8) {
        packageHeld = true;
        game.audio.pickup();
        game.police.setWanted(2);
        game.hud.showDialogue('Ana (phone): "You\u2019ve got it — and you\u2019ve got two stars. Bring it to the garage, fast."', 5);
        advance();
        return true;
      }
    }
    return false;
  }

  function onHostileDown() {
    if (!active || active.id !== 'getaway' || step !== 1) return;
    hostilesDown++;
    game.hud.setObjective(objectiveText());
    if (hostilesDown >= 3) advance();
  }

  function update(dt, t) {
    // Beacon pulse and spin.
    if (beam.visible) {
      const s = 1 + Math.sin(t * 4) * 0.15;
      ring.scale.set(s, s, 1);
      diamond.rotation.y += dt * 1.5;
      diamond.position.y = 7 + Math.sin(t * 2) * 0.5;
      beam.material.opacity = 0.24 + Math.sin(t * 4) * 0.08;
    }
    if (!active || !target) return;
    const pp = game.vehicles.playerCar ? game.vehicles.playerCar.pos : game.player.pos;
    const d = Math.hypot(pp.x - target.x, pp.z - target.z);
    if (d < targetRadius) {
      if (active.id === 'first-fare') {
        if (step === 0) {
          advance();
        } else if (game.vehicles.playerCar) {
          completeMission();
        } else {
          game.hud.setObjective('You need a car to finish the fare — grab one!');
        }
      } else if (active.id === 'hot-package') {
        if (step === 0) {
          game.hud.setObjective('Press E to grab the package');
        } else {
          completeMission();
        }
      } else if (active.id === 'getaway') {
        if (step === 0) {
          advance();
        } else if (step === 2) {
          completeMission();
        }
      }
    }
  }

  return {
    list,
    get active() {
      return active;
    },
    get target() {
      return target;
    },
    get storyDone() {
      return storyDone;
    },
    objectiveText,
    startMission,
    startNext,
    tryInteract,
    onHostileDown,
    update,
    // Restore saved progress: mark missions done and start the next one.
    restore(doneIds) {
      for (const m of list) if (doneIds.includes(m.id)) m.done = true;
      if (list.every((m) => m.done)) {
        storyDone = true;
        hideBeacon();
        game.hud.setObjective('Story complete — Solmar is yours, Milo.');
      }
    },
  };
}
