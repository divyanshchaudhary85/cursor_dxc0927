import * as THREE from "three";
import { insulatorCapMaterial, insulatorMaterial } from "./materials";

/** A simple suspension insulator string (stack of discs) hanging from a
 * cross-arm attachment point down to the conductor attachment point. */
export function buildInsulatorString(length: number, discCount = 14): THREE.Group {
  const group = new THREE.Group();
  group.name = "insulator-string";

  const capGeom = new THREE.CylinderGeometry(0.06, 0.06, length, 6);
  const cap = new THREE.Mesh(capGeom, insulatorCapMaterial);
  cap.position.y = -length / 2;
  group.add(cap);

  const discRadius = 0.16;
  const discThickness = length / discCount;
  const discGeom = new THREE.CylinderGeometry(discRadius, discRadius * 0.7, discThickness * 0.7, 10);
  for (let i = 0; i < discCount; i++) {
    const disc = new THREE.Mesh(discGeom, insulatorMaterial);
    disc.position.y = -i * discThickness - discThickness / 2;
    group.add(disc);
  }

  return group;
}
