/**
 * R Squared Points — the house card-game tally, as recorded.
 *
 * This file is the source of truth, kept in the shape the results are actually
 * written down in: one night, one game, then a line per round saying who took
 * it. `npm run db:seed:games` reads it and writes the standings, so adding a
 * night means adding an entry here and re-running that — never editing totals
 * by hand.
 *
 * A round listing two names is a tie or a team win. Either way it is one point
 * each, which is how the house counts it.
 *
 * Losses are not recorded. Only the winner of each round is written down, so
 * for Cambio there is no way to know who else was even at the table — which is
 * why the standings show points and share of rounds rather than a win/loss
 * record. Chinese Poker is the exception: its rounds name the losing side too,
 * kept below in `against` so the information is not thrown away.
 */

export type Round = {
  /** Who took the round. Two names means a point each. */
  won: string[];
  /** Who they beat, where it was recorded. Chinese Poker only, so far. */
  against?: string[];
};

export type Sitting = {
  /** Slug of the game, matching `games` below. */
  game: string;
  /** `YYYY-MM-DD`, the night it was played. */
  playedOn: string;
  /** Separates two sittings of one game on the same date. */
  ordinal?: number;
  note?: string;
  rounds: Round[];
};

export const games = [
  {
    slug: "cambio",
    name: "Cambio",
    description: "The house default. Played most nights, in long numbered rounds.",
    sortOrder: 0,
  },
  {
    slug: "chinese-poker",
    name: "Chinese Poker",
    description: "Played in teams that change hand to hand, so the sides are listed per round.",
    sortOrder: 1,
  },
];

/**
 * Who the first names in the rounds above refer to.
 *
 * Every player is a person in the house directory, keyed by their handle. The
 * results are written down using the names people are called at the table, so
 * this is where "Manny" is resolved to Manuel Ponce — the standings then show
 * whatever the directory calls them.
 *
 * All six are residents.
 */
export const players = [
  { slug: "lana", username: "lana" },
  { slug: "chris", username: "chris-tang" },
  { slug: "manny", username: "manuel-ponce" },
  { slug: "jun", username: "jun-lee" },
  { slug: "gavin", username: "gavin-firestone" },
  { slug: "nolan", username: "nolan-connolly" },
];

export const sittings: Sitting[] = [
  {
    game: "cambio",
    playedOn: "2026-07-14",
    rounds: [
      { won: ["lana"] },
      { won: ["chris"] },
      { won: ["manny"] },
      { won: ["manny"] },
      { won: ["jun"] },
      { won: ["lana"] },
      { won: ["chris"] },
      { won: ["manny"] },
      { won: ["manny"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["manny"] },
    ],
  },
  {
    game: "cambio",
    playedOn: "2026-07-15",
    ordinal: 1,
    note: "First sitting of the night, before Chinese Poker.",
    rounds: [{ won: ["chris"] }, { won: ["manny"] }, { won: ["chris"] }, { won: ["lana"] }],
  },
  {
    game: "chinese-poker",
    playedOn: "2026-07-15",
    rounds: [
      { won: ["lana", "chris"], against: ["manny", "gavin"] },
      { won: ["chris"], against: ["manny", "lana"] },
      { won: ["manny", "chris"], against: ["lana"] },
      { won: ["manny"], against: ["chris", "lana"] },
      { won: ["manny", "lana"], against: ["chris"] },
      { won: ["lana", "jun"], against: ["manny", "chris"] },
      { won: ["jun", "manny"], against: ["lana", "chris"] },
      { won: ["jun", "lana"], against: ["manny", "chris"] },
    ],
  },
  {
    game: "cambio",
    playedOn: "2026-07-15",
    ordinal: 2,
    note: "Back to Cambio after the poker.",
    rounds: [
      { won: ["chris"] },
      { won: ["manny"] },
      { won: ["manny"] },
      { won: ["gavin"] },
      { won: ["gavin"] },
      { won: ["lana"] },
    ],
  },
  {
    game: "cambio",
    playedOn: "2026-07-20",
    rounds: [
      { won: ["manny"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["chris"] },
      { won: ["manny"] },
      { won: ["chris"] },
    ],
  },
  {
    game: "cambio",
    playedOn: "2026-07-21",
    rounds: [
      { won: ["manny", "chris"] },
      { won: ["manny"] },
      { won: ["manny"] },
      { won: ["chris"] },
      { won: ["manny"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["manny"] },
    ],
  },
  {
    game: "cambio",
    playedOn: "2026-07-22",
    rounds: [
      { won: ["manny"] },
      { won: ["lana"] },
      { won: ["lana"] },
      // Recorded as ties.
      { won: ["chris", "lana"] },
      { won: ["manny", "lana"] },
      { won: ["lana"] },
      { won: ["lana"] },
      { won: ["chris"] },
      { won: ["manny"] },
      { won: ["manny"] },
    ],
  },
  {
    // The source for this night names no game. Its numbered-round format is the
    // one every Cambio sitting uses, and unlike them Chinese Poker is recorded
    // as matchups, so it is filed here as Cambio. Worth correcting if wrong.
    game: "cambio",
    playedOn: "2026-07-30",
    note: "Game not stated in the source; assumed Cambio from the round format.",
    rounds: [
      { won: ["chris"] },
      { won: ["lana"] },
      { won: ["manny"] },
      { won: ["gavin"] },
      { won: ["gavin"] },
      { won: ["chris"] },
      { won: ["lana", "chris"] },
      { won: ["nolan"] },
    ],
  },
];
