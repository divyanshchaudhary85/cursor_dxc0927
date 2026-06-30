export type PrecipKind = "none" | "rain" | "snow";

export interface WeatherState {
  timeOfDay: number; // 0-24 hours
  ambientTemp: number; // C
  windSpeed: number; // m/s
  windAngleDeg: number; // 0-90 deg to line axis (also used as the visual drift azimuth)
  solarIrradiance: number; // W/m^2
  precipitation: PrecipKind;
  showClouds: boolean;
}

export interface PowerState {
  flowMW: [number, number]; // circuit 1, circuit 2 (signed: + = A->B)
  conductorTempLimit: number; // C
}

export interface AppState {
  weather: WeatherState;
  power: PowerState;
  panelsVisible: boolean;
}

export const state: AppState = {
  weather: {
    timeOfDay: 12,
    ambientTemp: 25,
    windSpeed: 2,
    windAngleDeg: 45,
    solarIrradiance: 850,
    precipitation: "none",
    showClouds: true,
  },
  power: {
    flowMW: [1800, -900],
    conductorTempLimit: 100,
  },
  panelsVisible: true,
};

type Listener = () => void;
const listeners: Listener[] = [];

export function onStateChange(fn: Listener): void {
  listeners.push(fn);
}

export function notifyStateChange(): void {
  for (const fn of listeners) fn();
}
