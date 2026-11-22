// The screenshot poses. The game reads ?shot=<name> from its address and sets the
// world into one of these fixed states, so a still of the game can be taken without
// playing it first. The names match the files in shots-src/ and screenshots/.

export const SHOTS = {
  start: {
    name: '1-start',
    title: 'The title card of Sunset City at dusk',
    note: 'the title screen over the painted sunset sky and the bay',
  },
  play: {
    name: '2-play',
    title: 'On foot in the middle of the city',
    note: 'the player on the pavement with traffic on the road and gulls over the bay',
  },
  mission: {
    name: '4-mission',
    title: 'Taking a job at the phone on the boardwalk',
    note: 'the boardwalk phone with the objective card and the minimap',
  },
  end: {
    name: '3-end',
    title: 'A police chase at three wanted stars',
    note: 'police cars closing in on the player, with the speedometer and the nitro bar lit',
  },
};

/** The names the game accepts in the shot parameter, in the order of the screenshots. */
export const SHOT_NAMES = ['start', 'play', 'mission', 'end'];

/** Whether a name is one of the poses. */
export function isShot(name) {
  return Object.hasOwn(SHOTS, name);
}
