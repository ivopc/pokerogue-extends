import { CommandPhase } from "../battle-phases";
import BattleScene, { Button } from "../battle-scene";
import { PlayerPokemon, PokemonMove } from "../pokemon";
import { addTextObject, TextStyle } from "./text";
import { Command } from "./command-ui-handler";
import MessageUiHandler from "./message-ui-handler";
import { Mode } from "./ui";
import * as Utils from "../utils";
import { PokemonFormChangeItemModifier, PokemonHeldItemModifier, SwitchEffectTransferModifier } from "../modifier/modifier";
import { allMoves } from "../data/move";
import { Moves } from "../data/enums/moves";
import { getGenderColor, getGenderSymbol } from "../data/gender";
import { StatusEffect } from "../data/status-effect";
import PokemonIconAnimHandler, { PokemonIconAnimMode } from "./pokemon-icon-anim-handler";
import { pokemonEvolutions } from "../data/pokemon-evolutions";
import { addWindow } from "./window";
import { SpeciesFormChangeItemTrigger } from "../data/pokemon-forms";

const defaultMessage = 'Choose a Pokémon.';

export enum PartyUiMode {
  SWITCH,
  FAINT_SWITCH,
  POST_BATTLE_SWITCH,
  MODIFIER,
  MOVE_MODIFIER,
  TM_MODIFIER,
  REMEMBER_MOVE_MODIFIER,
  MODIFIER_TRANSFER,
  SPLICE,
  RELEASE
}

export enum PartyOption {
  CANCEL = -1,
  SEND_OUT,
  PASS_BATON,
  APPLY,
  TEACH,
  TRANSFER,
  SPLICE,
  SUMMARY,
  UNPAUSE_EVOLUTION,
  RELEASE,
  SCROLL_UP = 1000,
  SCROLL_DOWN = 1001,
  FORM_CHANGE_ITEM = 2000,
  MOVE_1 = 3000,
  MOVE_2,
  MOVE_3,
  MOVE_4
}

export type PartySelectCallback = (cursor: integer, option: PartyOption) => void;
export type PartyModifierTransferSelectCallback = (fromCursor: integer, index: integer, toCursor?: integer) => void;
export type PartyModifierSpliceSelectCallback = (fromCursor: integer, toCursor?: integer) => void;
export type PokemonSelectFilter = (pokemon: PlayerPokemon) => string;
export type PokemonModifierTransferSelectFilter = (pokemon: PlayerPokemon, modifier: PokemonHeldItemModifier) => string;
export type PokemonMoveSelectFilter = (pokemonMove: PokemonMove) => string;

export default class PartyUiHandler extends MessageUiHandler {
  private partyUiMode: PartyUiMode;
  private fieldIndex: integer;

  private partyBg: Phaser.GameObjects.Image;
  private partyContainer: Phaser.GameObjects.Container;
  private partySlotsContainer: Phaser.GameObjects.Container;
  private partySlots: PartySlot[];
  private partyCancelButton: PartyCancelButton;
  private partyMessageBox: Phaser.GameObjects.NineSlice;

  private optionsMode: boolean;
  private optionsScroll: boolean;
  private optionsCursor: integer = 0;
  private optionsScrollCursor: integer = 0;
  private optionsScrollTotal: integer = 0;
  private optionsContainer: Phaser.GameObjects.Container;
  private optionsBg: Phaser.GameObjects.NineSlice;
  private optionsCursorObj: Phaser.GameObjects.Image;
  private options: integer[];

  private transferMode: boolean;
  private transferOptionCursor: integer;
  private transferCursor: integer;
  
  private lastCursor: integer = 0;
  private selectCallback: PartySelectCallback | PartyModifierTransferSelectCallback;
  private selectFilter: PokemonSelectFilter | PokemonModifierTransferSelectFilter;
  private moveSelectFilter: PokemonMoveSelectFilter;
  private tmMoveId: Moves;

  private iconAnimHandler: PokemonIconAnimHandler;

  private static FilterAll = (_pokemon: PlayerPokemon) => null;

  public static FilterNonFainted = (pokemon: PlayerPokemon) => {
    if (pokemon.isFainted())
      return `${pokemon.name} has no energy\nleft to battle!`;
    return null;
  };

  private static FilterAllMoves = (_pokemonMove: PokemonMove) => null;

  public static FilterItemMaxStacks = (pokemon: PlayerPokemon, modifier: PokemonHeldItemModifier) => {
    const matchingModifier = pokemon.scene.findModifier(m => m instanceof PokemonHeldItemModifier && (m as PokemonHeldItemModifier).matchType(modifier)) as PokemonHeldItemModifier;
    if (matchingModifier && matchingModifier.stackCount === matchingModifier.getMaxStackCount(pokemon.scene))
      return `${pokemon.name} has too many\nof this item!`;
    return null;
  };

  public static NoEffectMessage = 'It won\'t have any effect.';

  constructor(scene: BattleScene) {
    super(scene, Mode.PARTY);
  }

  setup() {
    const ui = this.getUi();

    const partyContainer = this.scene.add.container(0, 0);
    partyContainer.setVisible(false);
    ui.add(partyContainer);

    this.partyContainer = partyContainer;

    this.partyBg = this.scene.add.image(0, 0, 'party_bg');
    partyContainer.add(this.partyBg);

    this.partyBg.setOrigin(0, 1);

    const partySlotsContainer = this.scene.add.container(0, 0);
    partyContainer.add(partySlotsContainer);

    this.partySlotsContainer = partySlotsContainer;

    const partyMessageBoxContainer = this.scene.add.container(0, -32);
    partyContainer.add(partyMessageBoxContainer);

    const partyMessageBox = addWindow(this.scene, 1, 31, 262, 30);
    partyMessageBox.setOrigin(0, 1);
    partyMessageBoxContainer.add(partyMessageBox);

    this.partyMessageBox = partyMessageBox;

    const partyMessageText = addTextObject(this.scene, 8, 10, defaultMessage, TextStyle.WINDOW, { maxLines: 2 });
    
    partyMessageText.setOrigin(0, 0);
    partyMessageBoxContainer.add(partyMessageText);

    this.message = partyMessageText;

    const partyCancelButton = new PartyCancelButton(this.scene, 291, -16);
    partyContainer.add(partyCancelButton);

    this.partyCancelButton = partyCancelButton;

    this.optionsContainer = this.scene.add.container((this.scene.game.canvas.width / 6) - 1, -1);
    partyContainer.add(this.optionsContainer);

    this.iconAnimHandler = new PokemonIconAnimHandler();
    this.iconAnimHandler.setup(this.scene);

    this.options = [];

    this.partySlots = [];
  }

  show(args: any[]): boolean {
    if (!args.length || this.active)
      return false;

    super.show(args);

    this.partyUiMode = args[0] as PartyUiMode;

    this.fieldIndex = args.length > 1 ? args[1] as integer : -1;

    this.selectCallback = args.length > 2 && args[2] instanceof Function ? args[2] : undefined;
    this.selectFilter = args.length > 3 && args[3] instanceof Function
      ? args[3] as PokemonSelectFilter
      : PartyUiHandler.FilterAll;
    this.moveSelectFilter = args.length > 4 && args[4] instanceof Function
      ? args[4] as PokemonMoveSelectFilter
      : PartyUiHandler.FilterAllMoves;
    this.tmMoveId = args.length > 5 && args[5] ? args[5] : Moves.NONE;

    this.partyContainer.setVisible(true);
    this.partyBg.setTexture(`party_bg${this.scene.currentBattle.double ? '_double' : ''}`);
    this.populatePartySlots();
    this.setCursor(this.cursor < 6 ? this.cursor : 0);

    return true;
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    if (this.pendingPrompt)
      return false;

    if (this.awaitingActionInput) {
      if ((button === Button.ACTION || button === Button.CANCEL) && this.onActionInput) {
        ui.playSelect();
        const originalOnActionInput = this.onActionInput;
        this.onActionInput = null;
        originalOnActionInput();
        this.awaitingActionInput = false;
        return true;
      }
      return false;
    }

    let success = false;

    if (this.optionsMode) {
      if (button === Button.ACTION) {
        const option = this.options[this.optionsCursor];
        const pokemon = this.scene.getParty()[this.cursor];
        if (this.partyUiMode === PartyUiMode.MODIFIER_TRANSFER && !this.transferMode && option !== PartyOption.CANCEL) {
          this.startTransfer();
          this.clearOptions();
          ui.playSelect();
          return true;
        } else if (this.partyUiMode === PartyUiMode.REMEMBER_MOVE_MODIFIER && option !== PartyOption.CANCEL) {
          let filterResult = (this.selectFilter as PokemonSelectFilter)(pokemon);
          if (filterResult === null) {
            this.selectCallback(this.cursor, option);
            this.clearOptions();
          } else {
            this.clearOptions();
            this.showText(filterResult as string, null, () => this.showText(null, 0), null, true);
          }
          ui.playSelect();
          return true;
        } else if ((option !== PartyOption.SUMMARY && option !== PartyOption.UNPAUSE_EVOLUTION && option !== PartyOption.RELEASE && option !== PartyOption.CANCEL)
          || (option === PartyOption.RELEASE && this.partyUiMode === PartyUiMode.RELEASE)) {
          let filterResult: string;
          if (option !== PartyOption.TRANSFER && option !== PartyOption.SPLICE) {
            filterResult = (this.selectFilter as PokemonSelectFilter)(pokemon);
            if (filterResult === null && this.partyUiMode === PartyUiMode.MOVE_MODIFIER)
              filterResult = this.moveSelectFilter(pokemon.moveset[this.optionsCursor]);
          } else {
            const transferPokemon = this.scene.getParty()[this.transferCursor];
            const itemModifiers = this.scene.findModifiers(m => m instanceof PokemonHeldItemModifier
                && (m as PokemonHeldItemModifier).getTransferrable(true) && (m as PokemonHeldItemModifier).pokemonId === transferPokemon.id) as PokemonHeldItemModifier[];
            filterResult = (this.selectFilter as PokemonModifierTransferSelectFilter)(pokemon, itemModifiers[this.transferOptionCursor]);
          }
          if (filterResult === null) {
            if (this.partyUiMode !== PartyUiMode.SPLICE)
              this.clearOptions();
            if (this.selectCallback) {
              if (option === PartyOption.TRANSFER) {
                (this.selectCallback as PartyModifierTransferSelectCallback)(this.transferCursor, this.transferOptionCursor, this.cursor);
                this.clearTransfer();
              } else if (this.partyUiMode === PartyUiMode.SPLICE) {
                if (option === PartyOption.SPLICE) {
                  (this.selectCallback as PartyModifierSpliceSelectCallback)(this.transferCursor, this.cursor);
                  this.clearTransfer();
                } else
                  this.startTransfer();
                this.clearOptions();
              } else if (option === PartyOption.RELEASE)
                this.doRelease(this.cursor);
              else {
                const selectCallback = this.selectCallback;
                this.selectCallback = null;
                selectCallback(this.cursor, option);
              }
            } else {
              if (option >= PartyOption.FORM_CHANGE_ITEM && this.scene.getCurrentPhase() instanceof CommandPhase) {
                switch (this.partyUiMode) {
                  case PartyUiMode.SWITCH:
                  case PartyUiMode.FAINT_SWITCH:
                  case PartyUiMode.POST_BATTLE_SWITCH:
                    let formChangeItemModifiers = this.scene.findModifiers(m => m instanceof PokemonFormChangeItemModifier && m.pokemonId === pokemon.id) as PokemonFormChangeItemModifier[];
                    if (formChangeItemModifiers.find(m => m.active))
                      formChangeItemModifiers = formChangeItemModifiers.filter(m => m.active);
                    const modifier = formChangeItemModifiers[option - PartyOption.FORM_CHANGE_ITEM];
                    modifier.active = !modifier.active;
                    this.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeItemTrigger, false, true);
                    break;
                }
              } else if (this.cursor)
                (this.scene.getCurrentPhase() as CommandPhase).handleCommand(Command.POKEMON, this.cursor, option === PartyOption.PASS_BATON);
            }
            if (this.partyUiMode !== PartyUiMode.MODIFIER && this.partyUiMode !== PartyUiMode.TM_MODIFIER && this.partyUiMode !== PartyUiMode.MOVE_MODIFIER)
              ui.playSelect();
            return true;
          } else {
            this.clearOptions();
            this.showText(filterResult as string, null, () => this.showText(null, 0), null, true);
          }
        } else if (option === PartyOption.SUMMARY) {
          ui.playSelect();
          ui.setModeWithoutClear(Mode.SUMMARY, pokemon).then(() =>  this.clearOptions());
          return true;
        } else if (option === PartyOption.UNPAUSE_EVOLUTION) {
          this.clearOptions();
          ui.playSelect();
          pokemon.pauseEvolutions = false;
          this.showText(`Evolutions have been unpaused for ${pokemon.name}.`, null, () => this.showText(null, 0), null, true);
        } else if (option === PartyOption.RELEASE) {
          this.clearOptions();
          ui.playSelect();
          if (this.cursor >= this.scene.currentBattle.getBattlerCount()) {
            this.showText(`Do you really want to release ${pokemon.name}?`, null, () => {
              ui.setModeWithoutClear(Mode.CONFIRM, () => {
                ui.setMode(Mode.PARTY);
                this.doRelease(this.cursor);
              }, () => {
                ui.setMode(Mode.PARTY);
                this.showText(null, 0);
              });
            });
          } else
            this.showText('You can\'t release a Pokémon that\'s in battle!', null, () => this.showText(null, 0), null, true);
          return true;
        } else if (option === PartyOption.CANCEL)
          return this.processInput(Button.CANCEL);
      } else if (button === Button.CANCEL) {
        this.clearOptions();
        ui.playSelect();
        return true;
      } else {
        switch (button) {
          case Button.UP:
            success = this.setCursor(this.optionsCursor ? this.optionsCursor - 1 : this.options.length - 1);
            break;
          case Button.DOWN:
            success = this.setCursor(this.optionsCursor < this.options.length - 1 ? this.optionsCursor + 1 : 0);
            break;
        }
      }
    } else {
      if (button === Button.ACTION) {
        if (this.cursor < 6) {
          this.showOptions();
          ui.playSelect();
        } else if (this.partyUiMode === PartyUiMode.FAINT_SWITCH)
          ui.playError();
        else
          return this.processInput(Button.CANCEL);
        return true;
      } else if (button === Button.CANCEL) {
        if ((this.partyUiMode === PartyUiMode.MODIFIER_TRANSFER || this.partyUiMode === PartyUiMode.SPLICE) && this.transferMode) {
          this.clearTransfer();
          ui.playSelect();
        } else if (this.partyUiMode !== PartyUiMode.FAINT_SWITCH) {
          if (this.selectCallback) {
            const selectCallback = this.selectCallback;
            this.selectCallback = null;
            selectCallback(6, PartyOption.CANCEL);
            ui.playSelect();
          } else {
            ui.setMode(Mode.COMMAND, this.fieldIndex);
            ui.playSelect();
          }
        }
        
        return true;
      }

      const slotCount = this.partySlots.length;

      switch (button) {
        case Button.UP:
          success = this.setCursor(this.cursor ? this.cursor < 6 ? this.cursor - 1 : slotCount - 1 : 6);
          break;
        case Button.DOWN:
          success = this.setCursor(this.cursor < 6 ? this.cursor < slotCount - 1 ? this.cursor + 1 : 6 : 0);
          break;
        case Button.LEFT:
          if (this.cursor >= this.scene.currentBattle.getBattlerCount() && this.cursor < 6)
            success = this.setCursor(0);
          break;
        case Button.RIGHT:
          const battlerCount = this.scene.currentBattle.getBattlerCount();
          if (slotCount > battlerCount && this.cursor < battlerCount)
            success = this.setCursor(this.lastCursor < 6 ? this.lastCursor || battlerCount : battlerCount);
          break;
      }
    }

    if (success)
      ui.playSelect();

    return success;
  }

  populatePartySlots() {
    const party = this.scene.getParty();

    if (this.cursor < 6 && this.cursor >= party.length)
      this.cursor = party.length - 1;
    else if (this.cursor === 6)
      this.partyCancelButton.select();

    for (let p in party) {
      const slotIndex = parseInt(p);
      const partySlot = new PartySlot(this.scene, slotIndex, party[p], this.iconAnimHandler, this.partyUiMode, this.tmMoveId);
      this.scene.add.existing(partySlot);
      this.partySlotsContainer.add(partySlot);
      this.partySlots.push(partySlot);
      if (this.cursor === slotIndex)
        partySlot.select();
    }
  }
  
  setCursor(cursor: integer): boolean {
    let changed: boolean;
    
    if (this.optionsMode) {
      changed = this.optionsCursor !== cursor;
      let isScroll = false;
      if (changed && this.optionsScroll) {
        if (Math.abs(cursor - this.optionsCursor) === this.options.length - 1) {
          this.optionsScrollCursor = cursor ? this.optionsScrollTotal - 8 : 0;
          this.updateOptions();
        } else {
          const isDown = cursor &&  cursor > this.optionsCursor;
          if (isDown) {
            if (this.options[cursor] === PartyOption.SCROLL_DOWN) {
              isScroll = true;
              this.optionsScrollCursor++;
            }
          } else {
            if (!cursor && this.optionsScrollCursor) {
              isScroll = true;
              this.optionsScrollCursor--;
            }
          }
          if (isScroll && this.optionsScrollCursor === 1)
            this.optionsScrollCursor += isDown ? 1 : -1;
        }
      }
      if (isScroll) {
        this.updateOptions();
       } else
        this.optionsCursor = cursor;
      if (!this.optionsCursorObj) {
        this.optionsCursorObj = this.scene.add.image(0, 0, 'cursor');
        this.optionsCursorObj.setOrigin(0, 0);
        this.optionsContainer.add(this.optionsCursorObj);
      }
      this.optionsCursorObj.setPosition(8 - this.optionsBg.displayWidth, -19 - (16 * ((this.options.length - 1) - this.optionsCursor)));
    } else {
      changed = this.cursor !== cursor;
      if (changed) {
        this.lastCursor = this.cursor;
        this.cursor = cursor;
        if (this.lastCursor < 6)
          this.partySlots[this.lastCursor].deselect();
        else if (this.lastCursor === 6)
          this.partyCancelButton.deselect();
        if (cursor < 6)
          this.partySlots[cursor].select();
        else if (cursor === 6)
          this.partyCancelButton.select();
      }
    }

    return changed;
  }

  showText(text: string, delay?: integer, callback?: Function, callbackDelay?: integer, prompt?: boolean, promptDelay?: integer) {
    if (text === null)
      text = defaultMessage;

    if (text?.indexOf('\n') === -1) {
      this.partyMessageBox.setSize(262, 30);
      this.message.setY(10);
    } else {
      this.partyMessageBox.setSize(262, 42);
      this.message.setY(-5);
    }

    super.showText(text, delay, callback, callbackDelay, prompt, promptDelay);
  }

  showOptions() {
    if (this.cursor === 6)
      return;
    
    this.optionsMode = true;

    let optionsMessage = 'Do what with this Pokémon?';

    switch (this.partyUiMode) {
      case PartyUiMode.MOVE_MODIFIER:
        optionsMessage = 'Select a move.';
        break;
      case PartyUiMode.MODIFIER_TRANSFER:
        if (!this.transferMode)
          optionsMessage = 'Select a held item to transfer.';
        break;
      case PartyUiMode.SPLICE:
        if (!this.transferMode)
          optionsMessage = 'Select another Pokémon to splice.';
        break;
    }

    this.showText(optionsMessage, 0);

    this.updateOptions();

    this.partyMessageBox.setSize(262 - Math.max(this.optionsBg.displayWidth - 56, 0), 30);

    this.setCursor(0);
  }

  updateOptions(): void {
    const wideOptions = this.partyUiMode === PartyUiMode.MODIFIER_TRANSFER;

    const pokemon = this.scene.getParty()[this.cursor];

    const learnableLevelMoves = this.partyUiMode === PartyUiMode.REMEMBER_MOVE_MODIFIER
        ? pokemon.getLearnableLevelMoves()
        : null;

    const itemModifiers = this.partyUiMode === PartyUiMode.MODIFIER_TRANSFER
      ? this.scene.findModifiers(m => m instanceof PokemonHeldItemModifier
        && (m as PokemonHeldItemModifier).getTransferrable(true) && (m as PokemonHeldItemModifier).pokemonId === pokemon.id) as PokemonHeldItemModifier[]
      : null;

    if (this.options.length) {
      this.options.splice(0, this.options.length);
      this.optionsContainer.removeAll(true);
      this.eraseOptionsCursor();
    }

    let formChangeItemModifiers: PokemonFormChangeItemModifier[];

    if (this.partyUiMode !== PartyUiMode.MOVE_MODIFIER && this.partyUiMode !== PartyUiMode.REMEMBER_MOVE_MODIFIER && (this.transferMode || this.partyUiMode !== PartyUiMode.MODIFIER_TRANSFER)) {
      switch (this.partyUiMode) {
        case PartyUiMode.SWITCH:
        case PartyUiMode.FAINT_SWITCH:
        case PartyUiMode.POST_BATTLE_SWITCH:
          if (this.cursor >= this.scene.currentBattle.getBattlerCount()) {
            this.options.push(PartyOption.SEND_OUT);
            if (this.partyUiMode !== PartyUiMode.FAINT_SWITCH
                && this.scene.findModifier(m => m instanceof SwitchEffectTransferModifier
                  && (m as SwitchEffectTransferModifier).pokemonId === this.scene.getPlayerField()[this.fieldIndex].id))
              this.options.push(PartyOption.PASS_BATON);
          }
          if (this.scene.getCurrentPhase() instanceof CommandPhase) {
            formChangeItemModifiers = this.scene.findModifiers(m => m instanceof PokemonFormChangeItemModifier && m.pokemonId === pokemon.id) as PokemonFormChangeItemModifier[];
            if (formChangeItemModifiers.find(m => m.active))
              formChangeItemModifiers = formChangeItemModifiers.filter(m => m.active);
            for (let i = 0; i < formChangeItemModifiers.length; i++)
              this.options.push(PartyOption.FORM_CHANGE_ITEM + i);
          }
          break;
        case PartyUiMode.MODIFIER:
          this.options.push(PartyOption.APPLY);
          break;
        case PartyUiMode.TM_MODIFIER:
          this.options.push(PartyOption.TEACH);
          break;
        case PartyUiMode.MODIFIER_TRANSFER:
          this.options.push(PartyOption.TRANSFER);
          break;
        case PartyUiMode.SPLICE:
          if (this.transferMode) {
            if (this.cursor !== this.transferCursor)
              this.options.push(PartyOption.SPLICE);
          } else
            this.options.push(PartyOption.APPLY);
          break;
        case PartyUiMode.RELEASE:
          this.options.push(PartyOption.RELEASE);
          break;
      }

      this.options.push(PartyOption.SUMMARY);

      if (pokemon.pauseEvolutions && pokemonEvolutions.hasOwnProperty(pokemon.species.speciesId))
        this.options.push(PartyOption.UNPAUSE_EVOLUTION);

      if (this.partyUiMode === PartyUiMode.SWITCH)
        this.options.push(PartyOption.RELEASE);
    } else if (this.partyUiMode === PartyUiMode.MOVE_MODIFIER) {
      for (let m = 0; m < pokemon.moveset.length; m++)
        this.options.push(PartyOption.MOVE_1 + m);
    } else if (this.partyUiMode === PartyUiMode.REMEMBER_MOVE_MODIFIER) {
      const learnableMoves = pokemon.getLearnableLevelMoves();
      for (let m = 0; m < learnableMoves.length; m++)
        this.options.push(m);
    } else {
      for (let im = 0; im < itemModifiers.length; im++)
        this.options.push(im);
    }

    this.optionsScrollTotal = this.options.length;
    let optionStartIndex = this.optionsScrollCursor;
    let optionEndIndex = Math.min(this.optionsScrollTotal, optionStartIndex + (!optionStartIndex || this.optionsScrollCursor + 8 >= this.optionsScrollTotal ? 8 : 7));

    this.optionsScroll = this.optionsScrollTotal > 9;

    if (this.optionsScroll) {
      this.options.splice(optionEndIndex, this.optionsScrollTotal);
      this.options.splice(0, optionStartIndex);
      if (optionStartIndex)
        this.options.unshift(PartyOption.SCROLL_UP);
      if (optionEndIndex < this.optionsScrollTotal)
        this.options.push(PartyOption.SCROLL_DOWN);
    }

    this.options.push(PartyOption.CANCEL);

    this.optionsBg = addWindow(this.scene, 0, 0, 0, 16 * this.options.length + 13);
    this.optionsBg.setOrigin(1, 1);

    this.optionsContainer.add(this.optionsBg);

    optionStartIndex = 0;
    optionEndIndex = this.options.length;

    let widestOptionWidth = 0;
    let optionTexts: Phaser.GameObjects.Text[] = [];

    for (let o = optionStartIndex; o < optionEndIndex; o++) {
      const option = this.options[this.options.length - (o + 1)];
      let altText = false;
      let optionName: string;
      if ((this.partyUiMode !== PartyUiMode.REMEMBER_MOVE_MODIFIER && (this.partyUiMode !== PartyUiMode.MODIFIER_TRANSFER || this.transferMode)) || option === PartyOption.CANCEL) {
        switch (option) {
          case PartyOption.MOVE_1:
          case PartyOption.MOVE_2:
          case PartyOption.MOVE_3:
          case PartyOption.MOVE_4:
            optionName = pokemon.moveset[option - PartyOption.MOVE_1].getName();
            break;
          default:
            if (formChangeItemModifiers && option >= PartyOption.FORM_CHANGE_ITEM) {
              const modifier = formChangeItemModifiers[option - PartyOption.FORM_CHANGE_ITEM];
              optionName = `${modifier.active ? 'Deactivate' : 'Activate'} ${modifier.type.name}`;
            } else
              optionName = Utils.toReadableString(PartyOption[option]);
            break;
        }
      } else if (option === PartyOption.SCROLL_UP)
        optionName = '↑';
      else if (option === PartyOption.SCROLL_DOWN)
        optionName = '↓';
      else if (this.partyUiMode === PartyUiMode.REMEMBER_MOVE_MODIFIER) {
        const move = learnableLevelMoves[option];
        optionName = allMoves[move].name;
        altText = !pokemon.getSpeciesForm().getLevelMoves().find(plm => plm[1] === move);
      } else {
        const itemModifier = itemModifiers[option];
        optionName = itemModifier.type.name;
        if (itemModifier.stackCount > 1)
          optionName += ` (${itemModifier.stackCount})`;
      }

      const yCoord = -6 - 16 * o;
      const optionText = addTextObject(this.scene, 0, yCoord - 16, optionName, TextStyle.WINDOW);
      if (altText) {
        optionText.setColor('#40c8f8');
        optionText.setShadowColor('#006090')
      }
      optionText.setOrigin(0, 0);

      optionTexts.push(optionText);

      widestOptionWidth = Math.max(optionText.displayWidth, widestOptionWidth);

      this.optionsContainer.add(optionText);
    }

    this.optionsBg.width = Math.max(widestOptionWidth + 24, 94);
    for (let optionText of optionTexts)
      optionText.x = 15 - this.optionsBg.width;
  }

  startTransfer(): void {
    this.transferMode = true;
    this.transferCursor = this.cursor;
    this.transferOptionCursor = this.getOptionsCursorWithScroll();

    this.partySlots[this.transferCursor].setTransfer(true);
  }

  clearTransfer(): void {
    this.transferMode = false;
    this.partySlots[this.transferCursor].setTransfer(false);
  }

  doRelease(slotIndex: integer): void {
    this.showText(this.getReleaseMessage(this.scene.getParty()[slotIndex].name), null, () => {
      this.clearPartySlots();
      this.scene.removePartyMemberModifiers(slotIndex);
      const releasedPokemon = this.scene.getParty().splice(slotIndex, 1)[0];
      releasedPokemon.destroy();
      this.populatePartySlots();
      if (this.cursor >= this.scene.getParty().length)
        this.setCursor(this.cursor - 1);
      if (this.partyUiMode === PartyUiMode.RELEASE) {
        const selectCallback = this.selectCallback;
        this.selectCallback = null;
        selectCallback(this.cursor, PartyOption.RELEASE);
      }
      this.showText(null, 0);
    }, null, true);
  }

  getReleaseMessage(pokemonName: string): string {
    const rand = Utils.randInt(128);
    if (rand < 20)
      return `Goodbye, ${pokemonName}!`;
    else if (rand < 40)
      return `Byebye, ${pokemonName}!`;
    else if (rand < 60)
      return `Farewell, ${pokemonName}!`;
    else if (rand < 80)
      return `So long, ${pokemonName}!`;
    else if (rand < 100)
      return `This is where we part, ${pokemonName}!`;
    else if (rand < 108)
      return `I'll miss you, ${pokemonName}!`;
    else if (rand < 116)
      return `I'll never forget you, ${pokemonName}!`;
    else if (rand < 124)
      return `Until we meet again, ${pokemonName}!`;
    else if (rand < 127)
      return `Sayonara, ${pokemonName}!`
    else
      return `Smell ya later, ${pokemonName}!`;
  }

  getOptionsCursorWithScroll(): integer {
    return this.optionsCursor + this.optionsScrollCursor + (this.options && this.options[0] === PartyOption.SCROLL_UP ? -1 : 0);
  }

  clearOptions() {
    this.optionsMode = false;
    this.optionsScroll = false;
    this.optionsScrollCursor = 0;
    this.optionsScrollTotal = 0;
    this.options.splice(0, this.options.length);
    this.optionsContainer.removeAll(true);
    this.eraseOptionsCursor();

    this.partyMessageBox.setSize(262, 30);
    this.showText(null, 0);
  }

  eraseOptionsCursor() {
    if (this.optionsCursorObj)
      this.optionsCursorObj.destroy();
    this.optionsCursorObj = null;
  }

  clear() {
    super.clear();
    this.partyContainer.setVisible(false);
    this.clearPartySlots();
  }

  clearPartySlots() {
    this.partySlots.splice(0, this.partySlots.length);
    this.partySlotsContainer.removeAll(true);
  }
}

class PartySlot extends Phaser.GameObjects.Container {
  private selected: boolean;
  private transfer: boolean;
  private slotIndex: integer;
  private pokemon: PlayerPokemon;

  private slotBg: Phaser.GameObjects.Image;
  private slotPb: Phaser.GameObjects.Sprite;

  private pokemonIcon: Phaser.GameObjects.Sprite;
  private iconAnimHandler: PokemonIconAnimHandler;

  constructor(scene: BattleScene, slotIndex: integer, pokemon: PlayerPokemon, iconAnimHandler: PokemonIconAnimHandler, partyUiMode: PartyUiMode, tmMoveId: Moves) {
    super(scene, slotIndex >= scene.currentBattle.getBattlerCount() ? 230.5 : 64,
      slotIndex >= scene.currentBattle.getBattlerCount() ? -184 + (scene.currentBattle.double ? -38 : 0)
      + (28 + (scene.currentBattle.double ? 6 : 0)) * slotIndex : -124 + (scene.currentBattle.double ? -8 : 0) + slotIndex * 64);

    this.slotIndex = slotIndex;
    this.pokemon = pokemon;
    this.iconAnimHandler = iconAnimHandler;
    
    this.setup(partyUiMode, tmMoveId);
  }

  setup(partyUiMode: PartyUiMode, tmMoveId: Moves) {
    const battlerCount = (this.scene as BattleScene).currentBattle.getBattlerCount();

    const slotKey = `party_slot${this.slotIndex >= battlerCount ? '' : '_main'}`;

    const slotBg = this.scene.add.sprite(0, 0, slotKey, `${slotKey}${this.pokemon.hp ? '' : '_fnt'}`);
    this.slotBg = slotBg;

    this.add(slotBg);

    const slotPb = this.scene.add.sprite(this.slotIndex >= battlerCount ? -85.5 : -51, this.slotIndex >= battlerCount ? 0 : -20.5, 'party_pb');
    this.slotPb = slotPb;

    this.add(slotPb);

    this.pokemonIcon = this.scene.add.sprite(slotPb.x, slotPb.y, this.pokemon.getIconAtlasKey(true));
    this.pokemonIcon.setFrame(this.pokemon.getIconId(true));

    this.add(this.pokemonIcon);

    this.iconAnimHandler.addOrUpdate(this.pokemonIcon, PokemonIconAnimMode.PASSIVE);

    const slotInfoContainer = this.scene.add.container(0, 0);
    this.add(slotInfoContainer);

    let displayName = this.pokemon.name;
    let nameTextWidth: number;

    let nameSizeTest = addTextObject(this.scene, 0, 0, displayName, TextStyle.PARTY);
    nameTextWidth = nameSizeTest.displayWidth;

    while (nameTextWidth > (this.slotIndex ? 52 : 80)) {
      displayName = `${displayName.slice(0, displayName.endsWith('.') ? -2 : -1).trimEnd()}.`;
      nameSizeTest.setText(displayName);
      nameTextWidth = nameSizeTest.displayWidth;
    }

    nameSizeTest.destroy();

    const slotName = addTextObject(this.scene, 0, 0, displayName, TextStyle.PARTY);
    slotName.setPositionRelative(slotBg, this.slotIndex >= battlerCount ? 21 : 24, this.slotIndex >= battlerCount ? 2 : 10);
    slotName.setOrigin(0, 0);

    const slotLevelLabel = this.scene.add.image(0, 0, 'party_slot_overlay_lv');
    slotLevelLabel.setPositionRelative(slotName, 8, 12);
    slotLevelLabel.setOrigin(0, 0);

    const slotLevelText = addTextObject(this.scene, 0, 0, this.pokemon.level.toString(), this.pokemon.level < (this.scene as BattleScene).getMaxExpLevel() ? TextStyle.PARTY : TextStyle.PARTY_RED);
    slotLevelText.setPositionRelative(slotLevelLabel, 9, 0);
    slotLevelText.setOrigin(0, 0.25);

    slotInfoContainer.add([ slotName, slotLevelLabel, slotLevelText ]);

    const genderSymbol = getGenderSymbol(this.pokemon.getGender(true));

    if (genderSymbol) {
      const slotGenderText = addTextObject(this.scene, 0, 0, genderSymbol, TextStyle.PARTY);
      slotGenderText.setColor(getGenderColor(this.pokemon.getGender(true)));
      slotGenderText.setShadowColor(getGenderColor(this.pokemon.getGender(true), true));
      if (this.slotIndex >= battlerCount)
        slotGenderText.setPositionRelative(slotLevelLabel, 36, 0);
      else
        slotGenderText.setPositionRelative(slotName, 76, 3);
      slotGenderText.setOrigin(0, 0.25);

      slotInfoContainer.add(slotGenderText);
    }

    if (this.pokemon.status) {
      const statusIndicator = this.scene.add.sprite(0, 0, 'statuses');
      statusIndicator.setFrame(StatusEffect[this.pokemon.status?.effect].toLowerCase());
      statusIndicator.setOrigin(0, 0);
      statusIndicator.setPositionRelative(slotLevelLabel, this.slotIndex >= battlerCount ? 43 : 55, 0);

      slotInfoContainer.add(statusIndicator);
    }

    if (this.pokemon.isShiny()) {
      const shinyStar = this.scene.add.image(0, 0, 'shiny_star');
      shinyStar.setOrigin(0, 0);
      shinyStar.setPositionRelative(slotName, -8, 2);

      slotInfoContainer.add(shinyStar);
    }

    if (partyUiMode !== PartyUiMode.TM_MODIFIER) {
      const slotHpBar = this.scene.add.image(0, 0, 'party_slot_hp_bar');
      slotHpBar.setPositionRelative(slotBg, this.slotIndex >= battlerCount ? 72 : 8, this.slotIndex >= battlerCount ? 6 : 31);
      slotHpBar.setOrigin(0, 0);

      const hpRatio = this.pokemon.getHpRatio();

      const slotHpOverlay = this.scene.add.sprite(0, 0, 'party_slot_hp_overlay', hpRatio > 0.5 ? 'high' : hpRatio > 0.25 ? 'medium' : 'low');
      slotHpOverlay.setPositionRelative(slotHpBar, 16, 2);
      slotHpOverlay.setOrigin(0, 0);
      slotHpOverlay.setScale(hpRatio, 1);

      const slotHpText = addTextObject(this.scene, 0, 0, `${this.pokemon.hp}/${this.pokemon.getMaxHp()}`, TextStyle.PARTY);
      slotHpText.setPositionRelative(slotHpBar, slotHpBar.width - 3, slotHpBar.height - 2);
      slotHpText.setOrigin(1, 0);

      slotInfoContainer.add([ slotHpBar, slotHpOverlay, slotHpText ]);
    } else {
      let slotTmText: string;
      switch (true) {
        case (this.pokemon.compatibleTms.indexOf(tmMoveId) === -1):
          slotTmText = 'Not Able';
          break;
        case (this.pokemon.getMoveset().filter(m => m?.moveId === tmMoveId).length > 0):
          slotTmText = 'Learned';
          break;
        default:
          slotTmText = 'Able';
          break;
      }

      const slotTmLabel = addTextObject(this.scene, 0, 0, slotTmText, TextStyle.MESSAGE);
      slotTmLabel.setPositionRelative(slotBg, this.slotIndex >= battlerCount ? 94 : 32, this.slotIndex >= battlerCount ? 16 : 46);
      slotTmLabel.setOrigin(0, 1);

      slotInfoContainer.add(slotTmLabel);
    }
  }

  select(): void {
    if (this.selected)
      return;

    this.selected = true;
    this.iconAnimHandler.addOrUpdate(this.pokemonIcon, PokemonIconAnimMode.ACTIVE);

    this.updateSlotTexture();
    this.slotPb.setFrame('party_pb_sel');
  }

  deselect(): void {
    if (!this.selected)
      return;

    this.selected = false;
    this.iconAnimHandler.addOrUpdate(this.pokemonIcon, PokemonIconAnimMode.PASSIVE);

    this.updateSlotTexture();
    this.slotPb.setFrame('party_pb');
  }

  setTransfer(transfer: boolean): void {
    if (this.transfer === transfer)
      return;

    this.transfer = transfer;
    this.updateSlotTexture();
  }

  private updateSlotTexture(): void {
    const battlerCount = (this.scene as BattleScene).currentBattle.getBattlerCount();
    this.slotBg.setTexture(`party_slot${this.slotIndex >= battlerCount ? '' : '_main'}`,
      `party_slot${this.slotIndex >= battlerCount ? '' : '_main'}${this.transfer ? '_swap' : this.pokemon.hp ? '' : '_fnt'}${this.selected ? '_sel' : ''}`);
  }
}

class PartyCancelButton extends Phaser.GameObjects.Container {
  private selected: boolean;

  private partyCancelBg: Phaser.GameObjects.Sprite;
  private partyCancelPb: Phaser.GameObjects.Sprite;

  constructor(scene: BattleScene, x: number, y: number) {
    super(scene, x, y);

    this.setup();
  }

  setup() {
    const partyCancelBg = this.scene.add.sprite(0, 0, 'party_cancel');
    this.add(partyCancelBg);

    this.partyCancelBg = partyCancelBg;

    const partyCancelPb = this.scene.add.sprite(-17, 0, 'party_pb');
    this.add(partyCancelPb);

    this.partyCancelPb = partyCancelPb;

    const partyCancelText = addTextObject(this.scene, -7, -6, 'Cancel', TextStyle.PARTY);
    this.add(partyCancelText);
  }

  select() {
    if (this.selected)
      return;

    this.selected = true;

    this.partyCancelBg.setFrame(`party_cancel_sel`);
    this.partyCancelPb.setFrame('party_pb_sel');
  }

  deselect() {
    if (!this.selected)
      return;

    this.selected = false;

    this.partyCancelBg.setFrame('party_cancel');
    this.partyCancelPb.setFrame('party_pb');
  }
}