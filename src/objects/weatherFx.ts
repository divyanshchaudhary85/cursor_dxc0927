import * as THREE from "three";

function softCircleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class CloudField {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private bounds: number;
  private height = 180;

  constructor(count = 26, bounds = 1100) {
    this.bounds = bounds;
    const tex = softCircleTexture();
    const material = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      color: 0xffffff,
    });
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(material.clone());
      const scale = THREE.MathUtils.randFloat(70, 170);
      sprite.scale.set(scale * THREE.MathUtils.randFloat(1.4, 2.2), scale, 1);
      sprite.position.set(
        THREE.MathUtils.randFloatSpread(bounds),
        this.height + THREE.MathUtils.randFloatSpread(30),
        THREE.MathUtils.randFloatSpread(bounds)
      );
      (sprite.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.randFloat(0.35, 0.7);
      this.group.add(sprite);
      this.sprites.push(sprite);
    }
  }

  update(
    deltaSeconds: number,
    windSpeed: number,
    windCompassDeg: number,
    cloudCover: number,
    visible: boolean,
    daylight = 1
  ): void {
    this.group.visible = visible && cloudCover > 0.02;
    if (!this.group.visible) return;

    const rad = (windCompassDeg * Math.PI) / 180;
    const dirX = Math.sin(rad);
    const dirZ = Math.cos(rad);
    const speed = windSpeed * 1.8;
    const shade = THREE.MathUtils.lerp(0.22, 1, daylight);

    for (const sprite of this.sprites) {
      sprite.position.x += dirX * speed * deltaSeconds;
      sprite.position.z += dirZ * speed * deltaSeconds;

      const half = this.bounds / 2;
      if (sprite.position.x > half) sprite.position.x -= this.bounds;
      if (sprite.position.x < -half) sprite.position.x += this.bounds;
      if (sprite.position.z > half) sprite.position.z -= this.bounds;
      if (sprite.position.z < -half) sprite.position.z += this.bounds;

      const mat = sprite.material as THREE.SpriteMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, THREE.MathUtils.clamp(cloudCover * 0.85, 0, 0.85), 0.05);
      mat.color.setScalar(shade);
    }
  }
}

export type PrecipKind = "none" | "rain" | "snow";

export class Precipitation {
  readonly points: THREE.Points;
  private velocities: Float32Array;
  private kind: PrecipKind = "none";
  private bounds = 500;
  private height = 140;

  constructor(count = 1400) {
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(this.bounds);
      positions[i * 3 + 1] = Math.random() * this.height;
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(this.bounds);
      this.velocities[i] = THREE.MathUtils.randFloat(0.7, 1.3);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xcfe8ff,
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.points = new THREE.Points(geom, material);
    this.points.visible = false;
  }

  setKind(kind: PrecipKind): void {
    this.kind = kind;
    this.points.visible = kind !== "none";
    const material = this.points.material as THREE.PointsMaterial;
    if (kind === "snow") {
      material.color.set(0xffffff);
      material.size = 0.7;
      material.opacity = 0.85;
    } else if (kind === "rain") {
      material.color.set(0xaad0ff);
      material.size = 0.35;
      material.opacity = 0.55;
    }
  }

  update(deltaSeconds: number, windSpeed: number, windCompassDeg: number): void {
    if (this.kind === "none") return;
    const posAttr = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const fallSpeed = this.kind === "snow" ? 6 : 38;
    const rad = (windCompassDeg * Math.PI) / 180;
    const driftStrength = this.kind === "snow" ? 0.6 : 0.25;
    const driftX = Math.sin(rad) * windSpeed * driftStrength;
    const driftZ = Math.cos(rad) * windSpeed * driftStrength;

    for (let i = 0; i < this.velocities.length; i++) {
      const y = posAttr.getY(i) - fallSpeed * this.velocities[i] * deltaSeconds;
      let x = posAttr.getX(i) + driftX * deltaSeconds;
      let z = posAttr.getZ(i) + driftZ * deltaSeconds;
      let newY = y;
      if (newY < 0) {
        newY = this.height;
        x = THREE.MathUtils.randFloatSpread(this.bounds);
        z = THREE.MathUtils.randFloatSpread(this.bounds);
      }
      posAttr.setXYZ(i, x, newY, z);
    }
    posAttr.needsUpdate = true;
  }
}

/** Faint horizontal streaks that drift through the scene to convey wind speed/direction. */
export class WindStreaks {
  readonly points: THREE.Points;
  private bounds = 600;
  private height = 60;

  constructor(count = 90) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(this.bounds);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(2, this.height);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(this.bounds);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geom, material);
  }

  update(deltaSeconds: number, windSpeed: number, windCompassDeg: number): void {
    const material = this.points.material as THREE.PointsMaterial;
    material.opacity = THREE.MathUtils.clamp(windSpeed / 20, 0, 1) * 0.3;
    if (windSpeed < 0.3) return;

    const rad = (windCompassDeg * Math.PI) / 180;
    const dirX = Math.sin(rad);
    const dirZ = Math.cos(rad);
    const speed = (2 + windSpeed) * 2.2;

    const posAttr = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const half = this.bounds / 2;
    for (let i = 0; i < posAttr.count; i++) {
      let x = posAttr.getX(i) + dirX * speed * deltaSeconds;
      let z = posAttr.getZ(i) + dirZ * speed * deltaSeconds;
      if (x > half) x -= this.bounds;
      if (x < -half) x += this.bounds;
      if (z > half) z -= this.bounds;
      if (z < -half) z += this.bounds;
      posAttr.setX(i, x);
      posAttr.setZ(i, z);
    }
    posAttr.needsUpdate = true;
  }
}
