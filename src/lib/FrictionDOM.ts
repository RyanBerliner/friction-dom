import {Coordinate} from './types';
import { SurfaceObject } from './SurfaceObject';
import {toSeconds} from './utils';


export class FrictionDOM {
  cursor: Coordinate;
  cursorLast: Coordinate;

  rafStart: number;
  rafLast: number;
  raf: ReturnType<typeof setInterval>;

  draggingSurfaceObjects: Array<SurfaceObject>;
  activeSurfaceObjects: Array<SurfaceObject>;
  surfaceObjects: Array<SurfaceObject>;
  moveCount: number;

  constructor() {
    this.moveCount = 0;
    this.cursor = {x: 0, y: 0};
    this.cursorLast = {...this.cursor};

    this.rafStart = undefined;
    this.rafLast = undefined;
    this.raf = undefined;

    this.draggingSurfaceObjects = [];
    this.activeSurfaceObjects = [];
    this.surfaceObjects = [];

    document.addEventListener('mousemove', this.move.bind(this));
    document.addEventListener('touchmove', this.move.bind(this));

    document.addEventListener('mouseup', this.endMove.bind(this));
    document.addEventListener('touchend', this.endMove.bind(this));
  }

  addActiveSurfaceObject(obj: SurfaceObject): void {
    const found = this.activeSurfaceObjects.indexOf(obj) > -1;
    if (!found) this.activeSurfaceObjects.push(obj);
  }

  addDraggingSurfaceObjects(obj: SurfaceObject): void {
    const found = this.draggingSurfaceObjects.indexOf(obj) > -1;
    if (!found) this.draggingSurfaceObjects.push(obj);
  }

  beginMotion(withObject?: SurfaceObject): void {
    this.rafStart = toSeconds(performance.now());
    this.rafLast = toSeconds(performance.now());

    withObject && this.addActiveSurfaceObject(withObject);

    window.cancelAnimationFrame(this.raf);
    this.raf = window.requestAnimationFrame(this.updateMotion.bind(this));
  }

  updateMotion(): void {
    if (this.activeSurfaceObjects.length === 0) return;

    const time = toSeconds(performance.now());
    const timeDelta = time - this.rafLast;

    for (let i = this.activeSurfaceObjects.length - 1; i >= 0; i--) {
      this.activeSurfaceObjects[i].updateMotion(timeDelta);
      if (this.activeSurfaceObjects[i].settled) {
        this.activeSurfaceObjects.splice(i, 1);
      }
    }

    this.cursorLast.x = this.cursor.x;
    this.cursorLast.y = this.cursor.y;

    this.rafLast = time;
    this.raf = window.requestAnimationFrame(this.updateMotion.bind(this))
  }

  startMove(preventDefault: boolean, event: TouchEvent | MouseEvent, surfaceObject: SurfaceObject): void {
    if (preventDefault) event.preventDefault();

    this.addDraggingSurfaceObjects(surfaceObject);
    this.addActiveSurfaceObject(surfaceObject);

    if (event instanceof TouchEvent) {
      this.cursor.x = undefined;
      this.cursor.y = undefined;
      this.cursorLast.x = undefined;
      this.cursorLast.y = undefined;
    } else {
      this.cursorLast.x = this.cursor.x;
      this.cursorLast.y = this.cursor.y;
    }

    this.beginMotion();
  }

  move(event: TouchEvent | MouseEvent): void {
    this.moveCount++;

    if (event instanceof TouchEvent) {
      const {screenX, screenY} = event.targetTouches[0];
      this.cursor.x = screenX;
      this.cursor.y = screenY;
    } else {
      this.cursor.x = event.clientX;
      this.cursor.y = event.clientY;
    }
  }

  endMove(forScrolling: boolean): void {
    for (let i = this.draggingSurfaceObjects.length - 1; i >= 0; i--) {
      const simulateClick: boolean = !forScrolling && this.moveCount < 5;
      this.draggingSurfaceObjects[i].endMove(simulateClick);
      this.draggingSurfaceObjects.splice(i, 0);
    }

    this.moveCount = 0;
  }
}

// this is an internal export
export const app = new FrictionDOM();