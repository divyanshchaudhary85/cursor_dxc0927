import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransmissionLine, type LineReadout } from "./objects/transmissionLine";
import { buildGround, buildGrid } from "./objects/ground";
import { buildSky, type SkyRig } from "./objects/sky";
import { CloudField, Precipitation, WindStreaks } from "./objects/weatherFx";
import { buildSubstation } from "./objects/substation";
import { state } from "./state";
import type { WeatherInput } from "./physics/thermalRating";

const SPAN_LENGTH = 350;
const LINE_X_OFFSETS = [-45, 45];
const LINE_COLORS = [0x4fd1ff, 0xff9f4f];

export interface ReadoutCallback {
  (readouts: [LineReadout, LineReadout]): void;
}

export class TransmissionScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private lines: [TransmissionLine, TransmissionLine];
  private sky: SkyRig;
  private clouds: CloudField;
  private precip: Precipitation;
  private windStreaks: WindStreaks;
  private physicsAccumulator = 0;
  private onReadout: ReadoutCallback | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(95, 42, 165);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 22, -20);
    this.controls.maxDistance = 900;
    this.controls.minDistance = 25;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    this.sky = buildSky(this.scene);
    this.scene.add(this.sky.domeMesh, this.sky.sunLight, this.sky.hemiLight, this.sky.ambientLight, this.sky.sunSprite, this.sky.stars);

    this.scene.add(buildGround(1600));
    this.scene.add(buildGrid(1200, 60));

    const subA = buildSubstation("SUBSTATION A");
    subA.position.set(0, 0, -SPAN_LENGTH - 70);
    const subB = buildSubstation("SUBSTATION B");
    subB.position.set(0, 0, SPAN_LENGTH + 70);
    this.scene.add(subA, subB);

    this.lines = [
      new TransmissionLine({ xOffset: LINE_X_OFFSETS[0], spanLength: SPAN_LENGTH, color: LINE_COLORS[0] }),
      new TransmissionLine({ xOffset: LINE_X_OFFSETS[1], spanLength: SPAN_LENGTH, color: LINE_COLORS[1] }),
    ];
    this.scene.add(this.lines[0].group, this.lines[1].group);

    this.clouds = new CloudField();
    this.precip = new Precipitation();
    this.windStreaks = new WindStreaks();
    this.scene.add(this.clouds.group, this.precip.points, this.windStreaks.points);

    this.resize();
    window.addEventListener("resize", this.resize);

    this.runPhysicsUpdate();
    this.animate();
  }

  setReadoutCallback(cb: ReadoutCallback): void {
    this.onReadout = cb;
  }

  /** Force an immediate physics recompute (call after any control changes). */
  runPhysicsUpdate(): void {
    const weather: WeatherInput = {
      ambientTemp: state.weather.ambientTemp,
      windSpeed: state.weather.windSpeed,
      windAngleDeg: state.weather.windAngleDeg,
      solarIrradiance: state.weather.solarIrradiance,
    };
    const r0 = this.lines[0].update(weather, state.power.flowMW[0], state.power.conductorTempLimit);
    const r1 = this.lines[1].update(weather, state.power.flowMW[1], state.power.conductorTempLimit);
    this.onReadout?.([r0, r1]);
  }

  private resize = (): void => {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };

  private animate = (): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.controls.update();

    const cloudCover = state.weather.precipitation !== "none"
      ? 0.85
      : THREE.MathUtils.clamp(1 - state.weather.solarIrradiance / 950, 0.05, 0.75);

    this.sky.update(state.weather.timeOfDay, state.weather.solarIrradiance, cloudCover);
    this.clouds.update(
      dt,
      state.weather.windSpeed,
      state.weather.windAngleDeg,
      cloudCover,
      state.weather.showClouds,
      this.sky.daylight
    );
    this.precip.setKind(state.weather.precipitation);
    this.precip.update(dt, state.weather.windSpeed, state.weather.windAngleDeg);
    this.windStreaks.update(dt, state.weather.windSpeed, state.weather.windAngleDeg);

    for (const line of this.lines) line.animate(dt);

    this.physicsAccumulator += dt;
    if (this.physicsAccumulator > 0.25) {
      this.physicsAccumulator = 0;
      this.runPhysicsUpdate();
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
  }
}
