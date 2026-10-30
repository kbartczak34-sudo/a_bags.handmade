export type AbagsCamera = { rotation: { x: number; y: number }; zoom: number };
export type AbagsCameraLimits = { minZoom: number; maxZoom: number };
type Point = { x: number; y: number };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** A gesture is rebased whenever a finger joins or leaves, so the camera never jumps. */
export class AbagsCameraGesture {
  private points = new Map<number, Point>();
  private drag: (Point & { rotation: AbagsCamera["rotation"] }) | null = null;
  private pinch: { distance: number; zoom: number } | null = null;

  constructor(private limits: AbagsCameraLimits) {}

  private rebase(camera: AbagsCamera) {
    const points = [...this.points.values()];
    this.drag = points.length === 1 ? { ...points[0], rotation: { ...camera.rotation } } : null;
    this.pinch = points.length >= 2
      ? { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom: camera.zoom }
      : null;
  }

  start(id: number, x: number, y: number, camera: AbagsCamera) {
    this.points.set(id, { x, y });
    this.rebase(camera);
  }

  move(id: number, x: number, y: number, camera: AbagsCamera): AbagsCamera | null {
    if (!this.points.has(id)) return null;
    this.points.set(id, { x, y });
    if (this.pinch) {
      const [first, second] = [...this.points.values()];
      // Coincident touches need a new baseline before they can define a scale.
      if (this.pinch.distance < 1) { this.rebase(camera); return null; }
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      return { ...camera, zoom: clamp(this.pinch.zoom * distance / this.pinch.distance, this.limits.minZoom, this.limits.maxZoom) };
    }
    if (!this.drag) return null;
    return { ...camera, rotation: {
      x: clamp(this.drag.rotation.x + (y - this.drag.y) * .008, -.72, .56),
      y: this.drag.rotation.y + (x - this.drag.x) * .012,
    } };
  }

  end(id: number, camera: AbagsCamera) {
    if (!this.points.delete(id)) return;
    this.rebase(camera);
  }

  clear() {
    this.points.clear();
    this.drag = null;
    this.pinch = null;
  }
}

export function wheelCameraZoom(zoom: number, deltaY: number, deltaMode: number, pageHeight: number, limits: AbagsCameraLimits) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, pageHeight) : 1);
  // Equal opposite wheel movements restore the same scale. Bound a single
  // device event so page-mode wheels cannot jump straight from minimum to maximum.
  return clamp(zoom * Math.exp(-clamp(pixels, -240, 240) * .0015), limits.minZoom, limits.maxZoom);
}

export function keyboardCamera(key: string, camera: AbagsCamera, defaults: AbagsCamera, limits: AbagsCameraLimits, fine = false): AbagsCamera | null {
  const step = fine ? .04 : .12;
  switch (key) {
    case "ArrowLeft": return { ...camera, rotation: { ...camera.rotation, y: camera.rotation.y - step } };
    case "ArrowRight": return { ...camera, rotation: { ...camera.rotation, y: camera.rotation.y + step } };
    case "ArrowUp": return { ...camera, rotation: { ...camera.rotation, x: clamp(camera.rotation.x - step, -.72, .56) } };
    case "ArrowDown": return { ...camera, rotation: { ...camera.rotation, x: clamp(camera.rotation.x + step, -.72, .56) } };
    case "+": case "=": return { ...camera, zoom: clamp(camera.zoom + .10, limits.minZoom, limits.maxZoom) };
    case "-": case "_": return { ...camera, zoom: clamp(camera.zoom - .10, limits.minZoom, limits.maxZoom) };
    case "Home": return { rotation: { ...defaults.rotation }, zoom: defaults.zoom };
    default: return null;
  }
}
