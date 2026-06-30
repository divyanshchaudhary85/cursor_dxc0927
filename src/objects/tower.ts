import * as THREE from "three";
import { steelDarkMaterial, steelMaterial } from "./materials";

export interface TowerSpec {
  height: number; // total height, m
  baseHalfWidth: number; // half-width of the lattice base, m
  bodyTopHalfWidth: number; // half-width of the lattice just below the cross-arm, m
  crossArmY: number; // height of the main cross-arm above ground, m
  crossArmHalfSpan: number; // half distance between outer phase attachments, m
  legThickness: number;
}

export const STANDARD_765KV_TOWER: TowerSpec = {
  height: 42,
  baseHalfWidth: 6.5,
  bodyTopHalfWidth: 1.6,
  crossArmY: 34,
  crossArmHalfSpan: 8.5,
  legThickness: 0.35,
};

export interface BuiltTower {
  group: THREE.Group;
  /** Local-space attachment points (one per phase) at the cross-arm, relative to the tower's origin (ground level). */
  attachmentPoints: THREE.Vector3[];
}

function legWidthAt(spec: TowerSpec, y: number): number {
  const t = THREE.MathUtils.clamp(y / spec.crossArmY, 0, 1);
  return THREE.MathUtils.lerp(spec.baseHalfWidth, spec.bodyTopHalfWidth, t);
}

/** Builds a simplified steel lattice (self-supporting) tower with a single
 * horizontal cross-arm carrying three phase attachment points, typical of a
 * single-circuit 765 kV suspension structure. */
export function buildTower(spec: TowerSpec): BuiltTower {
  const group = new THREE.Group();
  group.name = "tower";

  const legSign: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  const segments = 7;
  const braceMatGroup: THREE.Object3D[] = [];

  for (const [sx, sz] of legSign) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const y = (i / segments) * spec.crossArmY;
      const w = legWidthAt(spec, y);
      points.push(new THREE.Vector3(sx * w, y, sz * w));
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const seg = makeBeam(a, b, spec.legThickness, steelMaterial);
      group.add(seg);
    }
    // Vertical mast above the cross-arm down to body-top width.
    const topW = spec.bodyTopHalfWidth;
    const peak = new THREE.Vector3(sx * topW * 0.4, spec.height, sz * topW * 0.4);
    const crossArmPt = new THREE.Vector3(sx * topW, spec.crossArmY, sz * topW);
    group.add(makeBeam(crossArmPt, peak, spec.legThickness * 0.7, steelDarkMaterial));
  }

  // X-braces between adjacent legs at several heights for lattice look.
  const braceHeights = [0.18, 0.38, 0.58, 0.78, 0.95];
  for (const h of braceHeights) {
    const y = h * spec.crossArmY;
    const w = legWidthAt(spec, y);
    const corners = [
      new THREE.Vector3(w, y, w),
      new THREE.Vector3(w, y, -w),
      new THREE.Vector3(-w, y, -w),
      new THREE.Vector3(-w, y, w),
    ];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      braceMatGroup.push(makeBeam(a, b, spec.legThickness * 0.55, steelDarkMaterial));
    }
  }
  for (const b of braceMatGroup) group.add(b);

  // Cross-arm: a horizontal beam at crossArmY carrying 3 attachment points.
  const armHalf = spec.crossArmHalfSpan;
  const armY = spec.crossArmY;
  const armBeam = makeBeam(
    new THREE.Vector3(-armHalf, armY, 0),
    new THREE.Vector3(armHalf, armY, 0),
    0.45,
    steelMaterial
  );
  group.add(armBeam);

  // Diagonal supports under the cross-arm for visual bracing.
  const supportL = makeBeam(
    new THREE.Vector3(-armHalf, armY, 0),
    new THREE.Vector3(0, armY - 4, 0),
    0.18,
    steelDarkMaterial
  );
  const supportR = makeBeam(
    new THREE.Vector3(armHalf, armY, 0),
    new THREE.Vector3(0, armY - 4, 0),
    0.18,
    steelDarkMaterial
  );
  group.add(supportL, supportR);

  const attachmentPoints = [
    new THREE.Vector3(-armHalf, armY - 0.3, 0),
    new THREE.Vector3(0, armY + 1.6, 0),
    new THREE.Vector3(armHalf, armY - 0.3, 0),
  ];

  return { group, attachmentPoints };
}

function makeBeam(
  a: THREE.Vector3,
  b: THREE.Vector3,
  thickness: number,
  material: THREE.Material
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const geom = new THREE.CylinderGeometry(thickness * 0.5, thickness * 0.5, length, 5);
  const mesh = new THREE.Mesh(geom, material);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(mid);
  const axis = new THREE.Vector3(0, 1, 0);
  const dirN = dir.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(axis, dirN);
  mesh.quaternion.copy(quat);
  mesh.castShadow = false;
  return mesh;
}
