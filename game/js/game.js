export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export class Game {
  constructor() {
    this.scenes = [];
  }

  pushScene(scene) {
    const current = this.currentScene();
    if (current && current.exit) current.exit();
    this.scenes.push(scene);
    if (scene.enter) scene.enter();
  }

  popScene() {
    if (this.scenes.length === 0) return null;
    const removed = this.scenes.pop();
    if (removed.exit) removed.exit();
    const current = this.currentScene();
    if (current && current.enter) current.enter();
    return removed;
  }

  currentScene() {
    return this.scenes.length > 0 ? this.scenes[this.scenes.length - 1] : null;
  }

  update(dt) {
    const current = this.currentScene();
    if (current && current.update) current.update(dt);
  }

  render(ctx) {
    for (const scene of this.scenes) {
      if (scene.render) scene.render(ctx);
    }
  }

  handleInput(event) {
    const current = this.currentScene();
    if (current && current.onInput) current.onInput(event);
  }
}
