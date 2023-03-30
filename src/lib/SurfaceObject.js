import {app} from './FrictionDOM';
import {toMeters, toPixels, gravity} from './utils';

export class SurfaceObject {
  constructor(element, surface, options) {
    this.positionCallbacks = [];

    this.surface = surface;
    this.surface.surfaceObjects.push(this);

    this.element = element;
    this.element.style.position = surface.element === window ? 'fixed' : 'relative';

    this.options = {
      mass: 0.17, // kg
      friction: 0.15, // kinetic friction of rubber and ice
      axis: 'x,y',
      xProp: 'left',
      yProp: 'top',
      contained: true,
      nudgeThreshold: 0, // at what threshold should we nudge the object to an edge (don't let it float)
      additionalHandles: [], // more elements you can click/touch to move object
      initialPosition: 'x-min,y-min',
      ...(options || {}), // allow overriding defaults
    }

    const axisState = {
      acceleration: 0, // meters/sec/sec
      velocity: 0, // meters/sec
      position: 0, // relative position in pixels
      settled: true,
      hittingMin: false,
      hittingMax: false,
      occilationAmplitudes: [],
    }

    this.x = {...axisState};
    this.y = {...axisState};

    this.positionx = this.x.position + this.minEdge.x;
    this.positiony = this.y.position + this.minEdge.y;

    this.dragging = false;

    this.element.addEventListener('mousedown', this.startMove.bind(this), true);
    this.element.addEventListener('touchstart', this.startMove.bind(this), true);

    this.boundaryCallbacks = {
      'x-min': [],
      'x-max': [],
      'y-min': [],
      'y-max': [],
    };

    this.goto(this.options.initialPosition, 0, false, true);
  }

  get minEdge() {
    return {
      x: this.surface.minX,
      y: this.surface.minY,
    };
  }

  get maxEdge() {
    const { contained } = this.options;

    return {
      x: this.surface.maxX - (contained ? this.element.offsetWidth : 0),
      y: this.surface.maxY - (contained ? this.element.offsetHeight : 0),
    };
  }

  get dragging() { return this._dragging; }
  set dragging(d) {
    this._dragging = d; this.element.style.cursor = d ? 'grabbing' : 'grab';
  }

  get positionx() { return this.x.position; }
  set positionx(p) { this.x.position = p; this.element.style[this.options.xProp] = p + 'px'; this.callPositionCallbacks(); }

  get positiony() { return this.y.position; }
  set positiony(p) { this.y.position = p; this.element.style[this.options.yProp] = p + 'px'; this.callPositionCallbacks(); }

  get settled() { return this.x.settled && this.y.settled; }

  get axis() { return this.options.axis.split(','); }

  resetAxis(axis) {
    this[axis].settled = false;
    this[axis].hittingMin = false;
    this[axis].hittingMax = false;
    this[axis].occilationAmplitudes = [];
  }

  startMove(event) {
    if ([this.element, ...this.options.additionalHandles].indexOf(event.target) < 0) return;

    app.startMove(event, this);

    this.axis.forEach(axis => {
      this.resetAxis(axis);
    });

    this.dragging = true;
  }

  closestSettlePoint() {
    const settlePoint = [];
    this.axis.forEach(axis => {
      const { position } = this[axis];
      const delta = this.maxEdge[axis] - this.minEdge[axis];
      const percentage = (position - this.minEdge[axis]) / delta;
      if (position < this.minEdge[axis] || percentage <= 0.5) {
        settlePoint.push(`${axis}-min`);
      }

      if (position > this.maxEdge[axis] || percentage > 0.5) {
        settlePoint.push(`${axis}-max`);
      }
    });

    return settlePoint.join(',')
  }

  endMove() {
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

  goto(direction, overshootOverride, justInfo, instant) {
    const instructions = {};
    const info = {x: null, y: null};

    direction.split(',').forEach(d => {
      const [axis, bound] = d.split('-');
      instructions[axis] = bound;
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

  updateMotion(timeDelta) {
    const { friction, mass } = this.options;
    const { scale } = this.surface.options;

    const axisCoefficients = {
      x: (Math.abs(this.x.velocity)/(Math.abs(this.y.velocity) + Math.abs(this.x.velocity))),
      y: (Math.abs(this.y.velocity)/(Math.abs(this.y.velocity) + Math.abs(this.x.velocity))),
    };

    this.axis.forEach(axis => {
      if (this.dragging) {
        let pullCoefficient = 1;
        if (this[axis].position < this.minEdge[axis] || this[axis].position > this.maxEdge[axis]) {
          pullCoefficient = this.surface.options.boundaryPullSpring<= this.surface.options.boundarySpring
            ? (this.surface.options.boundaryPullSpring / this.surface.options.boundarySpring) / 2
            : 1 - ((this.surface.options.boundarySpring / this.surface.options.boundaryPullSpring) / 2);
        }

        const positionDelta = pullCoefficient * (app.cursor[axis] === undefined || app.cursorLast[axis] === undefined ? 0 : app.cursor[axis] - app.cursorLast[axis]);
        this[`position${axis}`] += positionDelta;
        const newVelocity = toMeters(positionDelta, scale) / timeDelta;
        const velocityDelta = newVelocity - this[axis].velocity;
        this[axis].velocity = newVelocity;
        this[axis].acceleration = velocityDelta / timeDelta;
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

        if (this[axis].hittingMin || this[axis].hittingMax && newVelocity * this[axis].velocity <= 0) {
          this[axis].occilationAmplitudes.push(Math.abs((this[axis].hittingMax ? this.maxEdge[axis] : this.minEdge[axis]) - this[axis].position));
        }

        this[axis].velocity = newVelocity * this[axis].velocity <= 0 && !(this[axis].hittingMin || this[axis].hittingMax) ? 0 : newVelocity;

        if (this[axis].occilationAmplitudes.length >= 5) {
          let total = 0;
          for (let i = this[axis].occilationAmplitudes.length - 1; i >= this[axis].occilationAmplitudes.length - 6; i--) {
            total += this[axis].occilationAmplitudes[i];
          }

          if (total / 5 < 1) {
            this[axis].velocity = 0;
            // set position exactly as it should be on the limit
            this[`position${axis}`] = this[axis].hittingMax ? this.maxEdge[axis] : this.minEdge[axis];
          }
        }

        if (this[axis].velocity === 0) this[axis].settled = true;
      }
    });
  }

  onPositionChange(fn) {
    this.positionCallbacks.push(fn);
    this.callPositionCallbacks();
  }

  // add a callback to be called when a boundary is hit
  onBoundaryContact(boundary, fn) {
    this.boundaryCallbacks[boundary].push(fn);
  }

  // internal funcs

  callBoundaryCallbacks(boundary) {
    this.boundaryCallbacks[boundary].forEach(fn => fn());
  }

  callPositionCallbacks() {
    const x = this.x.position;
    const y = this.y.position;
    const xd = this.maxEdge.x - this.minEdge.x;
    const yd = this.maxEdge.y - this.minEdge.y;
    this.positionCallbacks.forEach(fn => fn({x, y, xp: (x - this.minEdge.x) / xd, yp: (y - this.minEdge.y) / yd}));
  }
}