import { Game, CANVAS_WIDTH, CANVAS_HEIGHT } from './game.js';
import { MainMenuScene } from './scenes/mainMenuScene.js';
import { input } from './input.js';
import { achievements } from './systems/achievements.js';
import { audio } from './systems/audio.js';
import { crt } from './systems/crt.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAX_DT = 1 / 30;

// --- Game instance ---
const game = new Game();
game.pushScene(new MainMenuScene(game));

// --- Input setup ---
input.init(canvas);

// --- Audio setup ---
audio.init();

// Resume AudioContext on first user interaction (required by browsers)
const resumeAudio = () => {
  audio.resume();
  window.removeEventListener('click', resumeAudio);
  window.removeEventListener('keydown', resumeAudio);
};
window.addEventListener('click', resumeAudio);
window.addEventListener('keydown', resumeAudio);

// --- Input forwarding ---
for (const type of ['keydown', 'keyup', 'mousedown', 'mousemove', 'mouseup']) {
  window.addEventListener(type, (e) => game.handleInput(e));
}

// --- Game loop ---
let lastTime = -1;

function loop(timestamp) {
  requestAnimationFrame(loop);

  if (lastTime < 0) {
    lastTime = timestamp;
    return;
  }

  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (dt > MAX_DT) {
    dt = MAX_DT;
  }

  // Render everything to offscreen canvas
  const offCtx = crt.getContext();
  offCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  game.update(dt);
  game.render(offCtx);

  audio.update(dt);
  achievements.update(dt);

  // Apply CRT effect (barrel distortion + scanlines + vignette) to real canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  crt.apply(ctx);

  // Screen-space overlays — rendered after CRT so they bypass distortion
  game.renderOverlay(ctx);
  achievements.render(ctx);

  input.endFrame();
}

requestAnimationFrame(loop);
