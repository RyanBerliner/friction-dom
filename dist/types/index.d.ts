declare module "types" {
    export type Coordinate = {
        x: number;
        y: number;
    };
    export type AppTouchEvent = TouchEvent;
}
declare module "utils" {
    /**
     * meters/sec/sec
     */
    export const gravity: number;
    export function toMeters(px: number, scale: number): number;
    export function toPixels(meters: number, scale: number): number;
    export function toSeconds(milli: number): number;
}
declare module "Surface" {
    import { Coordinate } from "types";
    import { SurfaceObject } from "SurfaceObject";
    type SurfacePadding = number | (() => number);
    type SurfaceOptions = {
        /**
         * The number of px that represent 1 meter
         */
        scale: number;
        /**
         * Spring constant in N/m
         */
        boundarySpring: number;
        /**
         * N/meters/sec damping coefficient
         */
        boundarySpringDamping: number;
        /**
         * Spring constant N/m
         */
        boundaryPullSpring: number;
        /**
         * Percentage of overshoot for programtic animations
         */
        overshoot: number;
        paddingMinX: SurfacePadding;
        paddingMinY: SurfacePadding;
        paddingMaxX: SurfacePadding;
        paddingMaxY: SurfacePadding;
    };
    type SurfaceBounds = typeof window | HTMLElement | Array<Coordinate> | string;
    export class Surface {
        element: SurfaceBounds;
        surfaceObjects: Array<SurfaceObject>;
        resizeTimeout: ReturnType<typeof setTimeout>;
        options: SurfaceOptions;
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        constructor(element: SurfaceBounds, options: Partial<SurfaceOptions>);
        resizeListener(): void;
        parsePadding(padding: SurfacePadding): number;
        setEdges(): void;
    }
}
declare module "SurfaceObject" {
    import type { AppTouchEvent, Coordinate } from "types";
    import { Surface } from "Surface";
    type Axis = 'x' | 'y';
    type Boundary = 'x-min' | 'x-max' | 'y-min' | 'y-max';
    type SurfaceObjectOptions = {
        /**
         * kg
         */
        mass: number;
        friction: number;
        axis: Axis | Array<Axis>;
        xProp: string;
        yProp: string;
        contained: boolean;
        /**
         * At what threshold should we nudge the object to an edge
         */
        nudgeThreshold: number;
        initialPosition: Boundary | Array<Boundary>;
    };
    type AxisState = {
        /**
         * meters/sec/sec
         */
        acceleration: number;
        /**
         * meters/sec
         */
        velocity: number;
        /**
         * Relative position in pixels
         */
        position: number;
        settled: boolean;
        hittingMin: boolean;
        hittingMax: boolean;
        previousDisplacements: Array<number>;
    };
    type BoundaryCallbacks = {
        'x-min': Array<((() => void))>;
        'x-max': Array<((() => void))>;
        'y-min': Array<((() => void))>;
        'y-max': Array<((() => void))>;
    };
    type PositionDetails = {
        /**
         * x position as absolute pixels
         */
        x: number;
        /**
         * y position as absolute pixels
         */
        y: number;
        /**
         * x position as percentage of complete range of motion
         */
        xp: number;
        /**
         * y position as percentage of complete range of motion
         */
        yp: number;
    };
    type GoToInfo = {
        /**
         * x velocity in m/s
         */
        x: number;
        /**
         * y velocity in m/s
         */
        y: number;
    };
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
        positionCallbacks: Array<((details: PositionDetails) => void)>;
        _dragging: boolean;
        constructor(element: HTMLElement | string, surface: Surface, options: Partial<SurfaceObjectOptions>);
        get minEdge(): Coordinate;
        get maxEdge(): Coordinate;
        get dragging(): boolean;
        set dragging(d: boolean);
        get positionx(): number;
        set positionx(p: number);
        get positiony(): number;
        set positiony(p: number);
        get settled(): boolean;
        get axis(): Array<Axis>;
        resetAxis(axis: Axis): void;
        startMove(event: TouchEvent | MouseEvent): void;
        closestSettlePoint(): Array<Boundary>;
        endMove(performEvent: boolean): void;
        goto(boundary: Boundary | Array<Boundary>, overshootOverride?: number, justInfo?: boolean, instant?: boolean): void | GoToInfo;
        updateMotion(timeDelta: number): void;
        onPositionChange(fn: ((details: PositionDetails) => void)): void;
        onBoundaryContact(boundary: Boundary, fn: (() => void)): void;
        callBoundaryCallbacks(boundary: Boundary): void;
        callPositionCallbacks(): void;
    }
}
declare module "FrictionDOM" {
    import type { AppTouchEvent, Coordinate } from "types";
    import { SurfaceObject } from "SurfaceObject";
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
        constructor();
        addActiveSurfaceObject(obj: SurfaceObject): void;
        addDraggingSurfaceObjects(obj: SurfaceObject): void;
        beginMotion(withObject?: SurfaceObject): void;
        updateMotion(): void;
        startMove(preventDefault: boolean, event: AppTouchEvent | MouseEvent, surfaceObject: SurfaceObject): void;
        move(event: AppTouchEvent | MouseEvent): void;
        endMove(_: AppTouchEvent | MouseEvent, forScrolling: boolean): void;
    }
    export const app: FrictionDOM;
}
declare module "index" {
    export { Surface } from "Surface";
    export { SurfaceObject } from "SurfaceObject";
}
//# sourceMappingURL=index.d.ts.map