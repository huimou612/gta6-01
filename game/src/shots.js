// Staged screenshots: a ?shot= value in the URL sets up one deterministic scene
// before the first render, so each screenshot is reproducible from its seed.
//   ?shot=drive   Milo driving down the main boulevard with traffic around him
//   ?shot=chase   three stars, police cruisers on his tail
//   ?shot=mission a mission in progress, beacon and dialogue on screen
//   ?shot=walk    Milo on foot in Solmar Plaza with pedestrians and the towers behind
import { PLACES } from './city.js';

const BOULEVARD = [
  { x: 0, z: 80 },
  { x: 0, z: 0 },
  { x: 0, z: -80 },
  { x: 0, z: -160 },
  { x: 0, z: 160 },
];

export function stageShot(game, shot) {
  game.shotMode = true;
  game.state = 'playing';
  game.hud.showScreen(null);
  game.audio.setMusic(false);

  if (shot === 'drive') {
    const car = game.vehicles.giveCar(0, 150, Math.PI, 0xd84a4a);
    car.wpIndex = 0;
    game.shotWaypoints = BOULEVARD;
    game.cameraRig.mode = 'chase';
    game.cameraRig.dist = 13;
    game.cameraRig.height = 3.0;
    game.missions.startNext();
    game.hud.setObjective('Pick up the fare at Solmar Plaza');
  } else if (shot === 'chase') {
    const car = game.vehicles.giveCar(0, 150, Math.PI, 0xd84a4a);
    car.wpIndex = 0;
    game.shotWaypoints = BOULEVARD;
    game.cameraRig.mode = 'chase';
    game.cameraRig.dist = 13;
    game.cameraRig.height = 3.2;
    game.police.setWanted(3);
    // Put the cruisers right on his tail, so the chase reads in the frame.
    const tailSpots = [
      { x: 3, z: 172 },
      { x: -4, z: 182 },
      { x: 6, z: 164 },
      { x: -2, z: 192 },
    ];
    game.police.cruisers.forEach((c, i) => {
      const s = tailSpots[i % tailSpots.length];
      c.pos.set(s.x, 0, s.z);
      c.yaw = Math.PI;
      c.speed = 16;
    });
    game.missions.startNext();
    game.hud.setObjective('Lose the cops — get to the marina');
    game.hud.showDialogue('Ana (phone): "Three stars, Milo! Lose them before you reach the marina."', 30);
  } else if (shot === 'mission') {
    // Milo stands on the pier itself, the beacon waiting at the docks ahead.
    game.player.place(PLACES.marina.x, 258, 0);
    game.cameraRig.mode = 'orbit';
    game.cameraRig.yaw = 0;
    game.cameraRig.pitch = 0.25;
    game.cameraRig.dist = 8;
    game.cameraRig.height = 3;
    // Stage the second mission, Hot Package, so the beacon sits on the docks.
    game.missions.startMission(game.missions.list[1]);
    game.hud.setObjective('Go to the docks at the marina (press E to grab the package)');
    game.hud.showDialogue('Ana: "Dom\u2019s package is on the docks, end of the pier. Grab it fast."', 30);
  } else {
    // walk: Milo on foot in the plaza, the fountain and the towers ahead of him.
    game.player.place(-12, -12, -Math.PI * 0.75);
    game.cameraRig.mode = 'orbit';
    game.cameraRig.yaw = -Math.PI * 0.75;
    game.cameraRig.pitch = 0.3;
    game.cameraRig.dist = 8.5;
    game.cameraRig.height = 3;
    game.missions.startNext();
    game.hud.setObjective('Pick up the fare at Solmar Plaza');
    game.hud.showDialogue('Ana: "Milo! A fare is waiting at Solmar Plaza. Take them to the marina."', 30);
    // A few walkers nearby so the plaza feels lived in.
    game.pedestrians.spawnOne(-20, -40);
    game.pedestrians.spawnOne(-38, -14);
    game.pedestrians.spawnOne(-6, -44);
    game.pedestrians.spawnOne(-40, -38);
  }
  game.hud.setMoney(game.money);
  game.hud.setHealth(game.player.health);
  game.hud.setAmmo(game.combat.ammo, game.combat.magSize);
}

export function shotWaypointsFor() {
  return BOULEVARD;
}
