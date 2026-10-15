type Point3 = [number, number, number];
type Rotation = { x: number; y: number };

/** Project accessory details through the same camera and matrix order as Fidelity3D. */
export function projectFidelityPoint(point: Point3, width: number, height: number, rotation: Rotation, zoom: number) {
  const aspect = width / Math.max(1, height);
  let [x, y, z] = point.map((value) => value * zoom) as Point3;

  // root = scale(zoom) * rotX * rotY: apply yaw before pitch.
  const cy = Math.cos(rotation.y);
  const sy = Math.sin(rotation.y);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cx = Math.cos(rotation.x);
  const sx = Math.sin(rotation.x);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];

  y -= 0.02;
  z -= 5.0;
  if (z >= -0.08) return null;

  const f = 1 / Math.tan((Math.PI / 5.3) / 2);
  return {
    x: ((x * f / aspect) / -z * 0.5 + 0.5) * width,
    y: (0.5 - (y * f) / -z * 0.5) * height,
    scale: Math.max(0.25, Math.min(2.2, (f / -z) * zoom)),
  };
}
