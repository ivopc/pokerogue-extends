import * as Modifiers from './modifier';
import { AttackMove, allMoves } from '../data/move';
import { Moves } from "../data/enums/moves";
import { PokeballType, getPokeballName } from '../data/pokeball';
import Pokemon, { EnemyPokemon, PlayerPokemon, PokemonMove } from '../pokemon';
import { EvolutionItem, SpeciesFriendshipEvolutionCondition, pokemonEvolutions } from '../data/pokemon-evolutions';
import { Stat, getStatName } from '../data/pokemon-stat';
import { tmPoolTiers, tmSpecies } from '../data/tms';
import { Type } from '../data/type';
import PartyUiHandler, { PokemonMoveSelectFilter, PokemonSelectFilter } from '../ui/party-ui-handler';
import * as Utils from '../utils';
import { TempBattleStat, getTempBattleStatBoosterItemName, getTempBattleStatName } from '../data/temp-battle-stat';
import { BerryType, getBerryEffectDescription, getBerryName } from '../data/berry';
import { Unlockables } from '../system/unlockables';
import { GameMode } from '../game-mode';
import { StatusEffect, getStatusEffectDescriptor } from '../data/status-effect';
import { SpeciesFormKey } from '../data/pokemon-species';
import BattleScene from '../battle-scene';
import { VoucherType, getVoucherTypeIcon, getVoucherTypeName } from '../system/voucher';
import { FormChangeItem, SpeciesFormChangeItemTrigger, pokemonFormChanges } from '../data/pokemon-forms';
import { ModifierTier } from './modifier-tier';

type Modifier = Modifiers.Modifier;

export enum ModifierPoolType {
  PLAYER,
  WILD,
  TRAINER,
  ENEMY_BUFF
}

type NewModifierFunc = (type: ModifierType, args: any[]) => Modifier;

export class ModifierType {
  public id: string;
  public generatorId: string;
  public name: string;
  protected description: string;
  public iconImage: string;
  public group: string;
  public soundName: string;
  public tier: ModifierTier;
  protected newModifierFunc: NewModifierFunc;

  constructor(name: string, description: string, newModifierFunc: NewModifierFunc, iconImage?: string, group?: string, soundName?: string) {
    this.name = name;
    this.description = description;
    this.iconImage = iconImage || name?.replace(/[ \-]/g, '_')?.replace(/['\.]/g, '')?.toLowerCase();
    this.group = group || '';
    this.soundName = soundName || 'restore';
    this.newModifierFunc = newModifierFunc;
  }

  getDescription(scene: BattleScene): string {
    return this.description;
  }

  setTier(tier: ModifierTier): void {
    this.tier = tier;
  }

  newModifier(...args: any[]): Modifier {
    return this.newModifierFunc(this, args);
  }
}

type ModifierTypeGeneratorFunc = (party: Pokemon[], pregenArgs?: any[]) => ModifierType;

export class ModifierTypeGenerator extends ModifierType {
  private genTypeFunc:  ModifierTypeGeneratorFunc;

  constructor(genTypeFunc: ModifierTypeGeneratorFunc) {
    super(null, null, null, null);
    this.genTypeFunc = genTypeFunc;
  }

  generateType(party: Pokemon[], pregenArgs?: any[]) {
    const ret = this.genTypeFunc(party, pregenArgs);
    if (ret) {
      ret.generatorId = ret.id;
      ret.id = this.id;
      ret.setTier(this.tier);
    }
    return ret;
  }
}

export interface GeneratedPersistentModifierType {
  getPregenArgs(): any[];
}

class AddPokeballModifierType extends ModifierType {
  constructor(pokeballType: PokeballType, count: integer, iconImage?: string) {
    super(`${count}x ${getPokeballName(pokeballType)}`, `Receive ${getPokeballName(pokeballType)} x${count}`,
      (_type, _args) => new Modifiers.AddPokeballModifier(this, pokeballType, count), iconImage, 'pb', 'pb_bounce_1');
  }
}

class AddVoucherModifierType extends ModifierType {
  constructor(voucherType: VoucherType, count: integer) {
    super(`${count}x ${getVoucherTypeName(voucherType)}`, `Receive ${getVoucherTypeName(voucherType)} x${count}`,
      (_type, _args) => new Modifiers.AddVoucherModifier(this, voucherType, count), getVoucherTypeIcon(voucherType), 'voucher');
  }
}

export class PokemonModifierType extends ModifierType {
  public selectFilter: PokemonSelectFilter;

  constructor(name: string, description: string, newModifierFunc: NewModifierFunc, selectFilter?: PokemonSelectFilter, iconImage?: string, group?: string, soundName?: string) {
    super(name, description, newModifierFunc, iconImage, group, soundName);

    this.selectFilter = selectFilter;
  }
}

export class PokemonHeldItemModifierType extends PokemonModifierType {
  constructor(name: string, description: string, newModifierFunc: NewModifierFunc, iconImage?: string, group?: string, soundName?: string) {
    super(name, description, newModifierFunc, (pokemon: PlayerPokemon) => {
      const dummyModifier = this.newModifier(pokemon);
      const matchingModifier = pokemon.scene.findModifier(m => m instanceof Modifiers.PokemonHeldItemModifier && m.pokemonId === pokemon.id && m.matchType(dummyModifier)) as Modifiers.PokemonHeldItemModifier;
      if (matchingModifier && matchingModifier.stackCount === matchingModifier.getMaxStackCount(pokemon.scene))
        return `${pokemon.name} has too many\nof this item!`;
      return null;
    }, iconImage, group, soundName);
  }

  newModifier(...args: any[]): Modifiers.PokemonHeldItemModifier {
    return super.newModifier(...args) as Modifiers.PokemonHeldItemModifier;
  }
}

export class PokemonHpRestoreModifierType extends PokemonModifierType {
  protected restorePoints: integer;
  protected restorePercent: integer;
  protected healStatus: boolean;

  constructor(name: string, restorePoints: integer, restorePercent: integer, healStatus: boolean = false, newModifierFunc?: NewModifierFunc, selectFilter?: PokemonSelectFilter, iconImage?: string, group?: string) {
    super(name, restorePoints ? `Restore ${restorePoints} HP or ${restorePercent}% HP for one Pokémon, whichever is higher` : `Fully restores HP for one Pokémon${healStatus ? ' and heals any status ailment ' : ''}`,
      newModifierFunc || ((_type, args) => new Modifiers.PokemonHpRestoreModifier(this, (args[0] as PlayerPokemon).id, this.restorePoints, this.restorePercent, this.healStatus, false)),
    selectFilter || ((pokemon: PlayerPokemon) => {
      if (!pokemon.hp || (pokemon.hp >= pokemon.getMaxHp() && (!this.healStatus || !pokemon.status)))
        return PartyUiHandler.NoEffectMessage;
      return null;
    }), iconImage, group || 'potion');

    this.restorePoints = restorePoints;
    this.restorePercent = restorePercent;
    this.healStatus = healStatus;
  }
}

export class PokemonReviveModifierType extends PokemonHpRestoreModifierType {
  constructor(name: string, restorePercent: integer, iconImage?: string) {
    super(name, 0, restorePercent, false, (_type, args) => new Modifiers.PokemonHpRestoreModifier(this, (args[0] as PlayerPokemon).id, 0, this.restorePercent, false, true),
      ((pokemon: PlayerPokemon) => {
        if (!pokemon.isFainted())
          return PartyUiHandler.NoEffectMessage;
        return null;
      }), iconImage, 'revive');

    this.description = `Revive one Pokémon and restore ${restorePercent}% HP`;
    this.selectFilter = (pokemon: PlayerPokemon) => {
      if (pokemon.hp)
        return PartyUiHandler.NoEffectMessage;
      return null;
    };
  }
}

export class PokemonStatusHealModifierType extends PokemonModifierType {
  constructor(name: string) {
    super(name, `Heal any status ailment for one Pokémon`,
      ((_type, args) => new Modifiers.PokemonStatusHealModifier(this, (args[0] as PlayerPokemon).id)),
      ((pokemon: PlayerPokemon) => {
        if (!pokemon.hp || !pokemon.status)
          return PartyUiHandler.NoEffectMessage;
        return null;
      }));
  }
}

export abstract class PokemonMoveModifierType extends PokemonModifierType {
  public moveSelectFilter: PokemonMoveSelectFilter;

  constructor(name: string, description: string, newModifierFunc: NewModifierFunc, selectFilter?: PokemonSelectFilter, moveSelectFilter?: PokemonMoveSelectFilter,
    iconImage?: string, group?: string) {
    super(name, description, newModifierFunc, selectFilter, iconImage, group);

    this.moveSelectFilter = moveSelectFilter;
  }
}

export class PokemonPpRestoreModifierType extends PokemonMoveModifierType {
  protected restorePoints: integer;

  constructor(name: string, restorePoints: integer, iconImage?: string) {
    super(name, `Restore ${restorePoints > -1 ? restorePoints : 'all'} PP for one Pokémon move`, (_type, args) => new Modifiers.PokemonPpRestoreModifier(this, (args[0] as PlayerPokemon).id, (args[1] as integer), this.restorePoints),
      (_pokemon: PlayerPokemon) => {
      return null;
    }, (pokemonMove: PokemonMove) => {
      if (!pokemonMove.ppUsed)
        return PartyUiHandler.NoEffectMessage;
      return null;
    }, iconImage, 'ether');

    this.restorePoints = restorePoints;
  }
}

export class PokemonAllMovePpRestoreModifierType extends PokemonModifierType {
  protected restorePoints: integer;

  constructor(name: string, restorePoints: integer, iconImage?: string) {
    super(name, `Restore ${restorePoints > -1 ? restorePoints : 'all'} PP for all of one Pokémon's moves`, (_type, args) => new Modifiers.PokemonAllMovePpRestoreModifier(this, (args[0] as PlayerPokemon).id, this.restorePoints),
      (pokemon: PlayerPokemon) => {
        if (!pokemon.getMoveset().filter(m => m.ppUsed).length)
          return PartyUiHandler.NoEffectMessage;
        return null;
      }, iconImage, 'elixir');

    this.restorePoints = restorePoints;
  }
}

export class PokemonPpUpModifierType extends PokemonMoveModifierType {
  protected upPoints: integer;

  constructor(name: string, upPoints: integer, iconImage?: string) {
    super(name, `Permanently increase PP for one Pokémon move by ${upPoints} for every 5 maximum PP (maximum 3)`, (_type, args) => new Modifiers.PokemonPpUpModifier(this, (args[0] as PlayerPokemon).id, (args[1] as integer), this.upPoints),
      (_pokemon: PlayerPokemon) => {
      return null;
    }, (pokemonMove: PokemonMove) => {
      if (pokemonMove.getMove().pp < 5 || pokemonMove.ppUp >= 3)
        return PartyUiHandler.NoEffectMessage;
      return null;
    }, iconImage, 'ppUp');

    this.upPoints = upPoints;
  }
}

export class RememberMoveModifierType extends PokemonModifierType {
  constructor(name: string, description: string, iconImage?: string, group?: string) {
    super(name, description, (type, args) => new Modifiers.RememberMoveModifier(type, (args[0] as PlayerPokemon).id, (args[1] as integer)),
      (pokemon: PlayerPokemon) => {
        if (!pokemon.getLearnableLevelMoves().length)
          return PartyUiHandler.NoEffectMessage;
        return null;
      }, iconImage, group);
  }
}

export class DoubleBattleChanceBoosterModifierType extends ModifierType {
  public battleCount: integer;

  constructor(name: string, battleCount: integer) {
    super(name, `Doubles the chance of an encounter being a double battle for ${battleCount} battles`, (_type, _args) => new Modifiers.DoubleBattleChanceBoosterModifier(this, this.battleCount),
      null, 'lure');

    this.battleCount = battleCount;
  }
}

export class TempBattleStatBoosterModifierType extends ModifierType implements GeneratedPersistentModifierType {
  public tempBattleStat: TempBattleStat;

  constructor(tempBattleStat: TempBattleStat) {
    super(getTempBattleStatBoosterItemName(tempBattleStat),
      `Increases the ${getTempBattleStatName(tempBattleStat)} of all party members by 1 stage for 5 battles`,
      (_type, _args) => new Modifiers.TempBattleStatBoosterModifier(this, this.tempBattleStat),
      getTempBattleStatBoosterItemName(tempBattleStat).replace(/\./g, '').replace(/[ ]/g, '_').toLowerCase());

    this.tempBattleStat = tempBattleStat;
  }

  getPregenArgs(): any[] {
    return [ this.tempBattleStat ];
  }
}

export class BerryModifierType extends PokemonHeldItemModifierType implements GeneratedPersistentModifierType {
  private berryType: BerryType;

  constructor(berryType: BerryType) {
    super(getBerryName(berryType), getBerryEffectDescription(berryType),
      (type, args) => new Modifiers.BerryModifier(type, (args[0] as Pokemon).id, berryType),
      null, 'berry');
    
    this.berryType = berryType;
  }

  getPregenArgs(): any[] {
    return [ this.berryType ];
  }
}

function getAttackTypeBoosterItemName(type: Type) {
  switch (type) {
    case Type.NORMAL:
      return 'Silk Scarf';
    case Type.FIGHTING:
      return 'Black Belt';
    case Type.FLYING:
      return 'Sharp Beak';
    case Type.POISON:
      return 'Poison Barb';
    case Type.GROUND:
      return 'Soft Sand';
    case Type.ROCK:
      return 'Hard Stone';
    case Type.BUG:
      return 'Silver Powder';
    case Type.GHOST:
      return 'Spell Tag';
    case Type.STEEL:
      return 'Metal Coat';
    case Type.FIRE:
      return 'Charcoal';
    case Type.WATER:
      return 'Mystic Water';
    case Type.GRASS:
      return 'Miracle Seed';
    case Type.ELECTRIC:
      return 'Magnet';
    case Type.PSYCHIC:
      return 'Twisted Spoon';
    case Type.ICE:
      return 'Never-Melt Ice'
    case Type.DRAGON:
      return 'Dragon Fang';
    case Type.DARK:
      return 'Black Glasses';
    case Type.FAIRY:
      return 'Fairy Feather';
  }
}

export class AttackTypeBoosterModifierType extends PokemonHeldItemModifierType implements GeneratedPersistentModifierType {
  public moveType: Type;
  public boostPercent: integer;

  constructor(moveType: Type, boostPercent: integer) {
    super(getAttackTypeBoosterItemName(moveType), `Inceases the power of a Pokémon's ${Utils.toReadableString(Type[moveType])}-type moves by 20%`,
      (_type, args) => new Modifiers.AttackTypeBoosterModifier(this, (args[0] as Pokemon).id, moveType, boostPercent),
      `${getAttackTypeBoosterItemName(moveType).replace(/[ \-]/g, '_').toLowerCase()}`);

    this.moveType = moveType;
    this.boostPercent = boostPercent;
  }

  getPregenArgs(): any[] {
    return [ this.moveType ];
  }
}

export class PokemonLevelIncrementModifierType extends PokemonModifierType {
  constructor(name: string, iconImage?: string) {
    super(name, `Increase a Pokémon\'s level by 1`, (_type, args) => new Modifiers.PokemonLevelIncrementModifier(this, (args[0] as PlayerPokemon).id),
      (_pokemon: PlayerPokemon) => null, iconImage);
  }
}

export class AllPokemonLevelIncrementModifierType extends ModifierType {
  constructor(name: string, iconImage?: string) {
    super(name, `Increase all party members' level by 1`, (_type, _args) => new Modifiers.PokemonLevelIncrementModifier(this, -1), iconImage);
  }
}

function getBaseStatBoosterItemName(stat: Stat) {
  switch (stat) {
    case Stat.HP:
      return 'HP Up';
    case Stat.ATK:
      return 'Protein';
    case Stat.DEF:
      return 'Iron';
    case Stat.SPATK:
      return 'Calcium';
    case Stat.SPDEF:
      return 'Zinc';
    case Stat.SPD:
      return 'Carbos';
  }
}

export class PokemonBaseStatBoosterModifierType extends PokemonHeldItemModifierType implements GeneratedPersistentModifierType {
  private stat: Stat;

  constructor(name: string, stat: Stat, _iconImage?: string) {
    super(name, `Increases the holder's base ${getStatName(stat)} by 10%. The higher your IVs, the higher the stack limit.`, (_type, args) => new Modifiers.PokemonBaseStatModifier(this, (args[0] as Pokemon).id, this.stat));

    this.stat = stat;
  }

  getPregenArgs(): any[] {
    return [ this.stat ];
  }
}

class AllPokemonFullHpRestoreModifierType extends ModifierType {
  constructor(name: string, description?: string, newModifierFunc?: NewModifierFunc, iconImage?: string) {
    super(name, description || `Restore 100% HP for all Pokémon`, newModifierFunc || ((_type, _args) => new Modifiers.PokemonHpRestoreModifier(this, -1, 0, 100, false)), iconImage);
  }
}

class AllPokemonFullReviveModifierType extends AllPokemonFullHpRestoreModifierType {
  constructor(name: string, iconImage?: string) {
    super(name, `Revives all fainted Pokémon, fully restoring HP`, (_type, _args) => new Modifiers.PokemonHpRestoreModifier(this, -1, 0, 100, false, true), iconImage);
  }
}

export class MoneyRewardModifierType extends ModifierType {
  private moneyMultiplier: number;

  constructor(name: string, moneyMultiplier: number, moneyMultiplierDescriptor: string, iconImage?: string) {
    super(name, `Grants a ${moneyMultiplierDescriptor} amount of money (₽{AMOUNT})`, (_type, _args) => new Modifiers.MoneyRewardModifier(this, moneyMultiplier), iconImage, 'money', 'buy');

    this.moneyMultiplier = moneyMultiplier;
  }

  getDescription(scene: BattleScene): string {
    return this.description.replace('{AMOUNT}', scene.getWaveMoneyAmount(this.moneyMultiplier).toLocaleString('en-US'));
  }
}

export class ExpBoosterModifierType extends ModifierType {
  constructor(name: string, boostPercent: integer, iconImage?: string) {
    super(name, `Increases gain of EXP. Points by ${boostPercent}%`, () => new Modifiers.ExpBoosterModifier(this, boostPercent), iconImage);
  }
}

export class PokemonExpBoosterModifierType extends PokemonHeldItemModifierType {
  constructor(name: string, boostPercent: integer, iconImage?: string) {
    super(name, `Increases the holder's gain of EXP. Points by ${boostPercent}%`, (_type, args) => new Modifiers.PokemonExpBoosterModifier(this, (args[0] as Pokemon).id, boostPercent),
      iconImage);
  }
}

export class PokemonFriendshipBoosterModifierType extends PokemonHeldItemModifierType {
  constructor(name: string, iconImage?: string) {
    super(name,'Increases friendship gain per victory by 50%', (_type, args) => new Modifiers.PokemonFriendshipBoosterModifier(this, (args[0] as Pokemon).id), iconImage);
  }
}

export class TmModifierType extends PokemonModifierType {
  public moveId: Moves;

  constructor(moveId: Moves) {
    super(`TM${Utils.padInt(Object.keys(tmSpecies).indexOf(moveId.toString()) + 1, 3)} - ${allMoves[moveId].name}`, `Teach ${allMoves[moveId].name} to a Pokémon`, (_type, args) => new Modifiers.TmModifier(this, (args[0] as PlayerPokemon).id),
      (pokemon: PlayerPokemon) => {
        if (pokemon.compatibleTms.indexOf(moveId) === -1 || pokemon.getMoveset().filter(m => m?.moveId === moveId).length)
          return PartyUiHandler.NoEffectMessage;
        return null;
      }, `tm_${Type[allMoves[moveId].type].toLowerCase()}`, 'tm');

    this.moveId = moveId;
  }
}

export class EvolutionItemModifierType extends PokemonModifierType implements GeneratedPersistentModifierType {
  public evolutionItem: EvolutionItem;

  constructor(evolutionItem: EvolutionItem) {
    super(Utils.toReadableString(EvolutionItem[evolutionItem]), `Causes certain Pokémon to evolve`, (_type, args) => new Modifiers.EvolutionItemModifier(this, (args[0] as PlayerPokemon).id),
    (pokemon: PlayerPokemon) => {
      if (pokemonEvolutions.hasOwnProperty(pokemon.species.speciesId) && pokemonEvolutions[pokemon.species.speciesId].filter(e => e.item === this.evolutionItem
        && (!e.condition || e.condition.predicate(pokemon))).length)
        return null;

      return PartyUiHandler.NoEffectMessage;
    }, EvolutionItem[evolutionItem].toLowerCase());

    this.evolutionItem = evolutionItem;
  }

  getPregenArgs(): any[] {
    return [ this.evolutionItem ];
  }
}

export class FormChangeItemModifierType extends PokemonModifierType implements GeneratedPersistentModifierType {
  public formChangeItem: FormChangeItem;

  constructor(formChangeItem: FormChangeItem) {
    super(Utils.toReadableString(FormChangeItem[formChangeItem]), `Causes certain Pokémon to change form`, (_type, args) => new Modifiers.PokemonFormChangeItemModifier(this, (args[0] as PlayerPokemon).id, formChangeItem, true),
    (pokemon: PlayerPokemon) => {
      if (pokemonFormChanges.hasOwnProperty(pokemon.species.speciesId) && !!pokemonFormChanges[pokemon.species.speciesId].find(fc => fc.trigger.hasTriggerType(SpeciesFormChangeItemTrigger)))
        return null;

      return PartyUiHandler.NoEffectMessage;
    }, FormChangeItem[formChangeItem].toLowerCase());

    this.formChangeItem = formChangeItem;
  }

  getPregenArgs(): any[] {
    return [ this.formChangeItem ];
  }
}

export class FusePokemonModifierType extends PokemonModifierType {
  constructor(name: string, iconImage?: string) {
    super(name, 'Combines two Pokémon (transfers ability, splits base stats and types, shares move pool)', (_type, args) => new Modifiers.FusePokemonModifier(this, (args[0] as PlayerPokemon).id, (args[1] as PlayerPokemon).id),
      (pokemon: PlayerPokemon) => {
        if (pokemon.isFusion())
          return PartyUiHandler.NoEffectMessage;
        return null;
      }, iconImage);
  }
}

export class UnfusePokemonModifierType extends PokemonModifierType {
  constructor(name: string, iconImage?: string) {
    super(name, 'Removes the fusion aspects of a spliced Pokémon, but the second Pokémon is lost', (_type, args) => new Modifiers.UnfusePokemonModifier(this, (args[0] as PlayerPokemon).id),
      (pokemon: PlayerPokemon) => {
        if (!pokemon.isFusion())
          return PartyUiHandler.NoEffectMessage;
        return null;
      }, iconImage);
  }
}

class AttackTypeBoosterModifierTypeGenerator extends ModifierTypeGenerator {
  constructor() {
    super((party: Pokemon[], pregenArgs?: any[]) => {
      if (pregenArgs)
        return new AttackTypeBoosterModifierType(pregenArgs[0] as Type, 20);

      const attackMoveTypes = party.map(p => p.getMoveset().map(m => m.getMove()).filter(m => m instanceof AttackMove).map(m => m.type)).flat();
      const attackMoveTypeWeights = new Map<Type, integer>();
      let totalWeight = 0;
      for (let t of attackMoveTypes) {
        if (attackMoveTypeWeights.has(t)) {
          if (attackMoveTypeWeights.get(t) < 3)
            attackMoveTypeWeights.set(t, attackMoveTypeWeights.get(t) + 1);
          else
            continue;
        } else
          attackMoveTypeWeights.set(t, 1);
        totalWeight++;
      }

      if (!totalWeight)
        return null;

      let type: Type;
      
      const randInt = Utils.randSeedInt(totalWeight);
      let weight = 0;

      for (let t of attackMoveTypeWeights.keys()) {
        const typeWeight = attackMoveTypeWeights.get(t);
        if (randInt <= weight + typeWeight) {
          type = t;
          break;
        }
        weight += typeWeight;
      }
      
      return new AttackTypeBoosterModifierType(type, 20);
    });
  }
}

class TmModifierTypeGenerator extends ModifierTypeGenerator {
  constructor(tier: ModifierTier) {
    super((party: Pokemon[]) => {
      const partyMemberCompatibleTms = party.map(p => (p as PlayerPokemon).compatibleTms);
      const tierUniqueCompatibleTms = partyMemberCompatibleTms.flat().filter(tm => tmPoolTiers[tm] === tier).filter(tm => !allMoves[tm].name.endsWith(' (N)')).filter((tm, i, array) => array.indexOf(tm) === i);
      if (!tierUniqueCompatibleTms.length)
        return null;
      const randTmIndex = Utils.randSeedInt(tierUniqueCompatibleTms.length);
      return new TmModifierType(tierUniqueCompatibleTms[randTmIndex]);
    });
  }
}

class EvolutionItemModifierTypeGenerator extends ModifierTypeGenerator {
  constructor() {
    super((party: Pokemon[], pregenArgs?: any[]) => {
      if (pregenArgs)
        return new EvolutionItemModifierType(pregenArgs[0] as EvolutionItem);

      const evolutionItemPool = party.filter(p => pokemonEvolutions.hasOwnProperty(p.species.speciesId)).map(p => {
        const evolutions = pokemonEvolutions[p.species.speciesId];
        return evolutions.filter(e => e.item !== EvolutionItem.NONE && (e.evoFormKey === null || (e.preFormKey || '') === p.getFormKey()) && (!e.condition || e.condition.predicate(p)));
      }).flat().flatMap(e => e.item);

      if (!evolutionItemPool.length)
        return null;

      return new EvolutionItemModifierType(evolutionItemPool[Utils.randSeedInt(evolutionItemPool.length)]);
    });
  }
}

class FormChangeItemModifierTypeGenerator extends ModifierTypeGenerator {
  constructor() {
    super((party: Pokemon[], pregenArgs?: any[]) => {
      if (pregenArgs)
        return new FormChangeItemModifierType(pregenArgs[0] as FormChangeItem);

      const formChangeItemPool = party.filter(p => pokemonFormChanges.hasOwnProperty(p.species.speciesId)).map(p => {
        const formChanges = pokemonFormChanges[p.species.speciesId];
        return formChanges.filter(fc => (fc.formKey.indexOf(SpeciesFormKey.MEGA) === -1 && fc.formKey.indexOf(SpeciesFormKey.PRIMAL) === -1) || party[0].scene.getModifiers(Modifiers.MegaEvolutionAccessModifier).length)
          .map(fc => fc.findTrigger(SpeciesFormChangeItemTrigger) as SpeciesFormChangeItemTrigger).filter(t => t && t.active);
      }).flat().flatMap(fc => fc.item);

      if (!formChangeItemPool.length)
        return null;

      return new FormChangeItemModifierType(formChangeItemPool[Utils.randSeedInt(formChangeItemPool.length)]);
    });
  }
}

export class ContactHeldItemTransferChanceModifierType extends PokemonHeldItemModifierType {
  constructor(name: string, chancePercent: integer, iconImage?: string, group?: string, soundName?: string) {
    super(name, `Upon attacking, there is a ${chancePercent}% chance the foe's held item will be stolen`, (type, args) => new Modifiers.ContactHeldItemTransferChanceModifier(type, (args[0] as Pokemon).id, chancePercent), iconImage, group, soundName);
  }
}

export class TurnHeldItemTransferModifierType extends PokemonHeldItemModifierType {
  constructor(name: string, iconImage?: string, group?: string, soundName?: string) {
    super(name, 'Every turn, the holder acquires one held item from the foe', (type, args) => new Modifiers.TurnHeldItemTransferModifier(type, (args[0] as Pokemon).id), iconImage, group, soundName);
  }
}

export class EnemyAttackStatusEffectChanceModifierType extends ModifierType {
  constructor(name: string, chancePercent: integer, effect: StatusEffect, iconImage?: string) {
    super(name, `Adds a ${chancePercent}% chance to inflict ${getStatusEffectDescriptor(effect)} with attack moves`, (type, args) => new Modifiers.EnemyAttackStatusEffectChanceModifier(type, effect, chancePercent), iconImage, 'enemy_status_chance')
  }
}

export class EnemyInstantReviveChanceModifierType extends ModifierType {
  constructor(name: string, chancePercent: number, fullHeal: boolean, iconImage?: string) {
    super(name, `Adds a ${chancePercent}% chance of reviving with ${fullHeal ? 100 : 50}% HP`, (type, _args) => new Modifiers.EnemyInstantReviveChanceModifier(type, fullHeal, chancePercent), iconImage, 'enemy_revive');
  }
}

export type ModifierTypeFunc = () => ModifierType;
type WeightedModifierTypeWeightFunc = (party: Pokemon[]) => integer;

class WeightedModifierType {
  public modifierType: ModifierType;
  public weight: integer | WeightedModifierTypeWeightFunc;

  constructor(modifierTypeFunc: ModifierTypeFunc, weight: integer | WeightedModifierTypeWeightFunc) {
    this.modifierType = modifierTypeFunc();
    this.modifierType.id = Object.keys(modifierTypes).find(k => modifierTypes[k] === modifierTypeFunc);
    this.weight = weight;
  }

  setTier(tier: ModifierTier) {
    this.modifierType.setTier(tier);
  }
}

export const modifierTypes = {
  POKEBALL: () => new AddPokeballModifierType(PokeballType.POKEBALL, 5, 'pb'),
  GREAT_BALL: () => new AddPokeballModifierType(PokeballType.GREAT_BALL, 5, 'gb'),
  ULTRA_BALL: () => new AddPokeballModifierType(PokeballType.ULTRA_BALL, 5, 'ub'),
  MASTER_BALL: () => new AddPokeballModifierType(PokeballType.MASTER_BALL, 1, 'mb'),

  RARE_CANDY: () => new PokemonLevelIncrementModifierType('Rare Candy'),
  RARER_CANDY: () => new AllPokemonLevelIncrementModifierType('Rarer Candy'),

  EVOLUTION_ITEM: () => new EvolutionItemModifierTypeGenerator(),
  FORM_CHANGE_ITEM: () => new FormChangeItemModifierTypeGenerator(),

  MEGA_BRACELET: () => new ModifierType('Mega Bracelet', 'Mega stones become available', (type, _args) => new Modifiers.MegaEvolutionAccessModifier(type)),

  MAP: () => new ModifierType('Map', 'Allows you to choose your destination at a crossroads', (type, _args) => new Modifiers.MapModifier(type)),

  POTION: () => new PokemonHpRestoreModifierType('Potion', 20, 10),
  SUPER_POTION: () => new PokemonHpRestoreModifierType('Super Potion', 50, 25),
  HYPER_POTION: () => new PokemonHpRestoreModifierType('Hyper Potion', 200, 50),
  MAX_POTION: () => new PokemonHpRestoreModifierType('Max Potion', 0, 100),
  FULL_RESTORE: () => new PokemonHpRestoreModifierType('Full Restore', 0, 100, true),
  
  REVIVE: () => new PokemonReviveModifierType('Revive', 50),
  MAX_REVIVE: () => new PokemonReviveModifierType('Max Revive', 100),

  FULL_HEAL: () => new PokemonStatusHealModifierType('Full Heal'),

  SACRED_ASH: () => new AllPokemonFullReviveModifierType('Sacred Ash'),

  REVIVER_SEED: () => new PokemonHeldItemModifierType('Reviver Seed', 'Revives the holder for 1/2 HP upon fainting',
    (type, args) => new Modifiers.PokemonInstantReviveModifier(type, (args[0] as Pokemon).id)),

  ETHER: () => new PokemonPpRestoreModifierType('Ether', 10),
  MAX_ETHER: () => new PokemonPpRestoreModifierType('Max Ether', -1),

  ELIXIR: () => new PokemonAllMovePpRestoreModifierType('Elixir', 10),
  MAX_ELIXIR: () => new PokemonAllMovePpRestoreModifierType('Max Elixir', -1),

  PP_UP: () => new PokemonPpUpModifierType('PP Up', 1),
  PP_MAX: () => new PokemonPpUpModifierType('PP Max', 3),

  LURE: () => new DoubleBattleChanceBoosterModifierType('Lure', 5),
  SUPER_LURE: () => new DoubleBattleChanceBoosterModifierType('Super Lure', 10),
  MAX_LURE: () => new DoubleBattleChanceBoosterModifierType('Max Lure', 25),

  TEMP_STAT_BOOSTER: () => new ModifierTypeGenerator((party: Pokemon[], pregenArgs?: any[]) => {
    if (pregenArgs)
      return new TempBattleStatBoosterModifierType(pregenArgs[0] as TempBattleStat);
    const randTempBattleStat = Utils.randSeedInt(7) as TempBattleStat;
    return new TempBattleStatBoosterModifierType(randTempBattleStat);
  }),

  BASE_STAT_BOOSTER: () => new ModifierTypeGenerator((party: Pokemon[], pregenArgs?: any[]) => {
    if (pregenArgs) {
      const stat = pregenArgs[0] as Stat;
      return new PokemonBaseStatBoosterModifierType(getBaseStatBoosterItemName(stat), stat);
    }
    const randStat = Utils.randSeedInt(6) as Stat;
    return new PokemonBaseStatBoosterModifierType(getBaseStatBoosterItemName(randStat), randStat);
  }),

  ATTACK_TYPE_BOOSTER: () => new AttackTypeBoosterModifierTypeGenerator(),

  BERRY: () => new ModifierTypeGenerator((party: Pokemon[], pregenArgs?: any[]) => {
    if (pregenArgs)
      return new BerryModifierType(pregenArgs[0] as BerryType);
    const berryTypes = Utils.getEnumValues(BerryType);
    let randBerryType: BerryType;
    let rand = Utils.randSeedInt(10);
    if (rand < 2)
      randBerryType = BerryType.SITRUS;
    else if (rand < 4)
      randBerryType = BerryType.LUM;
    else
      randBerryType = berryTypes[Utils.randSeedInt(berryTypes.length - 2) + 2];
    return new BerryModifierType(randBerryType);
  }),

  TM_COMMON: () => new TmModifierTypeGenerator(ModifierTier.COMMON),
  TM_GREAT: () => new TmModifierTypeGenerator(ModifierTier.GREAT),
  TM_ULTRA: () => new TmModifierTypeGenerator(ModifierTier.ULTRA),

  MEMORY_MUSHROOM: () => new RememberMoveModifierType('Memory Mushroom', 'Recall one Pokémon\'s forgotten move', 'big_mushroom'),

  EXP_SHARE: () => new ModifierType('EXP. All', 'Non-participants receive 20% of a single participant\'s EXP. Points',
    (type, _args) => new Modifiers.ExpShareModifier(type), 'exp_share'),
  EXP_BALANCE: () => new ModifierType('EXP. Balance', 'All EXP. Points received from battles are split between the lower leveled party members',
    (type, _args) => new Modifiers.ExpBalanceModifier(type)),

  OVAL_CHARM: () => new ModifierType('Oval Charm', 'When multiple Pokémon participate in a battle, each gets an extra 10% of the total EXP',
    (type, _args) => new Modifiers.MultipleParticipantExpBonusModifier(type)),

  EXP_CHARM: () => new ExpBoosterModifierType('EXP. Charm', 25),
  SUPER_EXP_CHARM: () => new ExpBoosterModifierType('Super EXP. Charm', 60),
  GOLDEN_EXP_CHARM: () => new ExpBoosterModifierType('Golden EXP. Charm', 100),

  LUCKY_EGG: () => new PokemonExpBoosterModifierType('Lucky Egg', 40),
  GOLDEN_EGG: () => new PokemonExpBoosterModifierType('Golden Egg', 100),

  SOOTHE_BELL: () => new PokemonFriendshipBoosterModifierType('Soothe Bell'),

  SOUL_DEW: () => new PokemonHeldItemModifierType('Soul Dew', 'Increases the influence of a Pokémon\'s nature on its stats by 5% (additive)', (type, args) => new Modifiers.PokemonNatureWeightModifier(type, (args[0] as Pokemon).id)),

  NUGGET: () => new MoneyRewardModifierType('Nugget', 1, 'small'),
  BIG_NUGGET: () => new MoneyRewardModifierType('Big Nugget', 2.5, 'moderate'),
  RELIC_GOLD: () => new MoneyRewardModifierType('Relic Gold', 10, 'large'),

  AMULET_COIN: () => new ModifierType('Amulet Coin', 'Increases money rewards by 20%', (type, _args) => new Modifiers.MoneyMultiplierModifier(type)),
  GOLDEN_PUNCH: () => new PokemonHeldItemModifierType('Golden Punch', 'Grants 20% of damage inflicted as money', (type, args) => new Modifiers.DamageMoneyRewardModifier(type, (args[0] as Pokemon).id)),
  COIN_CASE: () => new ModifierType('Coin Case', 'After every 10th battle, receive 10% of your money in interest', (type, _args) => new Modifiers.MoneyInterestModifier(type)),

  GRIP_CLAW: () => new ContactHeldItemTransferChanceModifierType('Grip Claw', 10),

  HEALING_CHARM: () => new ModifierType('Healing Charm', 'Increases the effectiveness of HP restoring moves and items by 25% (excludes revives)',
    (type, _args) => new Modifiers.HealingBoosterModifier(type, 1.25), 'healing_charm'),
  CANDY_JAR: () => new ModifierType('Candy Jar', 'Increases the number of levels added by Rare Candy items by 1', (type, _args) => new Modifiers.LevelIncrementBoosterModifier(type)),

  BERRY_POUCH: () => new ModifierType('Berry Pouch', 'Adds a 25% chance that a used berry will not be consumed',
    (type, _args) => new Modifiers.PreserveBerryModifier(type)),

  FOCUS_BAND: () => new PokemonHeldItemModifierType('Focus Band', 'Adds a 10% chance to survive with 1 HP after being damaged enough to faint',
    (type, args) => new Modifiers.SurviveDamageModifier(type, (args[0] as Pokemon).id)),

  KINGS_ROCK: () => new PokemonHeldItemModifierType('King\'s Rock', 'Adds a 10% chance an attack move will cause the opponent to flinch',
    (type, args) => new Modifiers.FlinchChanceModifier(type, (args[0] as Pokemon).id)),

  LEFTOVERS: () => new PokemonHeldItemModifierType('Leftovers', 'Heals 1/16 of a Pokémon\'s maximum HP every turn',
    (type, args) => new Modifiers.TurnHealModifier(type, (args[0] as Pokemon).id)),
  SHELL_BELL: () => new PokemonHeldItemModifierType('Shell Bell', 'Heals 1/8 of a Pokémon\'s dealt damage',
    (type, args) => new Modifiers.HitHealModifier(type, (args[0] as Pokemon).id)),

  BATON: () => new PokemonHeldItemModifierType('Baton', 'Allows passing along effects when switching Pokémon, which also bypasses traps',
    (type, args) => new Modifiers.SwitchEffectTransferModifier(type, (args[0] as Pokemon).id), 'stick'),

  SHINY_CHARM: () => new ModifierType('Shiny Charm', 'Dramatically increases the chance of a wild Pokémon being shiny', (type, _args) => new Modifiers.ShinyRateBoosterModifier(type)),
  ABILITY_CHARM: () => new ModifierType('Ability Charm', 'Dramatically increases the chance of a wild Pokémon having a hidden ability', (type, _args) => new Modifiers.HiddenAbilityRateBoosterModifier(type)),

  IV_SCANNER: () => new ModifierType('IV Scanner', 'Allows scanning the IVs of wild Pokémon', (type, _args) => new Modifiers.IvScannerModifier(type), 'scanner'),

  DNA_SPLICERS: () => new FusePokemonModifierType('DNA Splicers'),
  REVERSE_DNA_SPLICERS: () => new UnfusePokemonModifierType('Reverse DNA Splicers', 'dna_splicers'),

  MINI_BLACK_HOLE: () => new TurnHeldItemTransferModifierType('Mini Black Hole'),
  
  VOUCHER: () => new AddVoucherModifierType(VoucherType.REGULAR, 1),
  VOUCHER_PLUS: () => new AddVoucherModifierType(VoucherType.PLUS, 1),
  VOUCHER_PREMIUM: () => new AddVoucherModifierType(VoucherType.PREMIUM, 1),

  GOLDEN_POKEBALL: () => new ModifierType(`Golden ${getPokeballName(PokeballType.POKEBALL)}`, 'Adds 1 extra item option at the end of every battle',
    (type, _args) => new Modifiers.ExtraModifierModifier(type), 'pb_gold', null, 'pb_bounce_1'),

  ENEMY_DAMAGE_BOOSTER: () => new ModifierType('Damage Token', 'Increases damage by 20%', (type, _args) => new Modifiers.EnemyDamageBoosterModifier(type, 20), 'wl_item_drop'),
  ENEMY_DAMAGE_REDUCTION: () => new ModifierType('Protection Token', 'Reduces incoming damage by 10%', (type, _args) => new Modifiers.EnemyDamageReducerModifier(type, 10), 'wl_guard_spec'),
  //ENEMY_SUPER_EFFECT_BOOSTER: () => new ModifierType('Type Advantage Token', 'Increases damage of super effective attacks by 30%', (type, _args) => new Modifiers.EnemySuperEffectiveDamageBoosterModifier(type, 30), 'wl_custom_super_effective'),
  ENEMY_HEAL: () => new ModifierType('Recovery Token', 'Heals 5% of max HP every turn', (type, _args) => new Modifiers.EnemyTurnHealModifier(type, 10), 'wl_potion'),
  ENEMY_ATTACK_POISON_CHANCE: () => new EnemyAttackStatusEffectChanceModifierType('Poison Token', 10, StatusEffect.POISON, 'wl_antidote'),
  ENEMY_ATTACK_PARALYZE_CHANCE: () => new EnemyAttackStatusEffectChanceModifierType('Paralyze Token', 10, StatusEffect.PARALYSIS, 'wl_paralyze_heal'),
  ENEMY_ATTACK_SLEEP_CHANCE: () => new EnemyAttackStatusEffectChanceModifierType('Sleep Token', 10, StatusEffect.SLEEP, 'wl_awakening'),
  ENEMY_ATTACK_FREEZE_CHANCE: () => new EnemyAttackStatusEffectChanceModifierType('Freeze Token', 10, StatusEffect.FREEZE, 'wl_ice_heal'),
  ENEMY_ATTACK_BURN_CHANCE: () => new EnemyAttackStatusEffectChanceModifierType('Burn Token', 10, StatusEffect.BURN, 'wl_burn_heal'),
  ENEMY_STATUS_EFFECT_HEAL_CHANCE: () => new ModifierType('Full Heal Token', 'Adds a 10% chance every turn to heal a status condition', (type, _args) => new Modifiers.EnemyStatusEffectHealChanceModifier(type, 10), 'wl_full_heal'),
  ENEMY_INSTANT_REVIVE_CHANCE: () => new EnemyInstantReviveChanceModifierType('Revive Token', 5, false, 'wl_revive'),
  ENEMY_INSTANT_MAX_REVIVE_CHANCE: () => new EnemyInstantReviveChanceModifierType('Max Revive Token', 2, true, 'wl_max_revive'),
};

const modifierPool = {
  [ModifierTier.COMMON]: [
    new WeightedModifierType(modifierTypes.POKEBALL, 6),
    new WeightedModifierType(modifierTypes.RARE_CANDY, 2),
    new WeightedModifierType(modifierTypes.POTION, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.getInverseHp() >= 10 || p.getHpRatio() <= 0.875).length, 3);
      return thresholdPartyMemberCount * 3;
    }),
    new WeightedModifierType(modifierTypes.SUPER_POTION, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.getInverseHp() >= 25 || p.getHpRatio() <= 0.75).length, 3);
      return thresholdPartyMemberCount;
    }),
    new WeightedModifierType(modifierTypes.ETHER, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.hp && p.getMoveset().filter(m => (m.getMove().pp - m.ppUsed) <= 5).length).length, 3);
      return thresholdPartyMemberCount * 3;
    }),
    new WeightedModifierType(modifierTypes.MAX_ETHER, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.hp && p.getMoveset().filter(m => (m.getMove().pp - m.ppUsed) <= 5).length).length, 3);
      return thresholdPartyMemberCount;
    }),
    new WeightedModifierType(modifierTypes.LURE, 2),
    new WeightedModifierType(modifierTypes.TEMP_STAT_BOOSTER, 4),
    new WeightedModifierType(modifierTypes.BERRY, 2),
    new WeightedModifierType(modifierTypes.TM_COMMON, 1),
  ].map(m => { m.setTier(ModifierTier.COMMON); return m; }),
  [ModifierTier.GREAT]: [
    new WeightedModifierType(modifierTypes.GREAT_BALL, 6),
    new WeightedModifierType(modifierTypes.EVOLUTION_ITEM, 2),
    new WeightedModifierType(modifierTypes.FULL_HEAL, (party: Pokemon[]) => {
      const statusEffectPartyMemberCount = Math.min(party.filter(p => p.hp && !!p.status).length, 3);
      return statusEffectPartyMemberCount * 6;
    }),
    new WeightedModifierType(modifierTypes.REVIVE, (party: Pokemon[]) => {
      const faintedPartyMemberCount = Math.min(party.filter(p => p.isFainted()).length, 3);
      return faintedPartyMemberCount * 9;
    }),
    new WeightedModifierType(modifierTypes.MAX_REVIVE, (party: Pokemon[]) => {
      const faintedPartyMemberCount = Math.min(party.filter(p => p.isFainted()).length, 3);
      return faintedPartyMemberCount * 3;
    }),
    new WeightedModifierType(modifierTypes.SACRED_ASH, (party: Pokemon[]) => {
      return party.filter(p => p.isFainted()).length >= Math.ceil(party.length / 2) ? 1 : 0;
    }),
    new WeightedModifierType(modifierTypes.HYPER_POTION, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.getInverseHp() >= 100 || p.getHpRatio() <= 0.625).length, 3);
      return thresholdPartyMemberCount * 3;
    }),
    new WeightedModifierType(modifierTypes.MAX_POTION, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.getInverseHp() >= 150 || p.getHpRatio() <= 0.5).length, 3);
      return thresholdPartyMemberCount;
    }),
    new WeightedModifierType(modifierTypes.FULL_RESTORE, (party: Pokemon[]) => {
      const statusEffectPartyMemberCount = Math.min(party.filter(p => p.hp && !!p.status).length, 3);
      const thresholdPartyMemberCount = Math.floor((Math.min(party.filter(p => p.getInverseHp() >= 150 || p.getHpRatio() <= 0.5).length, 3) + statusEffectPartyMemberCount) / 2);
      return thresholdPartyMemberCount;
    }),
    new WeightedModifierType(modifierTypes.ELIXIR, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.hp && p.getMoveset().filter(m => (m.getMove().pp - m.ppUsed) <= 5).length).length, 3);
      return thresholdPartyMemberCount * 3;
    }),
    new WeightedModifierType(modifierTypes.MAX_ELIXIR, (party: Pokemon[]) => {
      const thresholdPartyMemberCount = Math.min(party.filter(p => p.hp && p.getMoveset().filter(m => (m.getMove().pp - m.ppUsed) <= 5).length).length, 3);
      return thresholdPartyMemberCount;
    }),
    new WeightedModifierType(modifierTypes.SUPER_LURE, 4),
    new WeightedModifierType(modifierTypes.NUGGET, 5),
    new WeightedModifierType(modifierTypes.BIG_NUGGET, 1),
    new WeightedModifierType(modifierTypes.MAP, (party: Pokemon[]) => party[0].scene.gameMode === GameMode.CLASSIC ? 1 : 0),
    new WeightedModifierType(modifierTypes.TM_GREAT, 2),
    new WeightedModifierType(modifierTypes.EXP_SHARE, 1),
    new WeightedModifierType(modifierTypes.AMULET_COIN, 1),
    new WeightedModifierType(modifierTypes.EXP_CHARM, 2),
    new WeightedModifierType(modifierTypes.BASE_STAT_BOOSTER, 3),
    new WeightedModifierType(modifierTypes.DNA_SPLICERS, (party: Pokemon[]) => party[0].scene.gameMode === GameMode.SPLICED_ENDLESS && party.filter(p => !p.fusionSpecies).length > 1 ? 4 : 0),
    new WeightedModifierType(modifierTypes.REVERSE_DNA_SPLICERS, (party: Pokemon[]) => party[0].scene.gameMode === GameMode.SPLICED_ENDLESS && party.filter(p => p.fusionSpecies).length ? 6 : 0),
  ].map(m => { m.setTier(ModifierTier.GREAT); return m; }),
  [ModifierTier.ULTRA]: [
    new WeightedModifierType(modifierTypes.ULTRA_BALL, 8),
    new WeightedModifierType(modifierTypes.MAX_LURE, 4),
    new WeightedModifierType(modifierTypes.RELIC_GOLD, 3),
    new WeightedModifierType(modifierTypes.PP_UP, 6),
    new WeightedModifierType(modifierTypes.PP_MAX, 2),
    new WeightedModifierType(modifierTypes.ATTACK_TYPE_BOOSTER, 4),
    new WeightedModifierType(modifierTypes.TM_ULTRA, 5),
    new WeightedModifierType(modifierTypes.MEMORY_MUSHROOM, (party: Pokemon[]) => party.filter(p => p.getLearnableLevelMoves().length).length ? 4 : 0),
    new WeightedModifierType(modifierTypes.REVIVER_SEED, 3),
    new WeightedModifierType(modifierTypes.CANDY_JAR, 3),
    new WeightedModifierType(modifierTypes.RARER_CANDY, 3),
    new WeightedModifierType(modifierTypes.SOOTHE_BELL, (party: Pokemon[]) => {
      const friendshipBenefitPartyMemberCount = Math.min(party.filter(p => (pokemonEvolutions.hasOwnProperty(p.species.speciesId) && pokemonEvolutions[p.species.speciesId].find(e => e.condition && e.condition instanceof SpeciesFriendshipEvolutionCondition)) || p.moveset.find(m => m.moveId === Moves.RETURN)).length, 3);
      return friendshipBenefitPartyMemberCount * 3;
    }),
    new WeightedModifierType(modifierTypes.SOUL_DEW, 3),
    new WeightedModifierType(modifierTypes.GOLDEN_PUNCH, 2),
    new WeightedModifierType(modifierTypes.GRIP_CLAW, 2),
    new WeightedModifierType(modifierTypes.HEALING_CHARM, 1),
    new WeightedModifierType(modifierTypes.BATON, 1),
    new WeightedModifierType(modifierTypes.FOCUS_BAND, 3),
    new WeightedModifierType(modifierTypes.KINGS_ROCK, 2),
    new WeightedModifierType(modifierTypes.LEFTOVERS, 2),
    new WeightedModifierType(modifierTypes.SHELL_BELL, 2),
    new WeightedModifierType(modifierTypes.BERRY_POUCH, 3),
    new WeightedModifierType(modifierTypes.SUPER_EXP_CHARM, 3),
    new WeightedModifierType(modifierTypes.OVAL_CHARM, 2),
    new WeightedModifierType(modifierTypes.ABILITY_CHARM, 2),
    new WeightedModifierType(modifierTypes.IV_SCANNER, 2),
    new WeightedModifierType(modifierTypes.EXP_BALANCE, 1),
    new WeightedModifierType(modifierTypes.FORM_CHANGE_ITEM, 1),
    new WeightedModifierType(modifierTypes.REVERSE_DNA_SPLICERS, (party: Pokemon[]) => party[0].scene.gameMode !== GameMode.SPLICED_ENDLESS && party.filter(p => p.fusionSpecies).length ? 3 : 0),
  ].map(m => { m.setTier(ModifierTier.ULTRA); return m; }),
  [ModifierTier.MASTER]: [
    new WeightedModifierType(modifierTypes.MASTER_BALL, 32),
    new WeightedModifierType(modifierTypes.SHINY_CHARM, 18),
    new WeightedModifierType(modifierTypes.MEGA_BRACELET, 12),
    new WeightedModifierType(modifierTypes.VOUCHER, 6),
    new WeightedModifierType(modifierTypes.VOUCHER_PLUS, 1),
    new WeightedModifierType(modifierTypes.DNA_SPLICERS, (party: Pokemon[]) => party[0].scene.gameMode !== GameMode.SPLICED_ENDLESS && party.filter(p => !p.fusionSpecies).length > 1 ? 12 : 0),
    new WeightedModifierType(modifierTypes.MINI_BLACK_HOLE, (party: Pokemon[]) => party[0].scene.gameData.unlocks[Unlockables.MINI_BLACK_HOLE] ? 2 : 0),
  ].map(m => { m.setTier(ModifierTier.MASTER); return m; }),
  [ModifierTier.LUXURY]: [
    new WeightedModifierType(modifierTypes.GOLDEN_EXP_CHARM, 1),
    new WeightedModifierType(modifierTypes.GOLDEN_POKEBALL, 1),
    new WeightedModifierType(modifierTypes.RARER_CANDY, 1),
  ].map(m => { m.setTier(ModifierTier.LUXURY); return m; }),
};

const wildModifierPool = {
  [ModifierTier.COMMON]: [
    new WeightedModifierType(modifierTypes.BERRY, 1)
  ].map(m => { m.setTier(ModifierTier.COMMON); return m; }),
  [ModifierTier.GREAT]: [
    new WeightedModifierType(modifierTypes.BASE_STAT_BOOSTER, 1)
  ].map(m => { m.setTier(ModifierTier.GREAT); return m; }),
  [ModifierTier.ULTRA]: [
    new WeightedModifierType(modifierTypes.ATTACK_TYPE_BOOSTER, 10),
    new WeightedModifierType(modifierTypes.LUCKY_EGG, 4),
  ].map(m => { m.setTier(ModifierTier.ULTRA); return m; }),
  [ModifierTier.MASTER]: [
    new WeightedModifierType(modifierTypes.GOLDEN_EGG, 1)
  ].map(m => { m.setTier(ModifierTier.MASTER); return m; })
};

const trainerModifierPool = {
  [ModifierTier.COMMON]: [
    new WeightedModifierType(modifierTypes.BERRY, 8),
    new WeightedModifierType(modifierTypes.BASE_STAT_BOOSTER, 3)
  ].map(m => { m.setTier(ModifierTier.COMMON); return m; }),
  [ModifierTier.GREAT]: [
    new WeightedModifierType(modifierTypes.BASE_STAT_BOOSTER, 3),
    new WeightedModifierType(modifierTypes.ATTACK_TYPE_BOOSTER, 1),
  ].map(m => { m.setTier(ModifierTier.GREAT); return m; }),
  [ModifierTier.ULTRA]: [
    new WeightedModifierType(modifierTypes.REVIVER_SEED, 2),
    new WeightedModifierType(modifierTypes.FOCUS_BAND, 2),
    new WeightedModifierType(modifierTypes.LUCKY_EGG, 4),
    new WeightedModifierType(modifierTypes.GRIP_CLAW, 1),
    new WeightedModifierType(modifierTypes.KINGS_ROCK, 1),
    new WeightedModifierType(modifierTypes.LEFTOVERS, 1),
    new WeightedModifierType(modifierTypes.SHELL_BELL, 1),
  ].map(m => { m.setTier(ModifierTier.ULTRA); return m; }),
  [ModifierTier.MASTER]: [
    new WeightedModifierType(modifierTypes.GOLDEN_EGG, 1),
  ].map(m => { m.setTier(ModifierTier.MASTER); return m; })
};

const enemyBuffModifierPool = {
  [ModifierTier.COMMON]: [
    new WeightedModifierType(modifierTypes.ENEMY_DAMAGE_BOOSTER, 5),
    new WeightedModifierType(modifierTypes.ENEMY_DAMAGE_REDUCTION, 5),
    new WeightedModifierType(modifierTypes.ENEMY_HEAL, 5),
    new WeightedModifierType(modifierTypes.ENEMY_ATTACK_POISON_CHANCE, 1),
    new WeightedModifierType(modifierTypes.ENEMY_ATTACK_PARALYZE_CHANCE, 1),
    new WeightedModifierType(modifierTypes.ENEMY_ATTACK_SLEEP_CHANCE, 1),
    new WeightedModifierType(modifierTypes.ENEMY_ATTACK_FREEZE_CHANCE, 1),
    new WeightedModifierType(modifierTypes.ENEMY_ATTACK_BURN_CHANCE, 1),
    new WeightedModifierType(modifierTypes.ENEMY_STATUS_EFFECT_HEAL_CHANCE, 5),
    new WeightedModifierType(modifierTypes.ENEMY_INSTANT_REVIVE_CHANCE, 5),
    new WeightedModifierType(modifierTypes.ENEMY_INSTANT_MAX_REVIVE_CHANCE, 3)
  ].map(m => { m.setTier(ModifierTier.COMMON); return m; }),
  [ModifierTier.GREAT]: [
    new WeightedModifierType(modifierTypes.ENEMY_DAMAGE_BOOSTER, 5),
    new WeightedModifierType(modifierTypes.ENEMY_DAMAGE_REDUCTION, 5),
    new WeightedModifierType(modifierTypes.ENEMY_HEAL, 5),
    new WeightedModifierType(modifierTypes.ENEMY_STATUS_EFFECT_HEAL_CHANCE, 5),
    new WeightedModifierType(modifierTypes.ENEMY_INSTANT_REVIVE_CHANCE, 5),
    new WeightedModifierType(modifierTypes.ENEMY_INSTANT_MAX_REVIVE_CHANCE, 3)
  ].map(m => { m.setTier(ModifierTier.GREAT); return m; }),
  [ModifierTier.ULTRA]: [
    new WeightedModifierType(modifierTypes.ENEMY_DAMAGE_BOOSTER, 5),
    new WeightedModifierType(modifierTypes.ENEMY_DAMAGE_REDUCTION, 5),
    new WeightedModifierType(modifierTypes.ENEMY_HEAL, 5),
    new WeightedModifierType(modifierTypes.ENEMY_STATUS_EFFECT_HEAL_CHANCE, 5),
    new WeightedModifierType(modifierTypes.ENEMY_INSTANT_REVIVE_CHANCE, 5),
    new WeightedModifierType(modifierTypes.ENEMY_INSTANT_MAX_REVIVE_CHANCE, 3)
  ].map(m => { m.setTier(ModifierTier.ULTRA); return m; }),
  [ModifierTier.MASTER]: [ ].map(m => { m.setTier(ModifierTier.MASTER); return m; })
};

export function getModifierType(modifierTypeFunc: ModifierTypeFunc): ModifierType {
  const modifierType = modifierTypeFunc();
  if (!modifierType.id)
    modifierType.id = Object.keys(modifierTypes).find(k => modifierTypes[k] === modifierTypeFunc);
  return modifierType;
}

let modifierPoolThresholds = {};
let ignoredPoolIndexes = {};

let enemyModifierPoolThresholds = {};
let enemyIgnoredPoolIndexes = {};

let enemyBuffModifierPoolThresholds = {};
let enemyBuffIgnoredPoolIndexes = {};

export function regenerateModifierPoolThresholds(party: Pokemon[], poolType: ModifierPoolType) {
  const player = !poolType;
  const pool = player ? modifierPool : poolType === ModifierPoolType.WILD ? wildModifierPool : poolType === ModifierPoolType.TRAINER ? trainerModifierPool : enemyBuffModifierPool;
  const ignoredIndexes = {};
  const thresholds = Object.fromEntries(new Map(Object.keys(pool).map(t => {
    ignoredIndexes[t] = [];
    const thresholds = new Map();
    let i = 0;
    pool[t].reduce((total: integer, modifierType: WeightedModifierType) => {
      const weightedModifierType = modifierType as WeightedModifierType;
      const existingModifiers = party[0].scene.findModifiers(m => (m.type.generatorId || m.type.id) === weightedModifierType.modifierType.id, player);
      const weight = !existingModifiers.length || existingModifiers.filter(m => m.stackCount < m.getMaxStackCount(party[0].scene, true)).length
        ? weightedModifierType.weight instanceof Function
          ? (weightedModifierType.weight as Function)(party)
          : weightedModifierType.weight as integer
        : 0;
      if (weight)
        total += weight;
      else {
        ignoredIndexes[t].push(i++);
        return total;
      }
      thresholds.set(total, i++);
      return total;
    }, 0);
    return [ t, Object.fromEntries(thresholds) ]
  })));
  if (player) {
    modifierPoolThresholds = thresholds;
    ignoredPoolIndexes = ignoredIndexes;
  } else if (poolType !== ModifierPoolType.ENEMY_BUFF) {
    enemyModifierPoolThresholds = thresholds;
    enemyIgnoredPoolIndexes = ignoredIndexes;
  } else {
    enemyBuffModifierPoolThresholds = thresholds;
    enemyBuffIgnoredPoolIndexes = ignoredIndexes;
  }
}

export function getModifierTypeFuncById(id: string): ModifierTypeFunc {
  return modifierTypes[id];
}

export function getPlayerModifierTypeOptionsForWave(waveIndex: integer, count: integer, party: PlayerPokemon[]): ModifierTypeOption[] {
  if (waveIndex % 10 === 0)
    return modifierPool[ModifierTier.LUXURY].filter(m => !(m.weight instanceof Function) || m.weight(party)).map(m => new ModifierTypeOption(m.modifierType, false));
  const options: ModifierTypeOption[] = [];
  const retryCount = Math.min(count * 5, 50);
  new Array(count).fill(0).map(() => {
    let candidate = getNewModifierTypeOption(party, ModifierPoolType.PLAYER);
    let r = 0;
    while (options.length && ++r < retryCount && options.filter(o => o.type.name === candidate.type.name || o.type.group === candidate.type.group).length)
      candidate = getNewModifierTypeOption(party, ModifierPoolType.PLAYER, candidate.type.tier, candidate.upgraded);
    options.push(candidate);
  });
  return options;
}

export function getPlayerShopModifierTypeOptionsForWave(waveIndex: integer, baseCost: integer): ModifierTypeOption[] {
  if (!(waveIndex % 10))
    return [];

  const options = [
    [
      new ModifierTypeOption(modifierTypes.POTION(), false, baseCost * 0.1),
      new ModifierTypeOption(modifierTypes.ETHER(), false, baseCost * 0.2),
      new ModifierTypeOption(modifierTypes.REVIVE(), false, baseCost)
    ],
    [
      new ModifierTypeOption(modifierTypes.SUPER_POTION(), false, baseCost * 0.225),
      new ModifierTypeOption(modifierTypes.ELIXIR(), false, baseCost * 0.5)
    ],
    [
      new ModifierTypeOption(modifierTypes.FULL_HEAL(), false, baseCost * 0.5),
      new ModifierTypeOption(modifierTypes.MAX_ETHER(), false, baseCost * 0.5)
    ],
    [
      new ModifierTypeOption(modifierTypes.HYPER_POTION(), false, baseCost * 0.4),
      new ModifierTypeOption(modifierTypes.MAX_REVIVE(), false, baseCost * 1.375)
    ],
    [
      new ModifierTypeOption(modifierTypes.MAX_POTION(), false, baseCost * 0.75),
      new ModifierTypeOption(modifierTypes.MAX_ELIXIR(), false, baseCost * 1.25)
    ],
    [
      new ModifierTypeOption(modifierTypes.FULL_RESTORE(), false, baseCost * 1.125)
    ],
    [
      new ModifierTypeOption(modifierTypes.SACRED_ASH(), false, baseCost * 6)
    ]
  ];
  return options.slice(0, Math.ceil(Math.max(waveIndex + 10, 0) / 30)).flat();
}

export function getEnemyBuffModifierForWave(tier: ModifierTier, enemyModifiers: Modifiers.PersistentModifier[], scene: BattleScene): Modifiers.EnemyPersistentModifier {
  const tierStackCount = tier === ModifierTier.ULTRA ? 10 : tier === ModifierTier.GREAT ? 5 : 1;
  const retryCount = 50;
  let candidate = getNewModifierTypeOption(null, ModifierPoolType.ENEMY_BUFF, tier);
  let r = 0;
  let matchingModifier: Modifiers.PersistentModifier;
  while (++r < retryCount && (matchingModifier = enemyModifiers.find(m => m.type.id === candidate.type.id)) && matchingModifier.getMaxStackCount(scene) < matchingModifier.stackCount + (r < 10 ? tierStackCount : 1))
    candidate = getNewModifierTypeOption(null, ModifierPoolType.ENEMY_BUFF, tier);

  const modifier = candidate.type.newModifier() as Modifiers.EnemyPersistentModifier;
  modifier.stackCount = tierStackCount;

  return modifier;
}

export function getEnemyModifierTypesForWave(waveIndex: integer, count: integer, party: EnemyPokemon[], poolType: ModifierPoolType.WILD | ModifierPoolType.TRAINER, gameMode: GameMode): PokemonHeldItemModifierType[] {
  const ret = new Array(count).fill(0).map(() => getNewModifierTypeOption(party, poolType).type as PokemonHeldItemModifierType);
  if (!(waveIndex % 1000))
    ret.push(getModifierType(modifierTypes.MINI_BLACK_HOLE) as PokemonHeldItemModifierType);
  return ret;
}

function getNewModifierTypeOption(party: Pokemon[], poolType: ModifierPoolType, tier?: ModifierTier, upgrade?: boolean): ModifierTypeOption {
  const player = !poolType;
  const pool = player ? modifierPool : poolType === ModifierPoolType.WILD ? wildModifierPool : poolType === ModifierPoolType.TRAINER ? trainerModifierPool : enemyBuffModifierPool;
  if (tier === undefined) {
    const tierValue = Utils.randSeedInt(256);
    if (player && tierValue) {
      const partyShinyCount = party.filter(p => p.isShiny() && !p.isFainted()).length;
      const upgradeOdds = Math.floor(32 / Math.max((partyShinyCount * 2), 1));
      upgrade = !Utils.randSeedInt(upgradeOdds);
    } else
      upgrade = false;
    tier = (tierValue >= 52 ? ModifierTier.COMMON : tierValue >= 8 ? ModifierTier.GREAT : tierValue >= 1 ? ModifierTier.ULTRA : ModifierTier.MASTER) + (upgrade ? 1 : 0);
    while (tier && !modifierPool[tier].length)
      tier--;
  }
  
  const thresholds = player ? modifierPoolThresholds : pool !== enemyBuffModifierPool ? enemyModifierPoolThresholds : enemyBuffModifierPoolThresholds;
  const tierThresholds = Object.keys(thresholds[tier]);
  const totalWeight = parseInt(tierThresholds[tierThresholds.length - 1]);
  const value = Utils.randSeedInt(totalWeight);
  let index: integer;
  for (let t of tierThresholds) {
    let threshold = parseInt(t);
    if (value < threshold) {
      index = thresholds[tier][threshold];
      break;
    }
  }
  
  if (player)
    console.log(index, ignoredPoolIndexes[tier].filter(i => i <= index).length, ignoredPoolIndexes[tier])
  let modifierType: ModifierType = (pool[tier][index]).modifierType;
  if (modifierType instanceof ModifierTypeGenerator) {
    modifierType = (modifierType as ModifierTypeGenerator).generateType(party);
    if (modifierType === null) {
      if (player)
        console.log(ModifierTier[tier], upgrade);
      return getNewModifierTypeOption(party, poolType, tier, upgrade);
    }
  }

  console.log(modifierType, !player ? '(enemy)' : '');

  return new ModifierTypeOption(modifierType as ModifierType, upgrade);
}

export function getDefaultModifierTypeForTier(tier: ModifierTier): ModifierType {
  let modifierType: ModifierType | WeightedModifierType = modifierPool[tier || ModifierTier.COMMON][tier !== ModifierTier.LUXURY ? 0 : 2];
  if (modifierType instanceof WeightedModifierType)
    modifierType = (modifierType as WeightedModifierType).modifierType;
  return modifierType;
}

export class ModifierTypeOption {
  public type: ModifierType;
  public upgraded: boolean;
  public cost: integer;

  constructor(type: ModifierType, upgraded: boolean, cost: number = 0) {
    this.type = type;
    this.upgraded = upgraded;
    this.cost = Math.round(cost);
  }
}