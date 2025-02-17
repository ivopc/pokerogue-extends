//  public (.*?): integer;
//    this.$1 = source?.$1 || 0;

export class GameStats {
  public playTime: integer;
  public battles: integer;
  public classicSessionsPlayed: integer;
  public sessionsWon: integer;
  public endlessSessionsPlayed: integer;
  public highestEndlessWave: integer;
  public highestLevel: integer;
  public highestMoney: integer;
  public pokemonSeen: integer;
  public pokemonDefeated: integer;
  public pokemonCaught: integer;
  public pokemonHatched: integer;
  public legendaryPokemonSeen: integer;
  public legendaryPokemonCaught: integer;
  public legendaryPokemonHatched: integer;
  public mythicalPokemonSeen: integer;
  public mythicalPokemonCaught: integer;
  public mythicalPokemonHatched: integer;
  public shinyPokemonSeen: integer;
  public shinyPokemonCaught: integer;
  public shinyPokemonHatched: integer;
  public pokemonFused: integer;
  public trainersDefeated: integer;
  public eggsPulled: integer;
  public rareEggsPulled: integer;
  public epicEggsPulled: integer;
  public legendaryEggsPulled: integer;
  public manaphyEggsPulled: integer;

  constructor(source?: any) {
    this.playTime = source?.playTime || 0;
    this.battles = source?.battles || 0;
    this.classicSessionsPlayed = source?.classicSessionsPlayed || 0;
    this.sessionsWon = source?.sessionsWon || 0;
    this.endlessSessionsPlayed = source?.endlessSessionsPlayed || 0;
    this.highestEndlessWave = source?.highestEndlessWave || 0;
    this.highestLevel = source?.highestLevel || 0;
    this.highestMoney = source?.highestMoney || 0;
    this.pokemonSeen = source?.pokemonSeen || 0;
    this.pokemonDefeated = source?.pokemonDefeated || 0;
    this.pokemonCaught = source?.pokemonCaught || 0;
    this.pokemonHatched = source?.pokemonHatched || 0;
    this.legendaryPokemonSeen = source?.legendaryPokemonSeen || 0;
    this.legendaryPokemonCaught = source?.legendaryPokemonCaught || 0;
    this.legendaryPokemonHatched = source?.legendaryPokemonHatched || 0;
    this.mythicalPokemonSeen = source?.mythicalPokemonSeen || 0;
    this.mythicalPokemonCaught = source?.mythicalPokemonCaught || 0;
    this.mythicalPokemonHatched = source?.mythicalPokemonCaught || 0;
    this.shinyPokemonSeen = source?.shinyPokemonSeen || 0;
    this.shinyPokemonCaught = source?.shinyPokemonCaught || 0;
    this.shinyPokemonHatched = source?.shinyPokemonHatched || 0;
    this.pokemonFused = source?.pokemonFused || 0;
    this.trainersDefeated = source?.trainersDefeated || 0;
    this.eggsPulled = source?.eggsPulled || 0;
    this.rareEggsPulled = source?.rareEggsPulled || 0;
    this.epicEggsPulled = source?.epicEggsPulled || 0;
    this.legendaryEggsPulled = source?.legendaryEggsPulled || 0;
    this.manaphyEggsPulled = source?.manaphyEggsPulled || 0;
  }
}
