export class Surface {
  constructor(element, options) {
    this.element = element; // dom element, window, or [[min x, max x], [min y, max y]]
    this.surfaceObjects = [];
    this.resizeTimeout;
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

    window.addEventListener('resize', this.resizeListener.bind(this));
  }

  resizeListener() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.setEdges();
    }, 500);
  }

  getOrCall(variable) {
    if (typeof(variable) === 'function') return variable();
    return variable;
  }

  setEdges() {
    const { paddingMinX, paddingMinY, paddingMaxX, paddingMaxY } = this.options;

    if (Array.isArray(this.element)) {
      this.minX = this.element[0][0];
      this.maxX = this.element[0][1];
      this.minY = this.element[1][0];
      this.maxY = this.element[1][1];
    } else {
      this.minX = 0;
      this.minY = 0;

      if (this.element === window) {
        this.maxX = window.innerWidth;
        this.maxY = window.innerHeight;
      } else {
        this.maxX = this.element.offsetWidth;
        this.maxY = this.element.offsetHeight;
      }
    }

    this.minX += this.getOrCall(paddingMinX);
    this.minY += this.getOrCall(paddingMinY);
    this.maxX -= this.getOrCall(paddingMaxX);
    this.maxY -= this.getOrCall(paddingMaxY);

    this.surfaceObjects.forEach(obj => {
      obj.goto(obj.closestSettlePoint(), 0, false, true);
    });
  }
}