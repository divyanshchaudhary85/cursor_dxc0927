import * as THREE from "three";

const skyVertexShader = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;
varying vec3 vWorldPosition;
void main() {
  float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
}
`;

export interface SkyRig {
  domeMesh: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  ambientLight: THREE.AmbientLight;
  sunSprite: THREE.Sprite;
  stars: THREE.Points;
  fog: THREE.Fog;
  daylight: number;
  update: (timeOfDayHours: number, solarIrradiance: number, cloudCoverFraction: number) => void;
}

function makeGlowSprite(color: number, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const c = new THREE.Color(color);
  gradient.addColorStop(0, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},1)`);
  gradient.addColorStop(0.35, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.55)`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

function makeStars(count = 1200, radius = 900): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloat(0.05, 0.95));
    const r = radius * THREE.MathUtils.randFloat(0.92, 1.0);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  return new THREE.Points(geom, material);
}

export function buildSky(scene: THREE.Scene): SkyRig {
  const domeGeom = new THREE.SphereGeometry(950, 32, 16);
  const domeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x4a90d9) },
      bottomColor: { value: new THREE.Color(0xdcefff) },
      offset: { value: 20 },
      exponent: { value: 0.7 },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
  });
  const domeMesh = new THREE.Mesh(domeGeom, domeMaterial);
  domeMesh.name = "sky-dome";

  const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.position.set(200, 300, 100);

  const hemiLight = new THREE.HemisphereLight(0x9ec7ff, 0x33402a, 0.6);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);

  const sunSprite = makeGlowSprite(0xfff2d0, 140);
  const stars = makeStars();

  const fog = new THREE.Fog(0xbcd4ee, 400, 1400);
  scene.fog = fog;

  const rig: SkyRig = {
    domeMesh,
    sunLight,
    hemiLight,
    ambientLight,
    sunSprite,
    stars,
    fog,
    daylight: 1,
    update: () => {},
  };

  const update = (timeOfDayHours: number, solarIrradiance: number, cloudCoverFraction: number) => {
    // Sun elevation: simple sinusoidal day arc, peak at 12:00.
    const dayPhase = (timeOfDayHours - 6) / 12; // 0 at 6:00, 1 at 18:00
    const elevation = Math.sin(THREE.MathUtils.clamp(dayPhase, -0.3, 1.3) * Math.PI);
    const azimuth = (timeOfDayHours / 24) * Math.PI * 2;

    const distance = 400;
    const sunDir = new THREE.Vector3(
      Math.cos(azimuth) * Math.cos(elevation * 0),
      Math.max(elevation, -0.15),
      Math.sin(azimuth)
    );
    // Re-derive a cleaner arc: x/z sweep with azimuth, y from elevation directly.
    sunDir.set(Math.cos(azimuth), Math.max(elevation, -0.2), Math.sin(azimuth) * 0.6 + 0.4);
    sunDir.normalize();

    sunLight.position.copy(sunDir).multiplyScalar(distance);
    sunSprite.position.copy(sunLight.position);

    const daylight = THREE.MathUtils.clamp(elevation, 0, 1);
    rig.daylight = daylight;
    const irradianceFactor = THREE.MathUtils.clamp(solarIrradiance / 1000, 0, 1.1);
    const cloudDim = 1 - 0.65 * cloudCoverFraction;

    sunLight.intensity = 2.4 * daylight * irradianceFactor * cloudDim + 0.02;

    const warm = new THREE.Color(0xff9d4d);
    const white = new THREE.Color(0xfff6e0);
    const lowSunMix = THREE.MathUtils.clamp(1 - elevation * 2.2, 0, 1);
    sunLight.color.copy(white).lerp(warm, lowSunMix);

    const nightTop = new THREE.Color(0x040711);
    const nightBottom = new THREE.Color(0x0a1020);
    const dayTop = new THREE.Color(0x3f86d6);
    const dayBottom = new THREE.Color(0xdcefff);
    const duskTop = new THREE.Color(0x33406e);
    const duskBottom = new THREE.Color(0xe2876b);

    const top = new THREE.Color();
    const bottom = new THREE.Color();
    if (elevation > 0.18) {
      top.copy(dayTop);
      bottom.copy(dayBottom);
    } else if (elevation > -0.05) {
      const t = THREE.MathUtils.clamp((elevation + 0.05) / 0.23, 0, 1);
      top.copy(duskTop).lerp(dayTop, t);
      bottom.copy(duskBottom).lerp(dayBottom, t);
    } else {
      const t = THREE.MathUtils.clamp((elevation + 0.3) / 0.25, 0, 1);
      top.copy(nightTop).lerp(duskTop, t);
      bottom.copy(nightBottom).lerp(duskBottom, t);
    }

    const cloudGray = new THREE.Color(0x7c8a96);
    top.lerp(cloudGray, cloudCoverFraction * 0.5);
    bottom.lerp(cloudGray, cloudCoverFraction * 0.4);

    domeMaterial.uniforms.topColor.value.copy(top);
    domeMaterial.uniforms.bottomColor.value.copy(bottom);

    hemiLight.intensity = 0.65 + 0.55 * daylight * (1 - 0.3 * cloudCoverFraction);
    hemiLight.color.copy(white).lerp(new THREE.Color(0x7c8cb8), 1 - daylight);
    ambientLight.intensity = 0.28 + daylight * 0.22;

    sunSprite.visible = elevation > -0.05;
    const spriteMat = sunSprite.material as THREE.SpriteMaterial;
    spriteMat.opacity = THREE.MathUtils.clamp(daylight * (1 - cloudCoverFraction * 0.8), 0, 1);

    const starsMat = stars.material as THREE.PointsMaterial;
    starsMat.opacity = THREE.MathUtils.clamp((1 - daylight) * (1 - cloudCoverFraction), 0, 0.9);

    fog.color.copy(bottom);
    fog.near = 480 - cloudCoverFraction * 200;
    fog.far = 1700 - cloudCoverFraction * 500;
  };

  rig.update = update;
  update(12, 850, 0);

  return rig;
}
