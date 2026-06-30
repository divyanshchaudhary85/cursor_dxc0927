/**
 * Steady-state conductor thermal rating, following the heat-balance approach
 * of IEEE Std 738 ("IEEE Standard for Calculating the Current-Temperature
 * Relationship of Bare Overhead Conductors").
 *
 * Heat balance at steady state:
 *   I^2 * R(Tc) + qs = qc + qr
 *
 * We solve for the maximum current I that keeps the conductor at the
 * allowable maximum temperature Tc given the present weather, i.e. the
 * Dynamic Line Rating (DLR) ampacity.
 *
 * Constants below are representative of a large ACSR conductor typical of a
 * 765 kV bundle sub-conductor (similar to "Bittern"/"Bobolink" class ACSR).
 * The model is for educational/visualization purposes, not a substitute for
 * a certified line-rating study.
 */

export interface ConductorSpec {
  /** Outer diameter, m */
  diameter: number;
  /** AC resistance at 25 C, ohm/m */
  rLow: number;
  /** AC resistance at 75 C, ohm/m */
  rHigh: number;
  tLow: number;
  tHigh: number;
  /** Solar absorptivity (0-1) */
  absorptivity: number;
  /** Emissivity (0-1) */
  emissivity: number;
  /** Elevation above sea level, m */
  elevation: number;
}

export const BITTERN_ACSR: ConductorSpec = {
  diameter: 0.0343, // m (~1.35 in)
  rLow: 0.0000700, // ohm/m at 25 C (0.0700 ohm/km)
  rHigh: 0.0000870, // ohm/m at 75 C (0.0870 ohm/km)
  tLow: 25,
  tHigh: 75,
  absorptivity: 0.8,
  emissivity: 0.7,
  elevation: 300,
};

export interface WeatherInput {
  /** Ambient air temperature, C */
  ambientTemp: number;
  /** Wind speed, m/s */
  windSpeed: number;
  /** Angle between wind direction and conductor axis, degrees (0=parallel, 90=perpendicular) */
  windAngleDeg: number;
  /** Global solar irradiance incident on the conductor, W/m^2 */
  solarIrradiance: number;
}

export interface RatingResult {
  /** Per sub-conductor resistance used, ohm/m */
  resistancePerM: number;
  /** Convective heat loss, W/m */
  qc: number;
  /** Radiative heat loss, W/m */
  qr: number;
  /** Solar heat gain, W/m */
  qs: number;
  /** Ampacity per sub-conductor, A */
  ampacityPerSubconductor: number;
}

function resistanceAt(spec: ConductorSpec, tc: number): number {
  const slope = (spec.rHigh - spec.rLow) / (spec.tHigh - spec.tLow);
  return spec.rLow + slope * (tc - spec.tLow);
}

/** Wind-direction correction factor from IEEE 738. phi in radians. */
function windAngleFactor(phiRad: number): number {
  return (
    1.194 -
    Math.cos(phiRad) +
    0.194 * Math.cos(2 * phiRad) +
    0.368 * Math.sin(2 * phiRad)
  );
}

function airProperties(filmTempC: number) {
  // Air density, kg/m^3 (sea-level fit, IEEE 738 style approximation)
  const rho =
    (1.293 - 1.525e-4 * 0 + 6.379e-9 * 0) / (1 + 0.00367 * filmTempC);
  // Dynamic viscosity, kg/(m s) (Sutherland's formula)
  const mu =
    (1.458e-6 * Math.pow(filmTempC + 273.15, 1.5)) / (filmTempC + 383.4);
  // Thermal conductivity of air, W/(m K)
  const kf =
    2.424e-2 + 7.477e-5 * filmTempC - 4.407e-9 * filmTempC * filmTempC;
  return { rho, mu, kf };
}

/** Convective heat loss, W/m. */
function convectiveLoss(
  spec: ConductorSpec,
  tc: number,
  weather: WeatherInput
): number {
  const { ambientTemp, windSpeed, windAngleDeg } = weather;
  const dT = Math.max(tc - ambientTemp, 0);
  if (dT === 0) return 0;

  const filmTemp = (tc + ambientTemp) / 2;
  const { rho, mu, kf } = airProperties(filmTemp);

  const elevationFactor = 1 + 1.25e-5 * spec.elevation; // mild air-density relief with altitude (visualization use)
  const rhoEff = rho * elevationFactor;

  // Natural convection (still air), W/m
  const qcNatural =
    3.645 * Math.sqrt(rhoEff) * Math.pow(spec.diameter, 0.75) * Math.pow(dT, 1.25);

  if (windSpeed <= 0.01) {
    return qcNatural;
  }

  const re = (spec.diameter * windSpeed * rhoEff) / mu;
  const kAngle = windAngleFactor((windAngleDeg * Math.PI) / 180);

  const nu1 = 1.01 + 1.35 * Math.pow(re, 0.52);
  const nu2 = 0.754 * Math.pow(re, 0.6);
  const qcForced = kAngle * Math.max(nu1, nu2) * kf * dT;

  return Math.max(qcForced, qcNatural);
}

/** Radiative heat loss, W/m. */
function radiativeLoss(
  spec: ConductorSpec,
  tc: number,
  ambientTemp: number
): number {
  const tcK = (tc + 273) / 100;
  const taK = (ambientTemp + 273) / 100;
  return (
    17.8 * spec.diameter * spec.emissivity * (Math.pow(tcK, 4) - Math.pow(taK, 4))
  );
}

/** Solar heat gain, W/m. Assumes near-normal incidence on the projected diameter. */
function solarGain(spec: ConductorSpec, solarIrradiance: number): number {
  return spec.absorptivity * solarIrradiance * spec.diameter;
}

/**
 * Compute the steady-state ampacity (A) per sub-conductor that holds the
 * conductor at `maxTempC` under the given weather.
 */
export function computeAmpacity(
  spec: ConductorSpec,
  weather: WeatherInput,
  maxTempC: number
): RatingResult {
  const r = resistanceAt(spec, maxTempC);
  const qc = convectiveLoss(spec, maxTempC, weather);
  const qr = radiativeLoss(spec, maxTempC, weather.ambientTemp);
  const qs = solarGain(spec, weather.solarIrradiance);

  const netCooling = Math.max(qc + qr - qs, 0);
  const ampacity = Math.sqrt(netCooling / r);

  return {
    resistancePerM: r,
    qc,
    qr,
    qs,
    ampacityPerSubconductor: ampacity,
  };
}

/**
 * Estimate the steady-state conductor temperature for a given current,
 * by solving the heat balance for Tc via bisection (monotonic relationship).
 */
export function computeConductorTemp(
  spec: ConductorSpec,
  weather: WeatherInput,
  currentPerSubconductor: number
): number {
  let lo = weather.ambientTemp;
  let hi = 250;

  // heatSurplus > 0 means heating (resistive + solar) exceeds cooling
  // (convective + radiative) at that trial temperature, so the conductor
  // must still be hotter than `tc` at equilibrium. Note qc = qr = 0 at
  // tc = ambientTemp (no temperature differential to drive cooling), so
  // heatSurplus(lo) is generally >= 0, and heatSurplus should fall as tc
  // rises (cooling grows faster than resistive heating).
  const heatSurplus = (tc: number): number => {
    const r = resistanceAt(spec, tc);
    const qc = convectiveLoss(spec, tc, weather);
    const qr = radiativeLoss(spec, tc, weather.ambientTemp);
    const qs = solarGain(spec, weather.solarIrradiance);
    return currentPerSubconductor * currentPerSubconductor * r + qs - qc - qr;
  };

  const fLo = heatSurplus(lo);
  if (fLo <= 0) {
    // No current/solar surplus at ambient: conductor sits at ambient temp.
    return lo;
  }
  const fHi = heatSurplus(hi);
  if (fHi >= 0) {
    // Current is high enough that even 250 C isn't enough to balance the
    // heat budget under this weather; clamp (visualization purposes).
    return hi;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fMid = heatSurplus(mid);
    if (Math.abs(fMid) < 1e-4) return mid;
    if (fMid > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Three-phase MVA from line-to-line kV and current in kA. */
export function threePhaseMVA(lineKV: number, currentA: number): number {
  return (Math.sqrt(3) * lineKV * currentA) / 1000;
}
