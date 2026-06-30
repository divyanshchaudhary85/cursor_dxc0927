import * as THREE from "three";

function makeGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#46582f";
  ctx.fillRect(0, 0, size, size);

  // Subtle mottling for a grassy field look.
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.6 + 0.4;
    const shade = Math.random() * 28 - 14;
    ctx.fillStyle = `rgba(${92 + shade},${112 + shade},${68 + shade},0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildGround(size = 2400): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(size, size, 1, 1);
  geom.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    map: makeGroundTexture(),
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = false;
  mesh.name = "ground";
  return mesh;
}

/** A faint grid to help convey scale/orientation along the corridor. */
export function buildGrid(size = 1600, divisions = 80): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, 0x4fd1ff, 0x1c2636);
  const mat = grid.material as THREE.Material & { opacity: number; transparent: boolean };
  mat.opacity = 0.12;
  mat.transparent = true;
  grid.position.y = 0.02;
  return grid;
}
