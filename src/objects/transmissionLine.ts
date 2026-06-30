import * as THREE from "three";
import { buildTower, STANDARD_765KV_TOWER, type TowerSpec } from "./tower";
import { buildInsulatorString } from "./insulator";
import { buildSpanBundle, type SpanBundle } from "./conductorSpan";
import { makeConductorMaterial, loadingColor } from "./materials";
import {
  BITTERN_ACSR,
  computeAmpacity,
  computeConductorTemp,
  threePhaseMVA,
  type ConductorSpec,
  type WeatherInput,
} from "../physics/thermalRating";
import { DEFAULT_SAG_PARAMS, sagAtTemperature, groundClearance, type SagParams } from "../physics/sag";

const LINE_KV = 765;
const BUNDLE_COUNT = 4;
const INSULATOR_LENGTH = 7.0;

export interface LineReadout {
  ampacityTotalA: number;
  mvaLimit: number;
  actualMW: number;
  loadingFraction: number;
  conductorTempC: number;
  sagM: number;
  clearanceM: number;
  status: "normal" | "caution" | "overload";
}

export interface LineOptions {
  xOffset: number;
  spanLength: number;
  towerSpec?: TowerSpec;
  conductorSpec?: ConductorSpec;
  sagParams?: SagParams;
  color: number;
}

export class TransmissionLine {
  readonly group = new THREE.Group();
  private towerZ: number[];
  private phaseAttachWorld: THREE.Vector3[][] = []; // [towerIdx][phaseIdx]
  private spans: SpanBundle[][] = []; // [phaseIdx][spanIdx]
  private curvePaths: THREE.CurvePath<THREE.Vector3>[] = []; // per phase, spanning whole corridor
  private particlePoints: THREE.Points[] = [];
  private particleOffsets: Float32Array[] = [];
  private material: THREE.MeshStandardMaterial;
  private conductorSpec: ConductorSpec;
  private sagParams: SagParams;
  private flowDirection = 1;
  private flowSpeed = 0;
  private lastReadout: LineReadout;
  private opts: LineOptions;

  constructor(opts: LineOptions) {
    this.opts = opts;
    this.conductorSpec = opts.conductorSpec ?? BITTERN_ACSR;
    this.sagParams = opts.sagParams ?? DEFAULT_SAG_PARAMS;
    const towerSpec = opts.towerSpec ?? STANDARD_765KV_TOWER;
    this.material = makeConductorMaterial();

    this.towerZ = [-opts.spanLength, 0, opts.spanLength];

    for (const z of this.towerZ) {
      const { group: towerGroup, attachmentPoints } = buildTower(towerSpec);
      towerGroup.position.set(opts.xOffset, 0, z);
      this.group.add(towerGroup);

      const worldPts: THREE.Vector3[] = [];
      for (const local of attachmentPoints) {
        const world = local.clone().add(towerGroup.position);
        worldPts.push(world);

        const insulator = buildInsulatorString(INSULATOR_LENGTH);
        insulator.position.copy(world);
        this.group.add(insulator);
      }
      this.phaseAttachWorld.push(worldPts);
    }

    const initialSag = sagAtTemperature(this.sagParams, 25);

    for (let phase = 0; phase < 3; phase++) {
      const phaseSpans: SpanBundle[] = [];
      for (let spanIdx = 0; spanIdx < this.towerZ.length - 1; spanIdx++) {
        const startAttach = this.phaseAttachWorld[spanIdx][phase];
        const endAttach = this.phaseAttachWorld[spanIdx + 1][phase];
        const start = startAttach.clone().setY(startAttach.y - INSULATOR_LENGTH);
        const end = endAttach.clone().setY(endAttach.y - INSULATOR_LENGTH);
        const bundle = buildSpanBundle(start, end, initialSag, this.material);
        this.group.add(bundle.group);
        phaseSpans.push(bundle);
      }
      this.spans.push(phaseSpans);

      const path = new THREE.CurvePath<THREE.Vector3>();
      for (const span of phaseSpans) {
        path.add(span.curves[0]);
      }
      path.updateArcLengths();
      this.curvePaths.push(path);

      const particleCount = 30;
      const positions = new Float32Array(particleCount * 3);
      const offsets = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) {
        offsets[i] = i / particleCount;
        const p = path.getPointAt(offsets[i]);
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const ptsMaterial = new THREE.PointsMaterial({
        color: opts.color,
        size: 0.9,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geom, ptsMaterial);
      this.group.add(points);
      this.particlePoints.push(points);
      this.particleOffsets.push(offsets);
    }

    this.lastReadout = {
      ampacityTotalA: 0,
      mvaLimit: 0,
      actualMW: 0,
      loadingFraction: 0,
      conductorTempC: 25,
      sagM: initialSag,
      clearanceM: groundClearance(this.sagParams, initialSag),
      status: "normal",
    };
  }

  getReadout(): LineReadout {
    return this.lastReadout;
  }

  /** Recompute physics & visuals for the given weather and scheduled power flow. */
  update(weather: WeatherInput, flowMW: number, tempLimitC: number): LineReadout {
    const rating = computeAmpacity(this.conductorSpec, weather, tempLimitC);
    const ampacityTotalA = rating.ampacityPerSubconductor * BUNDLE_COUNT;
    const mvaLimit = threePhaseMVA(LINE_KV, ampacityTotalA);

    const actualMW = Math.abs(flowMW);
    const actualCurrentTotal = (actualMW * 1e6) / (Math.sqrt(3) * LINE_KV * 1000);
    const currentPerSub = actualCurrentTotal / BUNDLE_COUNT;

    const conductorTempC = computeConductorTemp(this.conductorSpec, weather, currentPerSub);
    const sag = sagAtTemperature(this.sagParams, conductorTempC);
    const clearance = groundClearance(this.sagParams, sag);

    const loadingFraction = ampacityTotalA > 0 ? actualCurrentTotal / ampacityTotalA : 0;

    let status: LineReadout["status"] = "normal";
    if (loadingFraction > 1.0) status = "overload";
    else if (loadingFraction > 0.85) status = "caution";

    for (const phaseSpans of this.spans) {
      for (const span of phaseSpans) {
        span.rebuild(sag);
      }
    }
    for (const path of this.curvePaths) {
      path.updateArcLengths();
    }

    const color = loadingColor(loadingFraction);
    this.material.color.copy(color);
    this.material.emissive.copy(color).multiplyScalar(loadingFraction > 0.85 ? 0.35 : 0.08);

    this.flowDirection = flowMW >= 0 ? 1 : -1;
    const speedScale = THREE.MathUtils.clamp(actualMW / 3500, 0, 1);
    this.flowSpeed = 0.015 + speedScale * 0.22;

    this.lastReadout = {
      ampacityTotalA,
      mvaLimit,
      actualMW,
      loadingFraction,
      conductorTempC,
      sagM: sag,
      clearanceM: clearance,
      status,
    };
    return this.lastReadout;
  }

  /** Per-frame animation: advance particle positions along the conductor curves. */
  animate(deltaSeconds: number): void {
    for (let phase = 0; phase < 3; phase++) {
      const path = this.curvePaths[phase];
      const points = this.particlePoints[phase];
      const offsets = this.particleOffsets[phase];
      const posAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;

      for (let i = 0; i < offsets.length; i++) {
        offsets[i] = THREE.MathUtils.euclideanModulo(
          offsets[i] + this.flowDirection * this.flowSpeed * deltaSeconds,
          1
        );
        const p = path.getPointAt(offsets[i]);
        posAttr.setXYZ(i, p.x, p.y, p.z);
      }
      posAttr.needsUpdate = true;
    }
  }

  get spanLength(): number {
    return this.opts.spanLength;
  }
}
