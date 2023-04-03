import { SurfaceObject } from "./SurfaceObject";

type SurfacePadding = number | (() => number);

type SurfaceOptions = {
  /**
   * The number of px that represent 1 meter
   */
  scale: number,
  /**
   * Spring constant in N/m
   */
  boundarySpring: number,
  /**
   * N/meters/sec damping coefficient
   */
  boundarySpringDamping: number,
  /**
   * Spring constant N/m
   */
  boundaryPullSpring: number,
  /**
   * Percentage of overshoot for programtic animations
   */
  overshoot: number,
  paddingMinX: SurfacePadding,
  paddingMinY: SurfacePadding,
  paddingMaxX: SurfacePadding,
  paddingMaxY: SurfacePadding,
};

export class Surface {
  element: HTMLElement | typeof window; // TODO: need to add the range option as well
  surfaceObjects: Array<SurfaceObject>;
  resizeTimeout: ReturnType<typeof setTimeout>;
  options: SurfaceOptions;

  minX: number;
  maxX: number;
  minY: number;
  maxY: number;

  constructor(element: HTMLElement, options: Partial<SurfaceOptions>) {
    this.element = element; // [[min x, max x], [min y, max y]]
    this.surfaceObjects = [];
    this.resizeTimeout;

    this.options = {
      scale: 526,
      boundarySpring: 0.16,
      boundarySpringDamping: 5,
      boundaryPullSpring: 0.08,
      overshoot: 0,
      paddingMinX: 0,
      paddingMinY: 0,
      paddingMaxX: 0,
      paddingMaxY: 0,
      ...(options || {}), // allow overriding defaults
    }

    this.setEdges();

    window.addEventListener('resize', this.resizeListener.bind(this));
  }

  resizeListener(): void {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.setEdges();
    }, 500);
  }

  parsePadding(padding: SurfacePadding): number {
    if (typeof(padding) === 'function') return padding();
    return padding;
  }

  setEdges(): void {
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
      } else if (this.element instanceof HTMLElement) {
        this.maxX = this.element.offsetWidth;
        this.maxY = this.element.offsetHeight;
      }
    }

    this.minX += this.parsePadding(paddingMinX);
    this.minY += this.parsePadding(paddingMinY);
    this.maxX -= this.parsePadding(paddingMaxX);
    this.maxY -= this.parsePadding(paddingMaxY);

    this.surfaceObjects.forEach(obj => {
      obj.goto(obj.closestSettlePoint(), 0, false, true);
    });
  }
}