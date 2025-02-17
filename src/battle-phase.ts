import BattleScene from "./battle-scene";

export class BattlePhase {
  protected scene: BattleScene;

  constructor(scene: BattleScene) {
    this.scene = scene;
  }

  start() {
    console.log(`%cStart Phase ${this.constructor.name}`, 'color:green;');
  }

  end() {
    this.scene.shiftPhase();
  }
}