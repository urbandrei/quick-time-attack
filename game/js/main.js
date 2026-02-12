import { Game, CANVAS_WIDTH, CANVAS_HEIGHT } from './game.js';
import { MainMenuScene } from './scenes/mainMenuScene.js';
import { input } from './input.js';
import { achievements } from './systems/achievements.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAX_DT = 1 / 30;

// --- Game instance ---
const game = new Game();
game.pushScene(new MainMenuScene(game));

// --- Input setup ---
input.init(canvas);

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

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  game.update(dt);
  game.render(ctx);

  achievements.update(dt);
  achievements.render(ctx);

  input.endFrame();
}

requestAnimationFrame(loop);
