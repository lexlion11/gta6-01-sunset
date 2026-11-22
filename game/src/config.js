// Sunset City - tunables and palette. Everything the game draws comes from here or from
// the world generator, so the whole look of the city is one file to read.

// The game's drawing surface. The screenshot pages render the canvas at exactly
// this size, so a capture of the viewport is the game's own frame.
export const VIEW = { width: 1280, height: 800 };

// The city is a grid of blocks separated by roads. On top of the grid sit a beach
// (south edge) and the ocean beyond it.
export const CITY = {
  cols: 10,
  rows: 10,
  block: 420,       // buildable square of a block, before pavements
  road: 116,        // width of a carriageway
  pavement: 18,     // width of the sidewalk around each block
  beachHeight: 300, // sand between the boardwalk and the water
  oceanHeight: 300, // water strip at the south edge
  boardwalk: 74,    // width of the timber boardwalk over the sand
};

export const COLORS = {
  sky: '#ffd9a0',
  dusk: '#7d5a9e',
  asphalt: '#4a505c',
  asphaltEdge: '#5b6270',
  lane: '#f5e6b8',
  pavement: '#cfc7b8',
  pavementLine: '#aea596',
  sand: '#f0dca8',
  wetSand: '#ddc795',
  ocean: '#2e86ab',
  oceanDeep: '#17547a',
  foam: '#e8f6fa',
  grass: '#6bb05a',
  grassDark: '#549245',
  path: '#d9c69f',
  water: '#3f95bd',
  building: ['#a08b70', '#8a93a3', '#b5a184', '#7e8b9b', '#bfae8c', '#8d7f92'],
  roof: ['#6a707a', '#75796f', '#5e5c68'],
  window: '#ffd98a',
  windowLit: '#fff3c4',
  player: '#f2f2f2',
  playerSkin: '#e8b98c',
  ped: ['#e8c49c', '#d4a97c', '#f2d6b0', '#c99a6e'],
  cop: '#2a52ad',
  copDark: '#1b366f',
  blood: '#a83232',
  marker: '#ffd23f',
  markerPulse: '#fff3a8',
  hud: '#f4f1e8',
  hudShade: 'rgba(12,14,20,0.72)',
  text: '#f6f2e6',
  money: '#8fe08a',
  star: '#ffd23f',
  starOff: 'rgba(255,255,255,0.22)',
  // street props
  bench: '#8a6a45',
  hydrant: '#c8443c',
  stall: '#e8b04a',
  stallAwning: '#d95a5a',
  bin: '#4a5058',
  planter: '#4e7a3a',
  // the gulls that work the shoreline
  gull: '#f4f0e4',
};

export const PHYSICS = {
  walkSpeed: 165,
  runSpeed: 250,
  bulletSpeed: 900,
  bulletLife: 0.9,
  pedFleeSpeed: 235,
  pedWalkSpeed: 52,
  copSpeed: 300,
  // How long the heat stays up before it drops a star, and how long the police
  // keep the player after that.
  wantedDecay: 22,
  // The escape job needs the heat to hold for its own length: the police do not
  // cool off faster than the job they gave you.
  wantedCooldown: 7,
  // The horn: how far it carries, how long it takes to sound again, and how long
  // a police car stays confused after it is honked at.
  hornRadius: 340,
  hornCooldown: 1.1,
  hornLife: 0.85,
  copConfuse: 1.6,
  // A traffic car that hears the horn brakes for a moment.
  trafficPanic: 0.9,
  // The nitro tank: how many seconds of boost a full tank holds, and how many
  // seconds of idling it takes to win back one second of boost. These used to be
  // hardcoded in the update loop; they live here now so the tank can be tuned
  // without hunting for the arithmetic.
  nitroDrain: 0.4,
  nitroRefill: 0.06,
};

export const WANTED = {
  max: 5,
  copsPerStar: 2,
  health: 100,
};

// How busy the streets are. The counts are tunables so the city can be made
// quieter or busier without touching the code that spawns things.
export const TRAFFIC = {
  density: 30,       // NPC cars driving the grid
  parked: 18,        // cars parked on the pavement, waiting to be stolen
  pedestrians: 70,   // people on the pavements
  scatter: 150,      // how far a honk throws the pedestrians and the traffic
};

// The dusk tint that lies over the whole city, and the vignette around the edges.
export const NIGHT = {
  tint: 'rgba(34,26,72,0.16)',
  vignette: 0.30,
};

// The gulls that circle the shoreline: how many there are and how wide each one
// sweeps. They are pure atmosphere - no collision, no gameplay - but the coast
// feels empty without them.
export const GULLS = {
  count: 14,
  radius: 190,
};

// The speedometer gauge in the corner of the HUD.
export const SPEEDOMETER = {
  radius: 74,
  max: 500,          // world units per second at the far end of the dial
};

// The heist: robbing a stash sets the alarm off, and the job pays a bonus for
// the clean getaway.
export const HEIST = {
  alarmWanted: 1,
  reach: 62,
  getawayReach: 76,
};
