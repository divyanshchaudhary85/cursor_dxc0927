import type { PrecipKind } from "./state";

export interface WeatherPreset {
  label: string;
  timeOfDay: number;
  ambientTemp: number;
  windSpeed: number;
  windAngleDeg: number;
  solarIrradiance: number;
  precipitation: PrecipKind;
}

export const WEATHER_PRESETS: Record<string, WeatherPreset> = {
  "clear-mild": {
    label: "Clear, mild breeze",
    timeOfDay: 12,
    ambientTemp: 25,
    windSpeed: 2,
    windAngleDeg: 45,
    solarIrradiance: 850,
    precipitation: "none",
  },
  "hot-still": {
    label: "Hot, still summer afternoon",
    timeOfDay: 14,
    ambientTemp: 40,
    windSpeed: 0.3,
    windAngleDeg: 20,
    solarIrradiance: 1050,
    precipitation: "none",
  },
  "windy-cool": {
    label: "Cool & windy (high rating)",
    timeOfDay: 10,
    ambientTemp: 8,
    windSpeed: 14,
    windAngleDeg: 80,
    solarIrradiance: 500,
    precipitation: "none",
  },
  overcast: {
    label: "Overcast, light wind",
    timeOfDay: 13,
    ambientTemp: 18,
    windSpeed: 3,
    windAngleDeg: 50,
    solarIrradiance: 180,
    precipitation: "none",
  },
  storm: {
    label: "Storm / heavy wind & rain",
    timeOfDay: 16,
    ambientTemp: 19,
    windSpeed: 18,
    windAngleDeg: 70,
    solarIrradiance: 90,
    precipitation: "rain",
  },
  "winter-night": {
    label: "Calm winter night",
    timeOfDay: 23,
    ambientTemp: -8,
    windSpeed: 1,
    windAngleDeg: 35,
    solarIrradiance: 0,
    precipitation: "snow",
  },
};
