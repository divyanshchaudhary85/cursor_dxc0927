import * as THREE from "three";

export const steelMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a93a0,
  metalness: 0.75,
  roughness: 0.45,
});

export const steelDarkMaterial = new THREE.MeshStandardMaterial({
  color: 0x55606e,
  metalness: 0.7,
  roughness: 0.5,
});

export const insulatorMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a3f33,
  metalness: 0.1,
  roughness: 0.6,
});

export const insulatorCapMaterial = new THREE.MeshStandardMaterial({
  color: 0x2b2e26,
  metalness: 0.3,
  roughness: 0.4,
});

export function makeConductorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x9aa6ad,
    metalness: 0.85,
    roughness: 0.35,
    emissive: 0x000000,
    emissiveIntensity: 0.6,
  });
}

/** Loading status -> color, used for conductor tint and UI status bars. */
export function loadingColor(loadingFraction: number): THREE.Color {
  const c = new THREE.Color();
  const f = THREE.MathUtils.clamp(loadingFraction, 0, 1.3);
  if (f <= 0.75) {
    c.lerpColors(new THREE.Color(0x3ddc84), new THREE.Color(0xffcc33), f / 0.75);
  } else if (f <= 1.0) {
    c.lerpColors(new THREE.Color(0xffcc33), new THREE.Color(0xff5d3b), (f - 0.75) / 0.25);
  } else {
    c.lerpColors(new THREE.Color(0xff5d3b), new THREE.Color(0xff1a1a), Math.min((f - 1.0) / 0.3, 1));
  }
  return c;
}
