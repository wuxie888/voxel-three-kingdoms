// The battlefield's size (STAGE.map.r: the playable radius; 46 m was the original arena). Everything laid out round
// the rim — the camp ring, standards, barricades, the castle wall, the rivers, the reserve army — moves out by RIM;
// scatter inside the field (debris, scorch, fires on the rim) scales by K. Its own module so the world, the set
// pieces and the sim can all read it without import cycles.
import { STAGE } from '../stages/index.js';

export const ARENA_RADIUS = STAGE.map?.r ?? 46;   // sim clamps hero / crowd inside this
export const RIM = ARENA_RADIUS - 46;
export const K = ARENA_RADIUS / 46;
// castle wall face (sim clamps, minimap and the castle set): its skyline fits under the gameplay frame's top edge
export const WALL_Z = 100 + RIM;
export const GATE_X = -10;
/** Where the hero starts: STAGE.map.start [x, z, yaw] (default the centre, facing the castle). */
export const START = STAGE.map?.start || [0, 0, 0];
