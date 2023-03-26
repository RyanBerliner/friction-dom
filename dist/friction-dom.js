(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FrictionDOM = {}));
})(this, (function (exports) { 'use strict';

  class Surface {
    constructor(element, options) {
      this.element = element;
      this.surfaceObjects = [];
      this.options = {
        scale: 526, // how many px represent 1 meter
        boundarySpring: 0.16, // spring constant N/m
        boundarySpringDamping: 5, // N/meters/sec damping coefficient
        boundaryPullSpring: 0.08, // spring constant N/m
        overshoot: 0, // percentage of overshoot for programatic animations
        paddingMinX: 0,
        paddingMinY: 0,
        paddingMaxX: 0,
        paddingMaxY: 0,
        ...(options || {}), // allow overriding defaults
      };

      this.setEdges();

      window.addEventListener('resize', this.setEdges.bind(this));
    }

    getOrCall(variable) {
      if (typeof(variable) === 'function') return variable();
      return variable;
    }

    setEdges() {
      const { paddingMinX, paddingMinY, paddingMaxX, paddingMaxY } = this.options;
      this.minX = 0 + this.getOrCall(paddingMinX);
      this.minY = 0 + this.getOrCall(paddingMinY);

      if (this.element === window) {
        this.maxX = window.innerWidth;
        this.maxY = window.innerHeight;
      } else {
        this.maxX = this.element.offsetWidth;
        this.maxY = this.element.offsetHeight;
      }

      this.maxX -= this.getOrCall(paddingMaxX);
      this.maxY -= this.getOrCall(paddingMaxY);

      this.surfaceObjects.forEach(obj => {
        obj.goto(obj.closestSettlePoint(), 0);
      });
    }

    get minX() { return this._minX; }
    set minX(x) { this._minX = x; }
    get minY() { return this._minY; }
    set minY(y) { this._minY = y; }
    get maxX() { return this._maxX; }
    set maxX(x) { this._maxX = x; }
    get maxY() { return this._maxY; }
    set maxY(y) { this._maxY = y; }
  }

  const gravity = 9.8; // meters/sec/sec

  function toMeters(px, scale) { return px / scale }function toPixels(meters, scale) { return meters * scale }function toSeconds(milli) { return milli / 1000 }

  class FrictionDOM {
    constructor() {
      this.cursor = {x: 0, y: 0};
      this.cursorLast = {...this.cursor};

      this.rafStart = undefined;
      this.rafLast = undefined;
      this.raf = undefined;

      this.draggingSurfaceObjects = [];
      this.activeSurfaceObjects = [];

      document.addEventListener('mousemove', this.move.bind(this));
      document.addEventListener('touchmove', this.move.bind(this));

      document.addEventListener('mouseup', this.endMove.bind(this));
      document.addEventListener('touchend', this.endMove.bind(this));
    }

    addActiveSurfaceObject(obj) {
      const found = this.activeSurfaceObjects.indexOf(obj) > -1;
      if (!found) this.activeSurfaceObjects.push(obj);
    }

    addDraggingSurfaceObjects(obj) {
      const found = this.draggingSurfaceObjects.indexOf(obj) > -1;
      if (!found) this.draggingSurfaceObjects.push(obj);
    }

    beginMotion(withObject) {
      this.rafStart = toSeconds(performance.now());
      this.rafLast = toSeconds(performance.now());

      withObject && this.addActiveSurfaceObject(withObject);

      window.cancelAnimationFrame(this.raf);
      this.raf = window.requestAnimationFrame(this.updateMotion.bind(this));
    }

    updateMotion() {
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
      this.raf = window.requestAnimationFrame(this.updateMotion.bind(this));
    }

    startMove(event, surfaceObject) {
      event.preventDefault();

      this.addDraggingSurfaceObjects(surfaceObject);
      this.addActiveSurfaceObject(surfaceObject);

      if (event.targetTouches) {
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

    move(event) {
      if (event.targetTouches) {
        const {screenX, screenY} = event.targetTouches[0];
        this.cursor.x = screenX;
        this.cursor.y = screenY;
      } else {
        this.cursor.x = event.clientX;
        this.cursor.y = event.clientY;
      }
    }

    endMove(event) {
      for (let i = this.draggingSurfaceObjects.length - 1; i >= 0; i--) {
        this.draggingSurfaceObjects[i].endMove(event);
        this.draggingSurfaceObjects.splice(i, 0);
      }
    }
  }

  // this is an internal export
  const app = new FrictionDOM();

  class SurfaceObject {
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
        contained: true,
        nudgeThreshold: 0, // at what threshold should we nugle the object to an edge (don't let it float)
        ...(options || {}), // allow overriding defaults
      };

      const axisState = {
        acceleration: 0, // meters/sec/sec
        velocity: 0, // meters/sec
        position: 0, // relative position in pixels
        settled: true,
        hittingMin: false,
        hittingMax: false,
        occilationAmplitudes: [],
      };

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
    set positionx(p) { this.x.position = p; this.element.style.left = p + 'px'; this.callPositionCallbacks(); }

    get positiony() { return this.y.position; }
    set positiony(p) { this.y.position = p; this.element.style.top = p + 'px'; this.callPositionCallbacks(); }

    get settled() { return this.x.settled && this.y.settled; }

    get axis() { return this.options.axis.split(','); }

    resetAxis(axis) {
      this[axis].settled = false;
      this[axis].hittingMin = false;
      this[axis].hittingMax = false;
      this[axis].occilationAmplitudes = [];
    }

    startMove(event) {
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
        if (position < this.minEdge[axis]) {
          settlePoint.push(`${axis}-min`);
        }

        if (position > this.maxEdge[axis]) {
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

        // TODO: mabe don't overshhot here?
        const infoWithOvershoot = {
          min: this.goto(`${axis}-min`, undefined, true),
          max: this.goto(`${axis}-max`, undefined, true),
        };

        if (Math.abs(velocity) < Math.abs(info[dir][axis])) {
          let positionPercentage = ((this[axis].position - this.minEdge[axis]) / (this.maxEdge[axis] - this.minEdge[axis])) * 100;
          // this is not working properly, we need to know which edge the item started 
          // closest to in order to know which to snap back to
          const closestEdge = positionPercentage > 50 ? 'max' : 'min';
          const opClosestEdge = positionPercentage <= 50 ? 'max' : 'min';
          positionPercentage = positionPercentage > 50 ? 100 - positionPercentage : positionPercentage;
          this[axis].velocity = infoWithOvershoot[positionPercentage < nudgeThreshold ? closestEdge : opClosestEdge][axis];
        }
      });

      if (this.x.velocity === 0) this.x.settled = true;
      if (this.y.velocity === 0) this.y.settled = true;
    }

    goto(direction, overshootOverride, justInfo) {
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
        positionDelta *= (1 + ((overshoot) / 100));

        info[axis] = Math.sqrt(2 * ((frictionForce * frictionMultiplier) / mass) * Math.abs(positionDelta));
        info[axis] *= positionDelta >= 0 ? 1 : -1;

        if (!justInfo) {
          this.resetAxis(axis);
          this[axis].velocity = info[axis];
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
          frictionForce *= axisCoefficients[axis]; // friction is inline with vector magnitude, so we need to adjust

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

  exports.Surface = Surface;
  exports.SurfaceObject = SurfaceObject;

}));
//# sourceMappingURL=friction-dom.js.map
