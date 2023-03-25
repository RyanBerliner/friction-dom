export class Surface {
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
    }

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