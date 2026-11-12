import { RESERVED_SLUGS } from "../constants";
import type { GameDefinition } from "./types";

/**
 * Every game that exists in the codebase. Whether a game is actually visible to players is decided by
 * `config.development.ts` / `config.production.ts`, not by this file.
 *
 * To add a game: add its definition here, add its slug to the config file(s), and register its
 * React component in apps/web/src/games/registry.ts.
 */
export const GAME_DEFINITIONS = {
  monopoly: {
    slug: "monopoly",
    name: "Monopoly",
    tagline: "Buy, trade and bankrupt your friends.",
    description:
      "Roll the dice, buy properties, build houses and drive everyone else into bankruptcy. Last player standing wins.",
    accent: "#f43f5e",
    playTime: "60-120 min",
    minPlayers: 2,
    maxPlayers: 6,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
    genre: [
      "Economic Strategy",
      "Property Trading",
      "Turn-Based",
      "Competitive",
    ],
    difficulty: "Strategic & Cutthroat",
    overview: [
      "Monopoly is the classic board game of empire building, shrewd trading, and merciless bankruptcies. Navigate the 40-square perimeter board acquiring iconic properties, railroads, and utilities while forcing competitors to pay escalating rents.",
      "Assemble full color property groups to construct houses and towering skyscrapers. Negotiate live trades directly with rivals, manage mortgages when cash runs tight, and leverage Chance and Community Chest cards to flip the game on its head.",
      "With automated banking, live trading consoles, and real-time turn synchronization, Kridora Monopoly eliminates manual bookkeeping so you can focus entirely on financial domination.",
    ],
    howToPlay: [
      {
        step: 1,
        title: "Roll & Traverse",
        description:
          "Roll the dice pair to navigate clock-wise around the 40-tile perimeter board.",
      },
      {
        step: 2,
        title: "Acquire Deeds",
        description:
          "Purchase unowned properties you land on or send them to an open player auction.",
      },
      {
        step: 3,
        title: "Develop & Build",
        description:
          "Once you own all properties of a color group, construct houses and hotels to escalate rent.",
      },
      {
        step: 4,
        title: "Bankrupt Opponents",
        description:
          "Deplete opponents' cash and mortgages until you stand as the sole surviving tycoon.",
      },
    ],
    rulesSummary: [
      "Passing 'GO' awards a recurring salary bonus to fund your real estate expansion.",
      "Rolling doubles grants an extra roll; 3 consecutive doubles sends you straight to Jail.",
      "Mortgaged properties cannot collect rent until the mortgage loan is repaid with interest.",
      "Unpayable debt transfers all remaining assets directly to the creditor upon bankruptcy.",
    ],
    controls: [
      {
        key: "Click / Tap",
        action: "Roll dice, purchase deeds, or configure trade offers",
      },
      {
        key: "Drag & Drop",
        action: "Organize deed cards in trade negotiation screens",
      },
    ],
    screenshots: [
      {
        url: "/games/thumbs/monopoly.webp",
        title: "Retro Tycoon Cover",
        caption:
          "Iconic retro board layout with deed cards, tokens, and city properties.",
      },
      {
        url: "/games/ss/monopoly-gameplay.webp",
        title: "Live Match Action Deck",
        caption:
          "Real-time bank balances, mini houses, deed portfolios, and active turn controls.",
      },
    ],
  },
  fatebyai: {
    slug: "fatebyai",
    name: "Fate by AI",
    tagline: "An AI narrator decides how your story ends.",
    description:
      "Everyone makes a choice, the AI weaves them into one story, and fate decides who comes out on top.",
    accent: "#8b5cf6",
    playTime: "20-40 min",
    minPlayers: 2,
    maxPlayers: 8,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
    genre: [
      "AI Narrative",
      "Interactive Story",
      "Role-Playing",
      "Social Party",
      "Sci-Fi / Fantasy",
    ],
    difficulty: "Imaginative & Accessible",
    overview: [
      "Fate by AI is an experimental multiplayer narrative game where an artificial intelligence dungeon master scripts an unpredictable cinematic journey tailored specifically to your room's decisions.",
      "Every turn presents an emergent dilemma: moral quandaries, sci-fi expeditions, or high-fantasy combat. Each player secretly votes or submits their action, and the neural storyteller synthesizes your chaotic choices into an illustrated branching saga.",
      "Will your party work in unison to overcome impossible cosmic odds, or will betrayal and rogue choices splinter your crew? No two games are ever identical.",
    ],
    howToPlay: [
      {
        step: 1,
        title: "Hear the Scenario",
        description:
          "The AI Narrator presents a new chapter predicament to the entire party.",
      },
      {
        step: 2,
        title: "Lock In Your Choice",
        description:
          "Select your tactical or moral path before the round timer expires.",
      },
      {
        step: 3,
        title: "Witness the Verdict",
        description:
          "The AI resolves the group's actions, determining survival, loot, or unforeseen disasters.",
      },
      {
        step: 4,
        title: "Reach the Finale",
        description:
          "Survive multiple narrative arcs to receive your personalized group legacy epilogue.",
      },
    ],
    rulesSummary: [
      "Player votes are revealed simultaneously once all decisions are locked in.",
      "Ties or contradictory decisions force high-risk chaotic fate rolls.",
      "Player character stats and inventory persist across chapters until match completion.",
      "Rogue individual actions can either save the team or drag everyone into peril.",
    ],
    controls: [
      {
        key: "Click / Tap",
        action: "Select story choices or submit custom player actions",
      },
      {
        key: "Number Keys 1-4",
        action: "Quickly vote on available choices from your keyboard",
      },
    ],
    screenshots: [
      {
        url: "/games/thumbs/fatebyai.webp",
        title: "The AI Oracle Monolith",
        caption:
          "Mystic 16-bit terminal channeling cosmic narrative intelligence.",
      },
      {
        url: "/games/ss/fatebyai-gameplay.webp",
        title: "Encounter & Voting Deck",
        caption:
          "Live scenario exposition, real-time player votes, and interactive decision branches.",
      },
    ],
  },
  ludo: {
    slug: "ludo",
    name: "Ludo",
    tagline: "A little luck. A lot of friendly rivalry.",
    description:
      "Race four pieces around the board, send rivals back to their yards and be the first to bring every piece home.",
    accent: "#fb7185",
    playTime: "15-30 min",
    minPlayers: 2,
    maxPlayers: 4,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
    genre: [
      "Classic Board Game",
      "Turn-Based",
      "Dice Rolling",
      "Multiplayer Battle",
    ],
    difficulty: "Casual & Fast-Paced",
    overview: [
      "Ludo is the legendary cross-and-circle strategy board game originating from the ancient Indian game Pachisi. In this turbocharged arcade edition, players roll the dice to bring their four tokens onto the battlefield, navigating treacherous tracks where one wrong step sends your token crashing back home.",
      "Compete against your friends in high-stakes multiplayer rooms. Roll a six to launch your tokens into action, form safe alliances on starred sanctuary tiles, and hunt down your rivals to knock them out just squares away from victory.",
      "Featuring authentic retro sound effects, animated dice throws, dynamic board cameras, and real-time turn synchronization, Kridora Ludo brings board night directly to your browser with zero latency.",
    ],
    howToPlay: [
      {
        step: 1,
        title: "Roll a 1 or 6 to Deploy",
        description:
          "Roll a 1 or 6 to move a token from your yard onto the starting square.",
      },
      {
        step: 2,
        title: "Circle the Track",
        description:
          "Navigate clock-wise around the main perimeter path based on your dice roll values.",
      },
      {
        step: 3,
        title: "Strike Rival Tokens",
        description:
          "Land directly on an opponent's token to capture it and banish it back to their yard!",
      },
      {
        step: 4,
        title: "Enter the Home Column",
        description:
          "Guide all 4 of your tokens into the colored center triangle to claim first place.",
      },
    ],
    rulesSummary: [
      "Rolling a 6 grants a bonus turn. Rolling a 1 or 6 allows releasing a token from your yard.",
      "Three consecutive rolls of 6 will forfeit your turn.",
      "Landing on a tile occupied by an opponent sends their token back to base (except on starred safe tiles).",
      "Exact roll count is required to enter the home triangle finish line.",
    ],
    controls: [
      {
        key: "Click / Tap",
        action: "Roll dice or select eligible token to move",
      },
      {
        key: "Spacebar",
        action: "Quick roll dice when it is your turn",
      },
    ],
    screenshots: [
      {
        url: "/games/thumbs/ludo.webp",
        title: "Classic Quad-Color Board",
        caption:
          "Authentic retro colors with red, green, yellow, and blue starting yards.",
      },
      {
        url: "/games/ss/ludo-gameplay.webp",
        title: "In-Game Isometric Action",
        caption:
          "Live dice roll action, token hops, and multiplayer HUD indicators.",
      },
    ],
  },
  "truth-and-dare": {
    slug: "truth-and-dare",
    name: "Truth and Dare",
    tagline: "Round the table. Spin for a story.",
    description:
      "Choose your character, set an age-friendly prompt pack, then spin the bottle, a magic wand, or a compass to pick who plays next.",
    accent: "#f472b6",
    playTime: "10-30 min",
    minPlayers: 2,
    maxPlayers: 8,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
    genre: ["Party Game", "Social Icebreaker", "Casual Fun", "Turn-Based"],
    difficulty: "Casual & Good Vibes",
    overview: [
      "Truth and Dare brings the classic party circle directly into your browser with zero awkwardness and 100% good vibes.",
      "Gather your friends around a retro-styled interactive table, choose between a bottle, magic wand, or compass centerpiece, and take turns spinning to select who takes the floor.",
      "The host configures age packs and content vibes (from chill and family-friendly to teen and spicy adult modes), with full control to answer truthfully or take on lighthearted dares with a 30-second live timer.",
    ],
    howToPlay: [
      {
        step: 1,
        title: "Join the Table & Pick a Character",
        description:
          "Gather your party in the room and choose your custom character look.",
      },
      {
        step: 2,
        title: "Host Sets the Vibe",
        description:
          "The room host enters the game and selects the age pack, content mode, and spinner.",
      },
      {
        step: 3,
        title: "Spin the Centerpiece",
        description:
          "Take turns spinning the bottle, wand, or compass to select the next player.",
      },
      {
        step: 4,
        title: "Truth or Dare?",
        description:
          "The selected player picks Truth or Dare, completes the prompt, or skips with zero penalty.",
      },
    ],
    rulesSummary: [
      "Good vibes only: prompts are playful, respectful, and completely optional to answer or perform.",
      "Anyone can skip a prompt at any time without penalty.",
      "Adult and spicy packs require explicit 18+ confirmation.",
      "Turns rotate clockwise after each completed or skipped prompt.",
    ],
    controls: [
      {
        key: "Click / Tap",
        action: "Spin the bottle, select Truth or Dare, or pick your character",
      },
    ],
  },
  business: {
    slug: "business",
    name: "Business",
    tagline:
      "Roll the die, buy world cities, and hit the target net worth first!",
    description:
      "A fast, clean multiplayer real-estate board game. Roll a single die, hop across 28 global tiles, buy iconic cities, upgrade rent tiers, and race to the target net worth.",
    accent: "#10b981",
    playTime: "15-25 min",
    minPlayers: 2,
    maxPlayers: 4,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
    genre: ["Board Game", "Strategy", "Economy"],
    difficulty: "Easy",
    overview: [
      "Compete on a vibrant 28-tile global board featuring iconic cities from Rio and Delhi to Tokyo and New York.",
      "Roll a single die (1–6) and watch your token hop automatically around the board.",
      "Buy unowned cities directly in the center of the board, upgrade properties when you revisit them, and collect rent from rivals.",
      "First player to reach the Target Net Worth ($5,000, $7,000, or $10,000) or last solvent player wins!",
    ],
    howToPlay: [
      {
        step: 1,
        title: "Pick Target Net Worth & Capital",
        description:
          "The host selects the Target Net Worth and Starting Capital, then launches the match.",
      },
      {
        step: 2,
        title: "Roll the Die",
        description:
          "Click 'Roll the Die' on the right panel. Rolling a 6 grants an extra bonus roll!",
      },
      {
        step: 3,
        title: "Buy & Upgrade in the Center",
        description:
          "When your puck lands on an open city, buy or pass right in the center of the board.",
      },
      {
        step: 4,
        title: "Reach the Net Worth Goal",
        description:
          "Every city you own adds to your Net Worth. Hit the target Net Worth first to win!",
      },
    ],
    rulesSummary: [
      "Passing START awards a +$200 salary bonus.",
      "Rolling a 6 gives you a bonus turn unless you land in Jail.",
      "Landing on your own city lets you upgrade its rent level.",
      "If you owe more rent than your cash on hand, sell a property back to the bank at 75% value to clear your debt.",
    ],
    controls: [
      { key: "Click / Space", action: "Roll the Die" },
      {
        key: "Center Prompt",
        action: "Buy or Pass when landing on a property",
      },
      {
        key: "Click Owned Tile",
        action: "Inspect rent or sell property if in debt",
      },
    ],
  },
} satisfies Record<string, GameDefinition>;

export type GameSlug = keyof typeof GAME_DEFINITIONS;

// Fail fast (at import time) on slugs that would collide with real routes or break URLs.
for (const slug of Object.keys(GAME_DEFINITIONS)) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      `Invalid game slug "${slug}": use lowercase letters, numbers and dashes only.`,
    );
  }
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Game slug "${slug}" is reserved by the app router.`);
  }
}

export function isKnownGameSlug(slug: string): slug is GameSlug {
  return Object.hasOwn(GAME_DEFINITIONS, slug);
}
