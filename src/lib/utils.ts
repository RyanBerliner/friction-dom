/**
 * meters/sec/sec
 */
export const gravity: number = 9.8;

export function toMeters(px: number, scale: number): number { return px / scale };
export function toPixels(meters: number, scale: number): number { return meters * scale };
export function toSeconds(milli: number): number { return milli / 1000 };
