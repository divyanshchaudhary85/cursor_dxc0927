import * as THREE from "three";

/** A shallow-sag catenary approximated as a parabola in the vertical plane
 * containing the two end points (accurate to within a few % for typical
 * transmission spans, and visually indistinguishable). */
export class SpanCurve extends THREE.Curve<THREE.Vector3> {
  start: THREE.Vector3;
  end: THREE.Vector3;
  sag: number;

  constructor(start: THREE.Vector3, end: THREE.Vector3, sag: number) {
    super();
    this.start = start;
    this.end = end;
    this.sag = sag;
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const x = THREE.MathUtils.lerp(this.start.x, this.end.x, t);
    const z = THREE.MathUtils.lerp(this.start.z, this.end.z, t);
    const baseY = THREE.MathUtils.lerp(this.start.y, this.end.y, t);
    const sagY = 4 * this.sag * t * (1 - t);
    return target.set(x, baseY - sagY, z);
  }
}

export interface SpanBundle {
  group: THREE.Group;
  /** One curve per sub-conductor in the bundle, used for geometry and particles. */
  curves: SpanCurve[];
  meshes: THREE.Mesh[];
  /** Un-offset centerline endpoints (the bundle centroid), kept stable across rebuilds. */
  baseStart: THREE.Vector3;
  baseEnd: THREE.Vector3;
  rebuild: (sag: number) => void;
}

const BUNDLE_OFFSETS_4: THREE.Vector2[] = [
  new THREE.Vector2(0.23, 0.23),
  new THREE.Vector2(0.23, -0.23),
  new THREE.Vector2(-0.23, -0.23),
  new THREE.Vector2(-0.23, 0.23),
];

export function buildSpanBundle(
  start: THREE.Vector3,
  end: THREE.Vector3,
  sag: number,
  material: THREE.Material,
  subRadius = 0.045,
  offsets: THREE.Vector2[] = BUNDLE_OFFSETS_4
): SpanBundle {
  const group = new THREE.Group();
  group.name = "span-bundle";

  const curves: SpanCurve[] = [];
  const meshes: THREE.Mesh[] = [];

  const tubeSegments = 36;

  for (const off of offsets) {
    const s = start.clone();
    s.x += off.x;
    s.y += off.y;
    const e = end.clone();
    e.x += off.x;
    e.y += off.y;
    const curve = new SpanCurve(s, e, sag);
    const geom = new THREE.TubeGeometry(curve, tubeSegments, subRadius, 6, false);
    const mesh = new THREE.Mesh(geom, material);
    group.add(mesh);
    curves.push(curve);
    meshes.push(mesh);
  }

  const rebuild = (newSag: number) => {
    for (let i = 0; i < offsets.length; i++) {
      curves[i].sag = newSag;
      const oldGeom = meshes[i].geometry;
      meshes[i].geometry = new THREE.TubeGeometry(curves[i], tubeSegments, subRadius, 6, false);
      oldGeom.dispose();
    }
  };

  return { group, curves, meshes, baseStart: start.clone(), baseEnd: end.clone(), rebuild };
}
