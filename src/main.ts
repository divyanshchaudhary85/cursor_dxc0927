import "./style.css";
import { TransmissionScene } from "./sceneSetup";
import { setupControls } from "./ui/controls";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const bootOverlay = document.getElementById("boot-overlay") as HTMLDivElement;

const scene = new TransmissionScene(canvas);
setupControls(scene);

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    bootOverlay.classList.add("hidden");
  });
});
