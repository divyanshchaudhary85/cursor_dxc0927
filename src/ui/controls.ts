import type { TransmissionScene } from "../sceneSetup";
import type { LineReadout } from "../objects/transmissionLine";
import { state, type PrecipKind } from "../state";
import { WEATHER_PRESETS } from "../weatherPresets";
import { BITTERN_ACSR, computeAmpacity, threePhaseMVA } from "../physics/thermalRating";

const BUNDLE_COUNT = 4;
const LINE_KV = 765;

/** Conservative "static" rating reference weather: hot, still, full sun — the
 * worst-case assumption many utilities still use for a fixed seasonal rating. */
const STATIC_RATING_WEATHER = {
  ambientTemp: 40,
  windSpeed: 0.61,
  windAngleDeg: 90,
  solarIrradiance: 1000,
};

function el<T extends Element>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as unknown as T;
}

function fmt(value: number, digits = 0): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function setupControls(scene: TransmissionScene): void {
  const presetSelect = el<HTMLSelectElement>("preset-select");
  const timeSlider = el<HTMLInputElement>("time-slider");
  const tempSlider = el<HTMLInputElement>("temp-slider");
  const windSlider = el<HTMLInputElement>("wind-slider");
  const windAngleSlider = el<HTMLInputElement>("windangle-slider");
  const solarSlider = el<HTMLInputElement>("solar-slider");
  const precipSelect = el<HTMLSelectElement>("precip-select");
  const cloudsToggle = el<HTMLInputElement>("clouds-toggle");

  const flow1Slider = el<HTMLInputElement>("flow1-slider");
  const flow2Slider = el<HTMLInputElement>("flow2-slider");
  const tmaxSlider = el<HTMLInputElement>("tmax-slider");

  const valTime = el<HTMLSpanElement>("val-time");
  const valTemp = el<HTMLSpanElement>("val-temp");
  const valWind = el<HTMLSpanElement>("val-wind");
  const valWindAngle = el<HTMLSpanElement>("val-windangle");
  const valSolar = el<HTMLSpanElement>("val-solar");
  const valFlow1 = el<HTMLSpanElement>("val-flow1");
  const valFlow2 = el<HTMLSpanElement>("val-flow2");
  const valTmax = el<HTMLSpanElement>("val-tmax");

  const compassNeedle = el<SVGGElement>("compass-needle");

  const btnTogglePanels = el<HTMLButtonElement>("btn-toggle-panels");
  const btnHelp = el<HTMLButtonElement>("btn-help");
  const btnHelpClose = el<HTMLButtonElement>("btn-help-close");
  const helpModal = el<HTMLDivElement>("help-modal");

  const app = el<HTMLDivElement>("app");

  function formatHours(h: number): string {
    const hh = Math.floor(h) % 24;
    const mm = Math.round((h - Math.floor(h)) * 60);
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  }

  function refreshSliderTrack(input: HTMLInputElement): void {
    const min = Number(input.min);
    const max = Number(input.max);
    const pct = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
  }

  function syncLabelsFromState(): void {
    timeSlider.value = String(state.weather.timeOfDay);
    tempSlider.value = String(state.weather.ambientTemp);
    windSlider.value = String(state.weather.windSpeed);
    windAngleSlider.value = String(state.weather.windAngleDeg);
    solarSlider.value = String(state.weather.solarIrradiance);
    precipSelect.value = state.weather.precipitation;
    flow1Slider.value = String(state.power.flowMW[0]);
    flow2Slider.value = String(state.power.flowMW[1]);
    tmaxSlider.value = String(state.power.conductorTempLimit);

    valTime.textContent = formatHours(state.weather.timeOfDay);
    valTemp.textContent = `${fmt(state.weather.ambientTemp)} °C`;
    valWind.textContent = `${fmt(state.weather.windSpeed, 1)} m/s`;
    valWindAngle.textContent = `${fmt(state.weather.windAngleDeg)}°`;
    valSolar.textContent = `${fmt(state.weather.solarIrradiance)} W/m²`;
    valFlow1.textContent = `${fmt(state.power.flowMW[0])} MW`;
    valFlow2.textContent = `${fmt(state.power.flowMW[1])} MW`;
    valTmax.textContent = `${fmt(state.power.conductorTempLimit)} °C`;

    compassNeedle.style.transform = `rotate(${state.weather.windAngleDeg}deg)`;

    for (const s of [timeSlider, tempSlider, windSlider, windAngleSlider, solarSlider, flow1Slider, flow2Slider, tmaxSlider]) {
      refreshSliderTrack(s);
    }
  }

  let pendingUpdate = false;
  function scheduleUpdate(): void {
    if (pendingUpdate) return;
    pendingUpdate = true;
    requestAnimationFrame(() => {
      pendingUpdate = false;
      scene.runPhysicsUpdate();
    });
  }

  function markCustomPreset(): void {
    presetSelect.value = "custom";
  }

  timeSlider.addEventListener("input", () => {
    state.weather.timeOfDay = Number(timeSlider.value);
    valTime.textContent = formatHours(state.weather.timeOfDay);
    refreshSliderTrack(timeSlider);
    markCustomPreset();
  });

  tempSlider.addEventListener("input", () => {
    state.weather.ambientTemp = Number(tempSlider.value);
    valTemp.textContent = `${fmt(state.weather.ambientTemp)} °C`;
    refreshSliderTrack(tempSlider);
    markCustomPreset();
    scheduleUpdate();
  });

  windSlider.addEventListener("input", () => {
    state.weather.windSpeed = Number(windSlider.value);
    valWind.textContent = `${fmt(state.weather.windSpeed, 1)} m/s`;
    refreshSliderTrack(windSlider);
    markCustomPreset();
    scheduleUpdate();
  });

  windAngleSlider.addEventListener("input", () => {
    state.weather.windAngleDeg = Number(windAngleSlider.value);
    valWindAngle.textContent = `${fmt(state.weather.windAngleDeg)}°`;
    refreshSliderTrack(windAngleSlider);
    compassNeedle.style.transform = `rotate(${state.weather.windAngleDeg}deg)`;
    markCustomPreset();
    scheduleUpdate();
  });

  solarSlider.addEventListener("input", () => {
    state.weather.solarIrradiance = Number(solarSlider.value);
    valSolar.textContent = `${fmt(state.weather.solarIrradiance)} W/m²`;
    refreshSliderTrack(solarSlider);
    markCustomPreset();
    scheduleUpdate();
  });

  precipSelect.addEventListener("change", () => {
    state.weather.precipitation = precipSelect.value as PrecipKind;
    markCustomPreset();
  });

  cloudsToggle.addEventListener("change", () => {
    state.weather.showClouds = cloudsToggle.checked;
  });

  flow1Slider.addEventListener("input", () => {
    state.power.flowMW[0] = Number(flow1Slider.value);
    valFlow1.textContent = `${fmt(state.power.flowMW[0])} MW`;
    refreshSliderTrack(flow1Slider);
    scheduleUpdate();
  });

  flow2Slider.addEventListener("input", () => {
    state.power.flowMW[1] = Number(flow2Slider.value);
    valFlow2.textContent = `${fmt(state.power.flowMW[1])} MW`;
    refreshSliderTrack(flow2Slider);
    scheduleUpdate();
  });

  tmaxSlider.addEventListener("input", () => {
    state.power.conductorTempLimit = Number(tmaxSlider.value);
    valTmax.textContent = `${fmt(state.power.conductorTempLimit)} °C`;
    refreshSliderTrack(tmaxSlider);
    scheduleUpdate();
  });

  presetSelect.addEventListener("change", () => {
    const preset = WEATHER_PRESETS[presetSelect.value];
    if (!preset) return;
    state.weather.timeOfDay = preset.timeOfDay;
    state.weather.ambientTemp = preset.ambientTemp;
    state.weather.windSpeed = preset.windSpeed;
    state.weather.windAngleDeg = preset.windAngleDeg;
    state.weather.solarIrradiance = preset.solarIrradiance;
    state.weather.precipitation = preset.precipitation;
    syncLabelsFromState();
    presetSelect.value = presetSelect.value; // keep selection (not reset to custom)
    scene.runPhysicsUpdate();
  });

  btnTogglePanels.addEventListener("click", () => {
    app.classList.toggle("panels-hidden");
  });

  btnHelp.addEventListener("click", () => helpModal.classList.remove("hidden"));
  btnHelpClose.addEventListener("click", () => helpModal.classList.add("hidden"));
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });

  syncLabelsFromState();

  function renderReadouts(readouts: [LineReadout, LineReadout]): void {
    const ids = ["1", "2"] as const;
    let totalFlow = 0;
    let totalLimit = 0;

    readouts.forEach((r, idx) => {
      const id = ids[idx];
      el<HTMLElement>(`ro${id}-amps`).textContent = `${fmt(r.ampacityTotalA)} A`;
      el<HTMLElement>(`ro${id}-mva`).textContent = `${fmt(r.mvaLimit)} MVA`;
      el<HTMLElement>(`ro${id}-load`).textContent = `${fmt(r.loadingFraction * 100)} %`;
      el<HTMLElement>(`ro${id}-temp`).textContent = `${fmt(r.conductorTempC, 1)} °C`;
      el<HTMLElement>(`ro${id}-sag`).textContent = `${fmt(r.sagM, 1)} m`;
      el<HTMLElement>(`ro${id}-clear`).textContent = `${fmt(r.clearanceM, 1)} m`;

      const fill = el<HTMLElement>(`ro${id}-fill`);
      const pct = Math.min(r.loadingFraction * 100, 130);
      fill.style.width = `${Math.min(pct, 100)}%`;

      const statusEl = el<HTMLElement>(`ro${id}-status`);
      const colors: Record<LineReadout["status"], string> = {
        normal: "var(--ok)",
        caution: "var(--warn)",
        overload: "var(--bad)",
      };
      const labels: Record<LineReadout["status"], string> = {
        normal: "NORMAL",
        caution: "CAUTION — APPROACHING LIMIT",
        overload: "OVERLOAD — EXCEEDS DLR LIMIT",
      };
      statusEl.textContent = labels[r.status];
      statusEl.style.color = colors[r.status];
      fill.style.background = colors[r.status];

      totalFlow += Math.abs(state.power.flowMW[idx]);
      totalLimit += r.mvaLimit;
    });

    el<HTMLElement>("ro-total-flow").textContent = `${fmt(totalFlow)} MW`;
    el<HTMLElement>("ro-total-limit").textContent = `${fmt(totalLimit)} MVA`;

    // Static "worst case" rating reference: a fixed conservative seasonal rating
    // (hot, still, full sun), the kind of single number many utilities used
    // before adopting Dynamic Line Rating.
    const staticRating = computeAmpacity(BITTERN_ACSR, STATIC_RATING_WEATHER, state.power.conductorTempLimit);
    const staticAmpsTotal = staticRating.ampacityPerSubconductor * BUNDLE_COUNT;
    const staticMvaPerLine = threePhaseMVA(LINE_KV, staticAmpsTotal);
    const staticTotal = staticMvaPerLine * 2;
    el<HTMLElement>("ro-static").textContent = `${fmt(staticTotal)} MVA`;
    const headroom = staticTotal > 0 ? ((totalLimit - staticTotal) / staticTotal) * 100 : 0;
    const headroomEl = el<HTMLElement>("ro-headroom");
    headroomEl.textContent = `${headroom >= 0 ? "+" : ""}${fmt(headroom, 1)} %`;
    headroomEl.style.color = headroom >= 0 ? "var(--ok)" : "var(--bad)";
  }

  scene.setReadoutCallback(renderReadouts);
}
