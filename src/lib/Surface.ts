import { Coordinate } from "./types";
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

type SurfaceBounds = typeof window | HTMLElement | Array<Coordinate>;

export class Surface {
  element: SurfaceBounds;
  surfaceObjects: Array<SurfaceObject>;
  resizeTimeout: ReturnType<typeof setTimeout>;
  options: SurfaceOptions;

  minX: number;
  maxX: number;
  minY: number;
  maxY: number;

  constructor(element: SurfaceBounds, options: Partial<SurfaceOptions>) {
    this.element = element;
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
      this.minX = this.element[0].x;
      this.minY = this.element[0].y;
      this.maxX = this.element[1].x;
      this.maxY = this.element[1].y;
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