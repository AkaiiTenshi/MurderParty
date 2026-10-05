import * as root from './root.js';
import * as channel from './channel.js';
import * as rootgm from './rootgm.js';

export const commands = new Map([root, channel, rootgm].map((c) => [c.data.name, c]));
