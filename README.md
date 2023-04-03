# Friction DOM

Treat DOM elements like objects sliding around on the page.

## The API

Everything is either a `Surface` or a `SurfaceObject`. A `Surface` can contain contain many `SurfaceObject`s and a `SurfaceObject` **must** belong to a `Surface`.

### Surface

This is what defines the boundaries of motions for `SurfaceObjects`. This can be a DOM node, the window, or manually specified bounds.

### SurfaceObject

These are the objects that do the moving. They move withing the bounds of the `SurfaceObject` that they below to.