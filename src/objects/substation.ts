import * as THREE from "three";

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(6,10,18,0.0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 56px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#bfe6ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(79,209,255,0.9)";
  ctx.shadowBlur = 18;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(48, 12, 1);
  return sprite;
}

/** A simplified switchyard: a fenced gravel pad with a few equipment silhouettes
 * (transformer blocks, bus support frames) plus a floating label. */
export function buildSubstation(label: string): THREE.Group {
  const group = new THREE.Group();
  group.name = "substation";

  const padGeom = new THREE.BoxGeometry(46, 0.4, 36);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x6b6457, roughness: 1 });
  const pad = new THREE.Mesh(padGeom, padMat);
  pad.position.y = 0.2;
  group.add(pad);

  const equipMat = new THREE.MeshStandardMaterial({ color: 0x9aa6ad, metalness: 0.5, roughness: 0.5 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.6, roughness: 0.4 });

  for (let i = 0; i < 2; i++) {
    const transformer = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 4), tankMat);
    tank.position.y = 2.1;
    transformer.add(tank);
    for (let r = 0; r < 6; r++) {
      const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 6), tankMat);
      rad.position.set(-3 - 0.4, 2.1, -1.2 + r * 0.5);
      transformer.add(rad);
    }
    const bushingGeom = new THREE.CylinderGeometry(0.18, 0.12, 2.2, 8);
    for (let b = 0; b < 3; b++) {
      const bushing = new THREE.Mesh(bushingGeom, equipMat);
      bushing.position.set(-1.8 + b * 1.8, 4.5, 0);
      transformer.add(bushing);
    }
    transformer.position.set(-12 + i * 24, 0.4, 11);
    group.add(transformer);
  }

  for (let i = 0; i < 3; i++) {
    const frame = new THREE.Group();
    const postGeom = new THREE.CylinderGeometry(0.18, 0.18, 8, 6);
    const postL = new THREE.Mesh(postGeom, equipMat);
    postL.position.set(-4, 4, 0);
    const postR = new THREE.Mesh(postGeom, equipMat);
    postR.position.set(4, 4, 0);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), equipMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, 8, 0);
    frame.add(postL, postR, beam);
    frame.position.set(-14 + i * 14, 0.4, -10);
    group.add(frame);
  }

  const fenceMat = new THREE.LineBasicMaterial({ color: 0x3a4654, transparent: true, opacity: 0.6 });
  const fencePts: THREE.Vector3[] = [
    new THREE.Vector3(-23, 1.6, -18),
    new THREE.Vector3(23, 1.6, -18),
    new THREE.Vector3(23, 1.6, 18),
    new THREE.Vector3(-23, 1.6, 18),
    new THREE.Vector3(-23, 1.6, -18),
  ];
  const fenceGeom = new THREE.BufferGeometry().setFromPoints(fencePts);
  group.add(new THREE.Line(fenceGeom, fenceMat));

  const label3d = makeLabelSprite(label);
  label3d.position.set(0, 18, 0);
  group.add(label3d);

  return group;
}
