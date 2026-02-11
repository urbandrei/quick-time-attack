export class Entity {
  constructor({ x = 0, y = 0, width = 32, height = 32, color = '#ffffff' } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.active = true;
  }

  update(dt) {}

  render(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
  }
}
