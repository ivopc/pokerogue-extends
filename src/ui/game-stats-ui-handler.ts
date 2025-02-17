import BattleScene, { Button } from "../battle-scene";
import { TextStyle, addTextObject, getTextColor } from "./text";
import { Mode } from "./ui";
import UiHandler from "./ui-handler";
import { addWindow } from "./window";
import * as Utils from "../utils";
import { DexAttr, GameData } from "../system/game-data";
import { speciesStarters } from "../data/pokemon-species";

interface DisplayStat {
  label?: string;
  sourceFunc?: (gameData: GameData) => string;
  hidden?: boolean;
}

interface DisplayStats {
  [key: string]: DisplayStat | string
}

const displayStats: DisplayStats = {
  playTime: {
    sourceFunc: gameData => Utils.getPlayTimeString(gameData.gameStats.playTime)
  },
  battles: 'Total Battles',
  startersUnlocked: {
    label: 'Starters',
    sourceFunc: gameData => {
      const starterKeys = Object.keys(speciesStarters);
      let starterCount = 0;
      for (let s of starterKeys) {
        if (gameData.dexData[s].caughtAttr)
          starterCount++;
      }
      return `${starterCount} (${Math.floor((starterCount / starterKeys.length) * 1000) / 10}%)`;
    }
  },
  shinyStartersUnlocked: {
    label: 'Shiny Starters',
    sourceFunc: gameData => {
      const starterKeys = Object.keys(speciesStarters);
      let starterCount = 0;
      for (let s of starterKeys) {
        if (gameData.dexData[s].caughtAttr & DexAttr.SHINY)
          starterCount++;
      }
      return `${starterCount} (${Math.floor((starterCount / starterKeys.length) * 1000) / 10}%)`;
    }
  },
  dexSeen: {
    label: 'Species Seen',
    sourceFunc: gameData => {
      const dexKeys = Object.keys(gameData.dexData);
      let seenCount = 0;
      for (let s of dexKeys) {
        if (gameData.dexData[s].seenAttr)
          seenCount++;
      }
      return `${seenCount} (${Math.floor((seenCount / dexKeys.length) * 1000) / 10}%)`;
    }
  },
  dexCaught: {
    label: 'Species Caught',
    sourceFunc: gameData => {
      const dexKeys = Object.keys(gameData.dexData);
      let caughtCount = 0;
      for (let s of dexKeys) {
        if (gameData.dexData[s].caughtAttr)
          caughtCount++;
      }
      return `${caughtCount} (${Math.floor((caughtCount / dexKeys.length) * 1000) / 10}%)`;
    }
  },
  classicSessionsPlayed: 'Runs (Classic)',
  sessionsWon: 'Wins (Classic)',
  endlessSessionsPlayed: 'Runs (Endless)?',
  highestEndlessWave: 'Highest Wave (Endless)?',
  highestMoney: 'Highest Money',
  pokemonSeen: 'Pokémon Encountered',
  pokemonDefeated: 'Pokémon Defeated',
  pokemonCaught: 'Pokémon Caught',
  pokemonHatched: 'Eggs Hatched',
  legendaryPokemonSeen: 'Legendary Encounters?',
  legendaryPokemonCaught: 'Legendaries Caught?',
  legendaryPokemonHatched: 'Legendaries Hatched?',
  mythicalPokemonSeen: 'Mythical Encounters?',
  mythicalPokemonCaught: 'Mythicals Caught?',
  mythicalPokemonHatched: 'Mythicals Hatched?',
  shinyPokemonSeen: 'Shiny Encounters?',
  shinyPokemonCaught: 'Shinies Caught?',
  shinyPokemonHatched: 'Shinies Hatched?',
  pokemonFused: 'Pokémon Fused?',
  trainersDefeated: 'Trainers Defeated',
  eggsPulled: 'Eggs Pulled',
  rareEggsPulled: 'Rare Eggs Pulled?',
  epicEggsPulled: 'Epic Eggs Pulled?',
  legendaryEggsPulled: 'Legendary Eggs Pulled?',
  manaphyEggsPulled: 'Manaphy Eggs Pulled?'
};

export default class GameStatsUiHandler extends UiHandler {
  private gameStatsContainer: Phaser.GameObjects.Container;
  private statsContainer: Phaser.GameObjects.Container;

  private statLabels: Phaser.GameObjects.Text[];
  private statValues: Phaser.GameObjects.Text[];

  constructor(scene: BattleScene, mode?: Mode) {
    super(scene, mode);

    this.statLabels = [];
    this.statValues = [];
  }

  setup() {
    const ui = this.getUi();
    
    this.gameStatsContainer = this.scene.add.container(1, -(this.scene.game.canvas.height / 6) + 1);

    this.gameStatsContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.scene.game.canvas.width / 6, this.scene.game.canvas.height / 6), Phaser.Geom.Rectangle.Contains);

    const headerBg = addWindow(this.scene, 0, 0, (this.scene.game.canvas.width / 6) - 2, 24);
    headerBg.setOrigin(0, 0);

    const headerText = addTextObject(this.scene, 0, 0, 'Stats', TextStyle.SETTINGS_LABEL);
    headerText.setOrigin(0, 0);
    headerText.setPositionRelative(headerBg, 8, 4);

    const statsBgWidth = ((this.scene.game.canvas.width / 6) - 2) / 2;
    const [ statsBgLeft, statsBgRight ] = new Array(2).fill(null).map((_, i) => {
      let width = statsBgWidth;
      if (!i)
        width += 5;
      const statsBg = addWindow(this.scene, statsBgWidth * i, headerBg.height, width, (this.scene.game.canvas.height / 6) - headerBg.height - 2, false, !!i, 2);
      statsBg.setOrigin(0, 0);
      return statsBg;
    });

    this.statsContainer = this.scene.add.container(0, 0);

    new Array(18).fill(null).map((_, s) => {
      const statLabel = addTextObject(this.scene, 8 + (s % 2 === 1 ? statsBgWidth : 0), 28 + Math.floor(s / 2) * 16, '', TextStyle.SETTINGS_LABEL);
      statLabel.setOrigin(0, 0);
      this.statsContainer.add(statLabel);
      this.statLabels.push(statLabel);

      const statValue = addTextObject(this.scene, (statsBgWidth * ((s % 2) + 1)) - 8, statLabel.y, '', TextStyle.WINDOW);
      statValue.setOrigin(1, 0);
      this.statsContainer.add(statValue);
      this.statValues.push(statValue);
    });

    this.gameStatsContainer.add(headerBg);
    this.gameStatsContainer.add(headerText);
    this.gameStatsContainer.add(statsBgLeft);
    this.gameStatsContainer.add(statsBgRight);
    this.gameStatsContainer.add(this.statsContainer);

    ui.add(this.gameStatsContainer);

    this.setCursor(0);

    this.gameStatsContainer.setVisible(false);
  }

  show(args: any[]): boolean {
    super.show(args);

    this.setCursor(0);
    
    this.updateStats();
    
    this.gameStatsContainer.setVisible(true);

    this.getUi().moveTo(this.gameStatsContainer, this.getUi().length - 1);

    this.getUi().hideTooltip();

    return true;
  }

  updateStats(): void {
    const statKeys = Object.keys(displayStats).slice(this.cursor * 2, this.cursor * 2 + 18);
    statKeys.forEach((key, s) => {
      const stat = displayStats[key] as DisplayStat;
      const value = stat.sourceFunc(this.scene.gameData);
      this.statLabels[s].setText(!stat.hidden || isNaN(parseInt(value)) || parseInt(value) ? stat.label : '???');
      this.statValues[s].setText(value);
    });
    if (statKeys.length < 18) {
      for (let s = statKeys.length; s < 18; s++) {
        this.statLabels[s].setText('');
        this.statValues[s].setText('');
      }
    }
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    let success = false;

    if (button === Button.CANCEL) {
      success = true;
      this.scene.ui.revertMode();
    } else {
      switch (button) {
        case Button.UP:
          if (this.cursor)
            success = this.setCursor(this.cursor - 1);
          break;
        case Button.DOWN:
          if (this.cursor < Math.ceil((Object.keys(displayStats).length - 18) / 2))
            success = this.setCursor(this.cursor + 1);
          break;
      }
    }

    if (success)
      ui.playSelect();

    return success;
  }

  setCursor(cursor: integer): boolean {
    const ret = super.setCursor(cursor);

    if (ret)
      this.updateStats();

    return ret;
  }

  clear() {
    super.clear();
    this.gameStatsContainer.setVisible(false);
  }
}

(function () {
  const statKeys = Object.keys(displayStats);

  for (let key of statKeys) {
    if (typeof displayStats[key] === 'string') {
      let label = displayStats[key] as string;
      let hidden = false;
      if (label.endsWith('?')) {
        label = label.slice(0, -1);
        hidden = true;
      }
      displayStats[key] = {
        label: label,
        sourceFunc: gameData => gameData.gameStats[key].toString(),
        hidden: hidden
      };
    } else if (displayStats[key] === null) {
      displayStats[key] = {
        sourceFunc: gameData => gameData.gameStats[key].toString()
      };
    }
    if (!(displayStats[key] as DisplayStat).label) {
      const splittableKey = key.replace(/([a-z]{2,})([A-Z]{1}(?:[^A-Z]|$))/g, '$1_$2');
      (displayStats[key] as DisplayStat).label = Utils.toReadableString(`${splittableKey[0].toUpperCase()}${splittableKey.slice(1)}`);
    }
  }
})();