# 765 kV Transmission Corridor — Dynamic Line Rating 3D Model

An interactive, real-time 3D simulation of a **765 kV twin-circuit transmission
corridor** connecting two substations. You control the scheduled power flow
on each circuit and the weather (ambient temperature, wind speed/angle, solar
irradiance, time of day, precipitation), and the model recomputes — live —
how much current each line can safely carry, exactly the way a real-world
**Dynamic Line Rating (DLR)** system does.

Built with [Three.js](https://threejs.org/) + TypeScript + Vite, no game
engine or 3D editor required — every tower, conductor, insulator string,
cloud, and weather effect is generated procedurally in code.

## What you can see and do

- **Two parallel 765 kV single-circuit lines** (Circuit 1 / Circuit 2), each
  with 3 lattice towers, two 350 m spans, 3 phases, and 4-conductor bundles
  per phase, strung from suspension insulators.
- **Independent, signed power-flow setpoints** (MW) per circuit — positive
  flows Substation A → B, negative flows B → A. Animated particles travel
  along each conductor to visualize current direction and relative magnitude.
- **Live weather controls**: ambient temperature, wind speed, wind angle
  relative to the line (the single biggest driver of convective cooling),
  solar irradiance, time of day (drives a full day/night sky + sun position),
  precipitation (rain/snow particles), and cloud cover.
- **Real Dynamic Line Rating physics**: each line's thermal ampacity limit is
  solved from the IEEE Std 738 steady-state conductor heat balance
  (`I²R(Tc) + qs = qc + qr`), so the displayed A/MVA limit, conductor
  temperature, and resulting loading % respond immediately and physically to
  the weather sliders.
- **Thermal sag visualization**: hotter conductors elongate and sag more,
  reducing ground clearance — shown live per circuit alongside the
  ampacity/MVA/loading/temperature readouts.
- **Visual + numeric overload feedback**: conductors and status badges shift
  green → yellow → orange → red as loading approaches and exceeds the dynamic
  limit.
- **Weather presets** (clear/mild, hot & still, cool & windy, overcast,
  storm, calm winter night) to quickly jump between scenarios that show how
  dramatically a line's safe capacity can swing with the weather, plus a
  **DLR vs. static (worst-case) rating** comparison in the corridor summary.

## Why this matters (the physics, briefly)

A bare overhead conductor's current limit is set by how hot it's allowed to
get (above which it sags too much or anneals/loses strength). The heat
balance is:

```
I² · R(Tc) + qs = qc + qr
```

- `qc` — convective cooling: strongly increasing with wind speed, and most
  effective when wind blows **across** the line rather than along it.
- `qr` — radiative cooling: depends on conductor and ambient temperature.
- `qs` — solar heating: depends on irradiance (time of day / cloud cover).

Solving for `I` at the maximum allowable conductor temperature gives the
**dynamic** ampacity for the current weather. A cold, windy night can roughly
double a line's safe rating versus a hot, still, sunny afternoon — which is
exactly what you can demonstrate by switching presets in this model.

This is a visualization/education tool with representative (not
utility-certified) conductor and tower parameters — see the in-app "About
this model" panel for the full methodology and assumptions.

## Getting started

```bash
npm install
npm run dev       # start the dev server (Vite)
npm run build     # type-check + production build into dist/
npm run preview   # preview the production build locally
```

Open the printed local URL in a browser. Drag to orbit the camera, scroll to
zoom, right-drag to pan.

## Project structure

```
src/
  physics/
    thermalRating.ts   IEEE 738-style heat balance -> ampacity & conductor temp
    sag.ts             Thermal-elongation sag / ground-clearance model
  objects/
    tower.ts           Procedural lattice tower geometry
    insulator.ts        Suspension insulator string
    conductorSpan.ts    Catenary curve + 4-conductor bundle tube geometry
    transmissionLine.ts High-level line: towers + spans + physics + particles
    sky.ts              Day/night sky dome, sun, stars, fog
    weatherFx.ts         Clouds, rain/snow, wind streak particles
    ground.ts            Procedural ground texture + grid
    substation.ts        Simplified switchyard markers at each end
    materials.ts          Shared materials + loading-based color ramp
  ui/
    controls.ts          DOM <-> state wiring, live readouts
  state.ts                Central app state (weather + power flow)
  weatherPresets.ts        Named weather presets
  sceneSetup.ts            Renderer/camera/controls/animation loop
  main.ts                  Entry point
```

## Disclaimer

Conductor, tower, and span parameters are illustrative values representative
of a 4-bundle ACSR 765 kV line. This project is for education and
visualization purposes and is **not** a substitute for a certified
engineering line-rating study.
