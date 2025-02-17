import { Button, default as BattleScene } from '../battle-scene';
import UiHandler from './ui-handler';
import BattleMessageUiHandler from './battle-message-ui-handler';
import CommandUiHandler from './command-ui-handler';
import PartyUiHandler from './party-ui-handler';
import FightUiHandler from './fight-ui-handler';
import MessageUiHandler from './message-ui-handler';
import ConfirmUiHandler from './confirm-ui-handler';
import ModifierSelectUiHandler from './modifier-select-ui-handler';
import BallUiHandler from './ball-ui-handler';
import SummaryUiHandler from './summary-ui-handler';
import StarterSelectUiHandler from './starter-select-ui-handler';
import EvolutionSceneHandler from './evolution-scene-handler';
import BiomeSelectUiHandler from './biome-select-ui-handler';
import TargetSelectUiHandler from './target-select-ui-handler';
import SettingsUiHandler from './settings-ui-handler';
import { TextStyle, addTextObject } from './text';
import AchvBar from './achv-bar';
import MenuUiHandler from './menu-ui-handler';
import AchvsUiHandler from './achvs-ui-handler';
import OptionSelectUiHandler from './option-select-ui-handler';
import EggHatchSceneHandler from './egg-hatch-scene-handler';
import EggListUiHandler from './egg-list-ui-handler';
import EggGachaUiHandler from './egg-gacha-ui-handler';
import VouchersUiHandler from './vouchers-ui-handler';
import { addWindow } from './window';
import LoginFormUiHandler from './login-form-ui-handler';
import RegistrationFormUiHandler from './registration-form-ui-handler';
import LoadingModalUiHandler from './loading-modal-ui-handler';
import * as Utils from "../utils";
import GameStatsUiHandler from './game-stats-ui-handler';

export enum Mode {
  MESSAGE,
  COMMAND,
  FIGHT,
  BALL,
  TARGET_SELECT,
  MODIFIER_SELECT,
  PARTY,
  SUMMARY,
  BIOME_SELECT,
  STARTER_SELECT,
  EVOLUTION_SCENE,
  EGG_HATCH_SCENE,
  CONFIRM,
  OPTION_SELECT,
  MENU,
  SETTINGS,
  ACHIEVEMENTS,
  GAME_STATS,
  VOUCHERS,
  EGG_LIST,
  EGG_GACHA,
  LOGIN_FORM,
  REGISTRATION_FORM,
  LOADING
};

const transitionModes = [
  Mode.PARTY,
  Mode.SUMMARY,
  Mode.STARTER_SELECT,
  Mode.EVOLUTION_SCENE,
  Mode.EGG_HATCH_SCENE,
  Mode.EGG_LIST,
  Mode.EGG_GACHA
];

const noTransitionModes = [
  Mode.CONFIRM,
  Mode.OPTION_SELECT,
  Mode.MENU,
  Mode.SETTINGS,
  Mode.ACHIEVEMENTS,
  Mode.GAME_STATS,
  Mode.VOUCHERS,
  Mode.LOGIN_FORM,
  Mode.REGISTRATION_FORM,
  Mode.LOADING
];

export default class UI extends Phaser.GameObjects.Container {
  private mode: Mode;
  private modeChain: Mode[];
  private handlers: UiHandler[];
  private overlay: Phaser.GameObjects.Rectangle;
  public achvBar: AchvBar;

  private tooltipContainer: Phaser.GameObjects.Container;
  private tooltipBg: Phaser.GameObjects.NineSlice;
  private tooltipTitle: Phaser.GameObjects.Text;
  private tooltipContent: Phaser.GameObjects.Text;
  
  private overlayActive: boolean;

  constructor(scene: BattleScene) {
    super(scene, 0, scene.game.canvas.height / 6);

    this.mode = Mode.MESSAGE;
    this.modeChain = [];
    this.handlers = [
      new BattleMessageUiHandler(scene),
      new CommandUiHandler(scene),
      new FightUiHandler(scene),
      new BallUiHandler(scene),
      new TargetSelectUiHandler(scene),
      new ModifierSelectUiHandler(scene),
      new PartyUiHandler(scene),
      new SummaryUiHandler(scene),
      new BiomeSelectUiHandler(scene),
      new StarterSelectUiHandler(scene),
      new EvolutionSceneHandler(scene),
      new EggHatchSceneHandler(scene),
      new ConfirmUiHandler(scene),
      new OptionSelectUiHandler(scene),
      new MenuUiHandler(scene),
      new SettingsUiHandler(scene),
      new AchvsUiHandler(scene),
      new GameStatsUiHandler(scene),
      new VouchersUiHandler(scene),
      new EggListUiHandler(scene),
      new EggGachaUiHandler(scene),
      new LoginFormUiHandler(scene),
      new RegistrationFormUiHandler(scene),
      new LoadingModalUiHandler(scene)
    ];
  }

  setup(): void {
    for (let handler of this.handlers)
      handler.setup();
    this.overlay = this.scene.add.rectangle(0, 0, this.scene.game.canvas.width / 6, this.scene.game.canvas.height / 6, 0);
    this.overlay.setOrigin(0, 0);
    (this.scene as BattleScene).uiContainer.add(this.overlay);
    this.overlay.setVisible(false);
    this.setupTooltip();

    this.achvBar = new AchvBar(this.scene as BattleScene);
    this.achvBar.setup();
   
    (this.scene as BattleScene).uiContainer.add(this.achvBar);
  }

  private setupTooltip() {
    this.tooltipContainer = this.scene.add.container(0, 0);
    this.tooltipContainer.setVisible(false);

    this.tooltipBg = addWindow(this.scene as BattleScene, 0, 0, 128, 31);
    this.tooltipBg.setOrigin(0, 0);

    this.tooltipTitle = addTextObject(this.scene, 64, 4, '', TextStyle.TOOLTIP_TITLE);
    this.tooltipTitle.setOrigin(0.5, 0);

    this.tooltipContent = addTextObject(this.scene, 6, 16, '', TextStyle.TOOLTIP_CONTENT);
    this.tooltipContent.setWordWrapWidth(696)

    this.tooltipContainer.add(this.tooltipBg);
    this.tooltipContainer.add(this.tooltipTitle);
    this.tooltipContainer.add(this.tooltipContent);

    (this.scene as BattleScene).uiContainer.add(this.tooltipContainer);
  }

  getHandler(): UiHandler {
    return this.handlers[this.mode];
  }

  getMessageHandler(): BattleMessageUiHandler {
    return this.handlers[Mode.MESSAGE] as BattleMessageUiHandler;
  }

  processInput(button: Button): boolean {
    if (this.overlayActive)
      return false;

    return this.getHandler().processInput(button);
  }

  showText(text: string, delay?: integer, callback?: Function, callbackDelay?: integer, prompt?: boolean, promptDelay?: integer): void {
    const handler = this.getHandler();
    if (handler instanceof MessageUiHandler)
      (handler as MessageUiHandler).showText(text, delay, callback, callbackDelay, prompt, promptDelay);
    else
      this.getMessageHandler().showText(text, delay, callback, callbackDelay, prompt, promptDelay);
  }

  showDialogue(text: string, name: string, delay: integer = 0, callback: Function, callbackDelay?: integer, prompt?: boolean, promptDelay?: integer): void {
    if (text.indexOf('$') > -1) {
      const messagePages = text.split(/\$/g).map(m => m.trim());
      let showMessageAndCallback = () => callback();
      for (let p = messagePages.length - 1; p >= 0; p--) {
        const originalFunc = showMessageAndCallback;
        showMessageAndCallback = () => this.showDialogue(messagePages[p], name, null, originalFunc, null, true);
      }
      showMessageAndCallback();
    } else {
      const handler = this.getHandler();
      if (handler instanceof MessageUiHandler)
        (handler as MessageUiHandler).showDialogue(text, name, delay, callback, callbackDelay, prompt, promptDelay);
      else
        this.getMessageHandler().showDialogue(text, name, delay, callback, callbackDelay, prompt, promptDelay);
    }
  }

  showTooltip(title: string, content: string, overlap?: boolean): void {
    this.tooltipContainer.setVisible(true);
    this.tooltipTitle.setText(title || '');
    const wrappedContent = this.tooltipContent.runWordWrap(content);
    this.tooltipContent.setText(wrappedContent);
    this.tooltipContent.y = title ? 16 : 4;
    this.tooltipBg.width = Math.min(Math.max(this.tooltipTitle.displayWidth, this.tooltipContent.displayWidth) + 12, 684);
    this.tooltipBg.height = (title ? 31 : 19) + 10.5 * (wrappedContent.split('\n').length - 1);
    if (overlap)
       (this.scene as BattleScene).uiContainer.moveAbove(this.tooltipContainer, this);
    else
       (this.scene as BattleScene).uiContainer.moveBelow(this.tooltipContainer, this);
  }

  hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
    this.tooltipTitle.clearTint();
  }

  update(): void {
    if (this.tooltipContainer.visible) {
      const reverse = this.scene.game.input.mousePointer.x >= this.scene.game.canvas.width - this.tooltipBg.width * 6 - 12;
      this.tooltipContainer.setPosition(!reverse ? this.scene.game.input.mousePointer.x / 6 + 2 : this.scene.game.input.mousePointer.x / 6 - this.tooltipBg.width - 2, this.scene.game.input.mousePointer.y / 6 + 2);
    }
  }

  clearText(): void {
    const handler = this.getHandler();
    if (handler instanceof MessageUiHandler)
      (handler as MessageUiHandler).clearText();
    else
      this.getMessageHandler().clearText();
  }

  setCursor(cursor: integer): boolean {
    const changed = this.getHandler().setCursor(cursor);
    if (changed)
      this.playSelect();

    return changed;
  }

  playSelect(): void {
    (this.scene as BattleScene).playSound('select');
  }

  playError(): void {
    (this.scene as BattleScene).playSound('error');
  }

  fadeOut(duration: integer): Promise<void> {
    return new Promise(resolve => {
      if (this.overlayActive) {
        resolve();
        return;
      }
      this.overlayActive = true;
      this.overlay.setAlpha(0);
      this.overlay.setVisible(true);
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 1,
        duration: duration,
        ease: 'Sine.easeOut',
        onComplete: () => resolve()
      });
    });
  }

  fadeIn(duration: integer): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: duration,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.overlay.setVisible(false);
          resolve();
        }
      });
      this.overlayActive = false;
    });
  }

  private setModeInternal(mode: Mode, clear: boolean, forceTransition: boolean, chainMode: boolean, args: any[]): Promise<void> {
    return new Promise(resolve => {
      if (this.mode === mode && !forceTransition) {
        resolve();
        return;
      }
      const doSetMode = () => {
        if (this.mode !== mode) {
          if (clear)
            this.getHandler().clear();
          if (chainMode && this.mode && !clear)
            this.modeChain.push(this.mode);
          this.mode = mode;
          const touchControls = document.getElementById('touchControls');
          if (touchControls)
            touchControls.dataset.uiMode = Mode[mode];
          this.getHandler().show(args);
        }
        resolve();
      };
      if (((!chainMode && ((transitionModes.indexOf(this.mode) > -1 || transitionModes.indexOf(mode) > -1)
        && (noTransitionModes.indexOf(this.mode) === -1 && noTransitionModes.indexOf(mode) === -1)))
        || (chainMode && noTransitionModes.indexOf(mode) === -1)) && !(this.scene as BattleScene).auto) {
        this.fadeOut(250).then(() => {
          this.scene.time.delayedCall(100, () => {
            doSetMode();
            this.fadeIn(250);
          });
        })
      } else
        doSetMode();
    });
  }

  getMode(): Mode {
    return this.mode;
  }

  setMode(mode: Mode, ...args: any[]): Promise<void> {
    return this.setModeInternal(mode, true, false, false, args);
  }

  setModeForceTransition(mode: Mode, ...args: any[]): Promise<void> {
    return this.setModeInternal(mode, true, true, false, args);
  }

  setModeWithoutClear(mode: Mode, ...args: any[]): Promise<void> {
    return this.setModeInternal(mode, false, false, false, args);
  }

  setOverlayMode(mode: Mode, ...args: any[]): Promise<void> {
    return this.setModeInternal(mode, false, false, true, args);
  }

  revertMode(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      if (!this?.modeChain?.length)
        return resolve(false);

      const lastMode = this.mode;

      const doRevertMode = () => {
        this.getHandler().clear();
        this.mode = this.modeChain.pop();
        const touchControls = document.getElementById('touchControls');
        if (touchControls)
          touchControls.dataset.uiMode = Mode[this.mode];
        resolve(true);
      };

      if (noTransitionModes.indexOf(lastMode) === -1) {
        this.fadeOut(250).then(() => {
          this.scene.time.delayedCall(100, () => {
            doRevertMode();
            this.fadeIn(250);
          });
        });
      } else
        doRevertMode();
    });
  }

  revertModes(): Promise<void> {
    return new Promise<void>(resolve => {
      if (!this?.modeChain?.length)
        return resolve();
      this.revertMode().then(success => Utils.executeIf(success, this.revertModes).then(() => resolve()));
    });
  }
}