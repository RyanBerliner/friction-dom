import type { AppTouchEvent, Coordinate } from './types';
import {app} from './FrictionDOM';
import {toMeters, toPixels, gravity} from './utils';
import { Surface } from './Surface';

type Axis = 'x' | 'y';
type Boundary = 'x-min' | 'x-max' | 'y-min' | 'y-max';

type SurfaceObjectOptions = {
  /**
   * kg
   */
  mass: number,
  friction: number,
  axis: Axis | Array<Axis>,
  xProp: string,
  yProp: string,
  contained: boolean,
  /**
   * At what threshold should we nudge the object to an edge
   */
  nudgeThreshold: number,
  initialPosition: Boundary | Array<Boundary>,
};

type AxisState = {
  /**
   * meters/sec/sec
   */
  acceleration: number,
  /**
   * meters/sec 
   */
  velocity: number,
  /**
   * Relative position in pixels
   */
  position: number,
  settled: boolean,
  hittingMin: boolean,
  hittingMax: boolean,
  previousDisplacements: Array<number>,
};

type BoundaryCallbacks = {
  'x-min': Array<((() => void))>,
  'x-max': Array<((() => void))>,
  'y-min': Array<((() => void))>,
  'y-max': Array<((() => void))>,
}

type PositionDetails = {
  /**
   * x position as absolute pixels
   */
  x: number,
  /**
   * y position as absolute pixels
   */
  y: number,
  /**
   * x position as percentage of complete range of motion
   */
  xp: number,
  /**
   * y position as percentage of complete range of motion
   */
  yp: number,
}

type GoToInfo = {
  /**
   * x velocity in m/s
   */
  x: number,
  /**
   * y velocity in m/s
   */
  y: number,
}

export class SurfaceObject {
  element: HTMLElement;
  surface: Surface;
  options: SurfaceObjectOptions;
  x: AxisState;
  y: AxisState;
  currentEvent: AppTouchEvent | MouseEvent;
  currentScrollLock: boolean;
  currentScrollLockElement: HTMLElement;
  currentScrollLockStyle: string;

  boundaryCallbacks: BoundaryCallbacks;
  positionCallbacks: Array<((details: PositionDetails) => void)>; // fill out

  _dragging: boolean;

  constructor(element: HTMLElement | string, surface: Surface, options: Partial<SurfaceObjectOptions>) {
    app.surfaceObjects.push(this);

    this.positionCallbacks = [];

    this.surface = surface;
    this.surface.surfaceObjects.push(this);

    this.element = typeof(element) === 'string' ? document.getElementById(element) : element;
    this.element.style.position = surface.element === window ? 'fixed' : 'relative';

    this.options = {
      mass: 0.17,
      friction: 0.15, // kinetic friction of rubber and ice
      axis: ['x', 'y'],
      xProp: 'left',
      yProp: 'top',
      contained: true,
      nudgeThreshold: 0,
      initialPosition: ['x-min', 'y-min'],
      ...(options || {}),
    }

    const axisState: AxisState = {
      acceleration: 0,
      velocity: 0,
      position: 0,
      settled: true,
      hittingMin: false,
      hittingMax: false,
      previousDisplacements: [],
    }

    this.x = {...axisState};
    this.y = {...axisState};

    this.positionx = this.x.position + this.minEdge.x;
    this.positiony = this.y.position + this.minEdge.y;

    this.dragging = false;

    this.element.addEventListener('mousedown', this.startMove.bind(this), {capture: true, passive: false});
    this.element.addEventListener('touchstart', this.startMove.bind(this), {capture: true, passive: false});

    this.boundaryCallbacks = {
      'x-min': [],
      'x-max': [],
      'y-min': [],
      'y-max': [],
    };

    this.goto(this.options.initialPosition, 0, false, true);
  }

  get minEdge(): Coordinate {
    return {
      x: this.surface.minX,
      y: this.surface.minY,
    };
  }

  get maxEdge(): Coordinate {
    const { contained } = this.options;

    return {
      x: this.surface.maxX - (contained ? this.element.offsetWidth : 0),
      y: this.surface.maxY - (contained ? this.element.offsetHeight : 0),
    };
  }

  get dragging(): boolean { return this._dragging; }
  set dragging(d: boolean) { this._dragging = d; }

  get positionx(): number { return this.x.position; }
  set positionx(p: number) { this.x.position = p; this.element.style[this.options.xProp] = p + 'px'; this.callPositionCallbacks(); }

  get positiony(): number { return this.y.position; }
  set positiony(p: number) { this.y.position = p; this.element.style[this.options.yProp] = p + 'px'; this.callPositionCallbacks(); }

  get settled(): boolean { return this.x.settled && this.y.settled; }

  get axis(): Array<Axis> {
    return Array.isArray(this.options.axis) ? this.options.axis : [this.options.axis];
  }

  resetAxis(axis: Axis): void {
    this[axis].settled = false;
    this[axis].hittingMin = false;
    this[axis].hittingMax = false;
    this[axis].previousDisplacements = [];
  }

  startMove(event: TouchEvent | MouseEvent): void {
    const target: HTMLElement = event.target as HTMLElement;

    let curr: HTMLElement = target;
    while (this.element.contains(curr)) {
      const overflowY: string = window.getComputedStyle(curr).getPropertyValue('overflow-y');
      if (curr.offsetHeight !== curr.scrollHeight && overflowY !== 'hidden') {
        this.currentScrollLockStyle = overflowY;
        this.currentScrollLockElement = curr;
        this.currentScrollLock= true;
      }

      curr = curr.parentElement;
    }

    this.currentEvent = event;

    app.startMove(!this.currentScrollLock, event, this);

    this.axis.forEach(axis => {
      this.resetAxis(axis);
    });

    this.dragging = true;
  }

  closestSettlePoint(): Array<Boundary> {
    const settlePoints = [];
    this.axis.forEach(axis => {
      const { position } = this[axis];
      const delta = this.maxEdge[axis] - this.minEdge[axis];
      const percentage = (position - this.minEdge[axis]) / delta;
      if (position < this.minEdge[axis] || percentage <= 0.5) {
        settlePoints.push(`${axis}-min`);
      }

      if (position > this.maxEdge[axis] || percentage > 0.5) {
        settlePoints.push(`${axis}-max`);
      }
    });

    return settlePoints;
  }

  endMove(performEvent: boolean): void {
    if (this.currentScrollLockElement) {
      this.currentScrollLockElement.style.overflowY = this.currentScrollLockStyle;
      this.currentScrollLockStyle = null;
      this.currentScrollLockElement = null;
      this.currentScrollLock = false;
    }

    if (this.currentEvent && performEvent) {
      const el: HTMLElement = this.currentEvent.target as HTMLElement;
      el.click();
    }

    this.currentEvent = null;

    const { nudgeThreshold } = this.options;
    this.dragging = false;

    this.axis.forEach(axis => {
      const { position, velocity } = this[axis];
      const minDiff = position - this.minEdge[axis];
      const maxDiff = this.maxEdge[axis] - position;

      let outOfBounds = false;
      if (velocity === 0 && minDiff < 0) { this[axis].velocity = -0.01; outOfBounds = true; }
      if (velocity === 0 && maxDiff < 0) { this[axis].velocity = 0.01; outOfBounds = true; }
      if (nudgeThreshold === 0 || outOfBounds) return; // if we are allowed to float don't worry about anything else!

      const dir = velocity > 0 ? 'max' : 'min';
      const info = {
        min: this.goto(`${axis}-min`, 0, true),
        max: this.goto(`${axis}-max`, 0, true),
      };

      if (Math.abs(velocity) < Math.abs(info[dir][axis])) {
        let positionPercentage = ((this[axis].position - this.minEdge[axis]) / (this.maxEdge[axis] - this.minEdge[axis])) * 100;
        // this is not working properly, we need to know which edge the item started 
        // closest to in order to know which to snap back to
        const closestEdge = positionPercentage > 50 ? 'max' : 'min';
        const opClosestEdge = positionPercentage <= 50 ? 'max' : 'min';
        positionPercentage = positionPercentage > 50 ? 100 - positionPercentage : positionPercentage;
        this[axis].velocity = info[positionPercentage < nudgeThreshold ? closestEdge : opClosestEdge][axis];
      }
    });

    if (this.x.velocity === 0) this.x.settled = true;
    if (this.y.velocity === 0) this.y.settled = true;
  }

  goto(boundary: Boundary | Array<Boundary>, overshootOverride?: number, justInfo?: boolean, instant?: boolean): void | GoToInfo {
    const instructions = {};
    const info: GoToInfo = {x: null, y: null};

    boundary = Array.isArray(boundary) ? boundary : [boundary]

    boundary.forEach(d => {
      const [axis, dir] = d.split('-');
      instructions[axis] = dir;
    });

    const { friction, mass } = this.options;
    let { scale, overshoot } = this.surface.options;
    if (overshootOverride !== undefined) overshoot = overshootOverride;
    const frictionForce = friction * (mass * gravity);

    const positionParts = new Map();
    this.axis.forEach(axis => {
      const instruction = instructions[axis];
      if (!instruction) return;
      positionParts.set(axis, toMeters((instruction === 'max' ? this.maxEdge[axis] : this.minEdge[axis]) - this[axis].position, scale));
    });

    this.axis.forEach(axis => {
      const instruction = instructions[axis];
      if (!instruction) return;

      const otherAxis = axis === 'y' ? 'x' : 'y';
      let positionDelta = positionParts.get(axis);
      let otherPositionDelta = positionParts.get(otherAxis);

      let frictionMultiplier = 1;
      if (otherPositionDelta) {
        frictionMultiplier = Math.abs(positionDelta)/(Math.abs(otherPositionDelta) + Math.abs(positionDelta));
      }

      if (positionDelta === 0) return;
      positionDelta *= (1 + ((overshoot) / 100))

      info[axis] = Math.sqrt(2 * ((frictionForce * frictionMultiplier) / mass) * Math.abs(positionDelta));
      info[axis] *= positionDelta >= 0 ? 1 : -1;

      if (!justInfo) {
        this.resetAxis(axis);

        if (instant) {
          this[axis].position += toPixels(positionDelta, scale);
          this[axis].velocity = 0
        } else {
          this[axis].velocity = info[axis];
        }
      }
    });

    if (justInfo) return info;
    if (!this.x.settled || !this.y.settled) app.beginMotion(this);
  }

  updateMotion(timeDelta: number): void {
    const { friction, mass } = this.options;
    const { scale } = this.surface.options;

    const axisCoefficients = {
      x: (Math.abs(this.x.velocity)/(Math.abs(this.y.velocity) + Math.abs(this.x.velocity))),
      y: (Math.abs(this.y.velocity)/(Math.abs(this.y.velocity) + Math.abs(this.x.velocity))),
    };

    let cancelMotion: boolean = false;

    this.axis.forEach(axis => {
      if (this.dragging) {
        let pullCoefficient = 1;
        if (this[axis].position < this.minEdge[axis] || this[axis].position > this.maxEdge[axis]) {
          pullCoefficient = this.surface.options.boundaryPullSpring<= this.surface.options.boundarySpring
            ? (this.surface.options.boundaryPullSpring / this.surface.options.boundarySpring) / 2
            : 1 - ((this.surface.options.boundarySpring / this.surface.options.boundaryPullSpring) / 2);
        }

        const positionDelta = pullCoefficient * (app.cursor[axis] === undefined || app.cursorLast[axis] === undefined ? 0 : app.cursor[axis] - app.cursorLast[axis]);

        // TODO: make this work for both axis
        if (axis === 'y') {
          if (this.currentScrollLock) {
            const scrollableAmount = this.currentScrollLockElement.scrollHeight - this.currentScrollLockElement.offsetHeight;
            const hittingTop = this.currentScrollLockElement.scrollTop <= 0;
            const hittingBottom = this.currentScrollLockElement.scrollTop >= scrollableAmount;

            if (
              (hittingTop && positionDelta > 0) ||
              (hittingBottom && positionDelta < 0)
            ) {
              this.currentScrollLockElement.style.overflowY = 'hidden';
              this.currentScrollLock = false;
            } else if (!hittingBottom && !hittingTop) {
              cancelMotion = true;
            }
          }
        }

        if (!this.currentScrollLock) { // this is so we don't start moving until we know for sure we should
          this[`position${axis}`] += positionDelta;
          const newVelocity = toMeters(positionDelta, scale) / timeDelta;
          const velocityDelta = newVelocity - this[axis].velocity;
          this[axis].velocity = newVelocity;
          this[axis].acceleration = velocityDelta / timeDelta;
        }
      } else {
        this[`position${axis}`] += toPixels(this[axis].velocity * timeDelta, scale);

        let frictionForce = friction * (mass * gravity) * (this[axis].velocity > 0 ? -1 : 1);
        frictionForce *= (isNaN(axisCoefficients[axis])) ? 0 : axisCoefficients[axis]; // friction is inline with vector magnitude, so we need to adjust

        const forces = [frictionForce]; // friction is always a thing

        if (this[axis].hittingMax || (this[axis].velocity >= 0 && this[axis].position > this.maxEdge[axis])) {
          if (!this[axis].hittingMax) this.callBoundaryCallbacks(`${axis}-max`);
          this[axis].hittingMax = true;
          forces.push(this.surface.options.boundarySpring * (this.maxEdge[axis] - this[axis].position)); // force of spring
        }

        if (this[axis].hittingMin || (this[axis].velocity <= 0 && this[axis].position < this.minEdge[axis])) {
          if (!this[axis].hittingMin) this.callBoundaryCallbacks(`${axis}-min`);
          this[axis].hittingMin = true;
          forces.push(this.surface.options.boundarySpring * (this.minEdge[axis] - this[axis].position)); // force of spring
        }

        if (this[axis].hittingMin || this[axis].hittingMax) forces.push(this.surface.options.boundarySpringDamping * -this[axis].velocity); // force of damper

        this[axis].acceleration = forces.reduce((sum, x) => sum + x, 0) / mass;
        const newVelocity = this[axis].velocity + (this[axis].acceleration * timeDelta);

        if (this[axis].hittingMin || this[axis].hittingMax) {
          this[axis].previousDisplacements.push(
            Math.abs(this[axis].hittingMax
              ? this[axis].position - this.maxEdge[axis]
              : this.minEdge[axis] - this[axis].position
            )
          );
        }

        this[axis].velocity = newVelocity * this[axis].velocity <= 0 && !(this[axis].hittingMin || this[axis].hittingMax) ? 0 : newVelocity;

        if (this[axis].previousDisplacements.length >= 5) {
          let min: number = Infinity;
          let max: number = -Infinity;

          for (let i = this[axis].previousDisplacements.length - 1; i >= this[axis].previousDisplacements.length - 6; i--) {
            let dis = this[axis].previousDisplacements[i];
            if (dis > max) max = dis;
            if (dis < min) min = dis;
          }

          if (max - min < 1) {
            this[axis].velocity = 0;
            // set position exactly as it should be on the limit
            this[`position${axis}`] = this[axis].hittingMax ? this.maxEdge[axis] : this.minEdge[axis];
          }
        }

        if (this[axis].velocity === 0) this[axis].settled = true;
      }
    });

    if (cancelMotion) {
      app.endMove(undefined, true);
    }
  }

  onPositionChange(fn: ((details: PositionDetails) => void)): void {
    this.positionCallbacks.push(fn);
    this.callPositionCallbacks();
  }

  // add a callback to be called when a boundary is hit
  onBoundaryContact(boundary: Boundary, fn: (() => void)): void {
    this.boundaryCallbacks[boundary].push(fn);
  }

  // internal funcs

  callBoundaryCallbacks(boundary: Boundary): void {
    this.boundaryCallbacks[boundary].forEach((fn: (() => void)): void => fn());
  }

  callPositionCallbacks() {
    const x = this.x.position;
    const y = this.y.position;
    const xd = this.maxEdge.x - this.minEdge.x;
    const yd = this.maxEdge.y - this.minEdge.y;
    this.positionCallbacks.forEach((fn: ((details: PositionDetails) => void)) => fn({x, y, xp: (x - this.minEdge.x) / xd, yp: (y - this.minEdge.y) / yd}));
  }
}
