export const gravity = 9.8; // meters/sec/sec

export function toMeters(px, scale) { return px / scale };
export function toPixels(meters, scale) { return meters * scale };
export function toSeconds(milli) { return milli / 1000 }; // for verbosity...
