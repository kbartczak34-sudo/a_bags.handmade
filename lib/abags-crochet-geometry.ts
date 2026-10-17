import { ABAGS_FIDELITY_V4_FAMILY_SPECS, type FidelityV4Family } from "./abags-fidelity-v4-family-spec";

export type CrochetCordMeshData = {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

type Vec3 = [number, number, number];
type CordPoint = [number, number, number];

const TUBE_SIDES = 8;
const MAX_CHUNK_VERTICES = 60_000;
const FACE_INSET = 0.935;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const normalize = ([x, y, z]: Vec3): Vec3 => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const hash = (row: number, column: number) => {
  const value = Math.sin(row * 127.1 + column * 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const emptyMesh = (): CrochetCordMeshData => ({ positions: [], normals: [], uvs: [], indices: [] });

/**
 * Pure sampling contract shared with the canonical Fidelity3D body:
 * superellipse/taper from the family spec, 0.935 fabric inset, five-strip
 * quarter-ellipse edge roll, equal front/back dome and coherent cloth offsets.
 * Coordinates are BODY-LOCAL; integration applies the shell's bodyY transform.
 * This is procedural cord geometry, not a measured or scanned digital twin.
 */
function bodySampler(family: FidelityV4Family) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : 1.42;
  const bevel = Math.min(spec.bevel, spec.depth * 0.14);
  const radius = spec.rx * (0.005 / 0.16);

  const depthAt = (y: number) => {
    const yn = clamp(y / spec.ry, -1, 1);
    const belly = 1 + Math.sin((1 - Math.abs(yn)) * Math.PI * 0.5) * (0.035 + spec.depth * 0.035);
    return spec.depth * depthScale * belly * (1 - Math.max(0, yn) * 0.04);
  };
  const softness = (x: number, y: number) => {
    const xn = clamp(x / spec.rx, -1, 1), yn = clamp(y / spec.ry, -1, 1);
    const center = 1 - xn * xn;
    const lower = Math.pow(clamp((-yn + 0.02) / 1.02, 0, 1), 1.45);
    const soft = (0.022 + spec.ry * 0.018) * spec.softnessFactor;
    const sag = -soft * center * lower;
    const lip = -soft * 0.48 * center * Math.pow(Math.max(0, yn), 5) * (1 + 0.12 * Math.sin(xn * 4.2));
    const bulge = spec.depth * depthScale * (0.018 + 0.018 * spec.softnessFactor) * center * (1 - Math.abs(yn)) * (0.72 + 0.28 * lower);
    const folds = Math.sin(xn * 4.1 + yn * 1.6 + 0.3) + 0.35 * Math.sin(xn * 7.2 - yn * 3.4);
    return { y: sag + lip, z: bulge + 0.007 * spec.softnessFactor * center * Math.max(0, 1 - yn * yn) * folds };
  };
  // Invert the scaled/tapered contour used by the shell's radial fabric bands.
  const radialFraction = (x: number, y: number) => {
    const xn = x / spec.rx, yn = y / spec.ry;
    let fraction = Math.pow(Math.pow(Math.abs(xn), spec.power) + Math.pow(Math.abs(yn), spec.power), 1 / spec.power);
    for (let iteration = 0; iteration < 5 && fraction > 1e-8; iteration++) {
      const untaperedX = xn / (1 + spec.taper * yn / fraction);
      fraction = Math.pow(Math.pow(Math.abs(untaperedX), spec.power) + Math.pow(Math.abs(yn), spec.power), 1 / spec.power);
    }
    return fraction;
  };
  const front = (x: number, rawY: number, side: 1 | -1, lift: number): Vec3 => {
    const soft = softness(x, rawY), y = rawY + soft.y;
    const fraction = radialFraction(x, rawY);
    let halfDepth: number;
    if (fraction <= FACE_INSET) {
      const dome = Math.max(0, 1 - Math.pow(fraction / FACE_INSET, 2));
      halfDepth = depthAt(y) * 0.5 - bevel + soft.z + spec.depth * 0.12 * depthScale * dome;
    } else {
      const angle = Math.asin(clamp((fraction - FACE_INSET) / (1 - FACE_INSET), 0, 1));
      halfDepth = depthAt(y) * 0.5 - 2 * bevel + bevel * Math.cos(angle) + soft.z;
    }
    return [x, y, side * (halfDepth + lift)];
  };
  return { spec, radius, bevel, depthAt, softness, radialFraction, front };
}

function quadratic(a: CordPoint, control: CordPoint, b: CordPoint, steps: number): CordPoint[] {
  const points: CordPoint[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps, s = 1 - t;
    points.push([0, 1, 2].map((axis) => s * s * a[axis] + 2 * s * t * control[axis] + t * t * b[axis]) as CordPoint);
  }
  return points;
}

/** Two rounded legs and a recessed return make one continuous hooked loop. */
function stitchLoop(stitch: number, row: number, column: number, steps = 8): CordPoint[] {
  const herringbone = stitch === 1;
  const widthScale = 1 + (hash(row + 73, column + 9) - 0.5) * 0.14;
  const heightScale = 1 + (hash(row + 17, column + 43) - 0.5) * 0.14;
  const lean = herringbone ? (row % 2 ? 0.15 : -0.15) : -0.025;
  const jitter = (hash(row, column) - 0.5) * 0.065;
  const left: CordPoint = [-0.42 + jitter, 0.50, 0.25];
  const bottom: CordPoint = [lean + jitter, -0.51, 0.35];
  const right: CordPoint = [0.42 + jitter, herringbone ? 0.40 : 0.50, 0.30];
  return [
    ...quadratic(left, [-0.39 + lean * 0.3, -0.12, 0.85], bottom, steps),
    ...quadratic(bottom, [0.34 + lean * 0.3, -0.16, 0.90], right, steps).slice(1),
    ...quadratic(right, [lean, herringbone ? 0.13 : 0.31, -2.0], left, 4).slice(1),
  ].map(([x, y, z]) => [x * widthScale, y * heightScale, z] as CordPoint);
}

function appendTube(chunks: CrochetCordMeshData[], path: Vec3[], radius: number, variation: number) {
  let mesh = chunks[chunks.length - 1];
  const vertices = path.length * (TUBE_SIDES + 1);
  if (mesh.positions.length / 3 + vertices > MAX_CHUNK_VERTICES) {
    mesh = emptyMesh(); chunks.push(mesh);
  }
  const start = mesh.positions.length / 3;
  let arcLength = 0;
  const last = path.length - 1;
  for (let sample = 0; sample < path.length; sample++) {
    const previous = path[sample === 0 ? last - 1 : sample - 1];
    const next = path[sample === last ? 1 : sample + 1];
    const tangent = normalize([next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]]);
    const reference: Vec3 = Math.abs(tangent[2]) < 0.85 ? [0, 0, 1] : [0, 1, 0];
    const across = normalize(cross(reference, tangent));
    const outward = normalize(cross(tangent, across));
    if (sample > 0) arcLength += Math.hypot(...path[sample].map((value, axis) => value - path[sample - 1][axis]));
    const spring = (1 + 0.035 * Math.sin(variation * 1.9))
      * (1 + 0.015 * Math.sin(variation + sample / last * Math.PI * 4));
    for (let radial = 0; radial <= TUBE_SIDES; radial++) {
      // A slow frame twist follows the rope. The cross section stays round;
      // fine filaments belong to the cord material rather than extra polygons.
      const angle = radial / TUBE_SIDES * Math.PI * 2 + variation * 0.17;
      const normal = normalize(across.map((value, axis) => value * Math.cos(angle) + outward[axis] * Math.sin(angle)) as Vec3);
      mesh.positions.push(...path[sample].map((value, axis) => value + normal[axis] * radius * spring));
      mesh.normals.push(...normal);
      // u is actual world arc length / nominal radius; v is circumference 0..1.
      mesh.uvs.push(arcLength / radius, radial / TUBE_SIDES);
    }
  }
  for (let sample = 0; sample < last; sample++) {
    for (let radial = 0; radial < TUBE_SIDES; radial++) {
      const a = start + sample * (TUBE_SIDES + 1) + radial, b = a + TUBE_SIDES + 1;
      mesh.indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
}

/**
 * Genuine round ~5 mm cord over both cloth panels and the physical gusset.
 * Classic and herringbone have separate hooked paths; other stitches retain
 * their existing surface renderer until their physical paths are implemented.
 * Every chunk fits WebGL1 Uint16 indices and ends between complete strands.
 */
export function createCrochetCordMeshes(family: FidelityV4Family, stitch: number): CrochetCordMeshData[] {
  if (stitch !== 0 && stitch !== 1) return [];
  const sample = bodySampler(family), { spec, radius } = sample;
  const chunks = [emptyMesh()];
  const columns = 18, rows = 16;
  const pitchX = spec.rx * 2 / columns, pitchY = spec.ry * 2 / rows;
  for (const side of [1, -1] as const) {
    for (let row = 0; row < rows; row++) {
      const centerY = -spec.ry + (row + 0.5) * pitchY;
      const stagger = row % 2 ? 0.5 : 0;
      for (let column = -1; column < columns; column++) {
        const centerX = -spec.rx + (column + 0.5 + stagger) * pitchX;
        const loop = stitchLoop(stitch, row, column);
        const path: Vec3[] = [];
        let inside = true;
        for (const [u, v, lift] of loop) {
          const x = centerX + u * pitchX, y = centerY + v * pitchY;
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
            if (sample.radialFraction(x + sx * radius * 1.04, y + sy * radius * 1.04) > 0.99) inside = false;
          }
          path.push(sample.front(x, y, side, radius * (0.37 + lift)));
        }
        if (inside) appendTube(chunks, path, radius, hash(row, column) * Math.PI * 2);
      }
    }
  }

  // Arc-length parameterization follows the SAME 96-sided body contour. The
  // gusset has its own loops, not front-panel UVs stretched through its depth.
  const contour: Array<[number, number]> = [];
  const lengths = [0];
  for (let i = 0; i < 96; i++) {
    const theta = i / 96 * Math.PI * 2, cos = Math.cos(theta), sin = Math.sin(theta);
    const y = Math.sign(sin) * Math.pow(Math.abs(sin), 2 / spec.power) * spec.ry;
    contour.push([Math.sign(cos) * Math.pow(Math.abs(cos), 2 / spec.power) * spec.rx * (1 + spec.taper * y / spec.ry), y]);
  }
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    lengths.push(lengths[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const perimeter = lengths[lengths.length - 1];
  const around = Math.round(perimeter / pitchY);
  const depthRows = Math.max(3, Math.round((spec.depth - sample.bevel * 4) / pitchX * (family === "tote" ? 1.78 : family === "round" ? 1.34 : family === "bucket" ? 1.52 : 1.42)));
  const along = (distance: number) => {
    const wrapped = ((distance % perimeter) + perimeter) % perimeter;
    let index = 0;
    while (index < contour.length - 1 && wrapped > lengths[index + 1]) index++;
    const a = contour[index], b = contour[(index + 1) % contour.length];
    const fraction = (wrapped - lengths[index]) / Math.max(1e-8, lengths[index + 1] - lengths[index]);
    const normal = normalize([b[1] - a[1], a[0] - b[0], 0]);
    return { x: a[0] + (b[0] - a[0]) * fraction, y: a[1] + (b[1] - a[1]) * fraction, normal };
  };
  for (let row = 0; row < depthRows; row++) {
    for (let column = 0; column < around; column++) {
      const center = (column + 0.5 + (row % 2 ? 0.5 : 0)) * perimeter / around;
      const path: Vec3[] = [];
      let inside = true;
      // Fewer longitudinal samples suffice on the narrower gusset; every cord
      // still has a full rounded cross section and a recessed return.
      for (const [u, v, lift] of stitchLoop(stitch, row, column, 5)) {
        const arc = along(center + u * perimeter / around);
        if (arc.y > spec.ry * 0.88 || arc.y < -spec.ry * 0.98) inside = false;
        const soft = sample.softness(arc.x, arc.y), y = arc.y + soft.y;
        const halfDepth = sample.depthAt(y) * 0.5 - 2 * sample.bevel + soft.z;
        const depth = (row + 0.5 + v * 0.82) / depthRows;
        const liftOut = radius * (0.12 + lift * 0.55);
        // Compress the gusset's cord very slightly into the shell boundary so
        // the cloth relief keeps the family's established external width.
        path.push([arc.x + arc.normal[0] * liftOut, y + arc.normal[1] * liftOut, (1 - depth * 2) * (halfDepth - radius * 0.8)]);
      }
      if (inside) appendTube(chunks, path, radius, hash(row + 31, column) * Math.PI * 2);
    }
  }
  // A crocheted panel rolls into its gusset through two entwined edge cords.
  // Follow each panel's own closed outline, including its upper lip; never
  // span front-to-back across the open mouth with a strip or a cap.
  const borderSamples = 384;
  const braidTurns = Math.max(24, Math.round(perimeter / (radius * 5.4)));
  for (const side of [1, -1] as const) {
    for (let strand = 0; strand < 2; strand++) {
      const path: Vec3[] = [];
      for (let step = 0; step <= borderSamples; step++) {
        const arc = along(step / borderSamples * perimeter);
        const phase = step / borderSamples * Math.PI * 2 * braidTurns + strand * Math.PI;
        const radialOffset = Math.sin(phase) * radius * 0.45;
        const x = arc.x * 0.958 + arc.normal[0] * radialOffset;
        const rawY = arc.y * 0.958 + arc.normal[1] * radialOffset;
        const lift = radius * (0.40 + Math.cos(phase) * 0.38);
        path.push(sample.front(x, rawY, side, lift));
      }
      appendTube(chunks, path, radius * 0.60, strand * Math.PI + 0.37);
    }
  }
  return chunks.filter((mesh) => mesh.positions.length > 0);
}
