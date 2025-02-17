import BattleScene, { Button } from "../battle-scene";
import { Mode } from "./ui";
import UiHandler from "./ui-handler";

export default class EggHatchSceneHandler extends UiHandler {
  public eggHatchContainer: Phaser.GameObjects.Container;

  constructor(scene: BattleScene) {
    super(scene, Mode.EGG_HATCH_SCENE);
  }

  setup() {
    this.eggHatchContainer = this.scene.add.container(0, -this.scene.game.canvas.height / 6);
    this.scene.fieldUI.add(this.eggHatchContainer);

    const eggLightraysAnimFrames = this.scene.anims.generateFrameNames('egg_lightrays', { start: 0, end: 3 });
    this.scene.anims.create({
      key: 'egg_lightrays',
      frames: eggLightraysAnimFrames,
      frameRate: 32
    });
  }

  show(_args: any[]): boolean {
    super.show(_args);

    this.getUi().showText(null, 0);

    return true;
  }

  processInput(button: Button): boolean {
    return this.scene.ui.getMessageHandler().processInput(button);
  }

  setCursor(_cursor: integer): boolean {
    return false;
  }

  clear() {
    super.clear();
    this.eggHatchContainer.removeAll(true);
  }
}