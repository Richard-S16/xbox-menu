export const directions = ["up", "down", "left", "right"] as const;
export type Direction = typeof directions[number];
export type Action = Direction | "confirm" | "back";

export type PadState = {
  port: number;
  dpad: boolean[];
  x: number;
  y: number;
  confirm: boolean;
  back: boolean;
};

const keys: Record<string, Action> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Enter: "confirm", Escape: "back",
};

export class Input {
  private keys = new Set<Action>();
  private pad: PadState | null = null;
  private keyboardBlocked = false;
  private padBlocked = true;
  private axis: Direction | undefined;
  private direction: Direction | undefined;
  private repeatAt = 0;
  private confirm = false;
  private back = false;
  private readonly dispatch: (action: Action) => void;

  constructor(dispatch: (action: Action) => void) {
    this.dispatch = dispatch;
  }

  keyboard(code: string, pressed: boolean, repeat = false) {
    const action = keys[code];
    if (!action) return false;
    if (repeat) return true;
    if (pressed) this.keys.add(action);
    else this.keys.delete(action);
    if (!this.keys.size) this.keyboardBlocked = false;
    return true;
  }

  controller(pad: PadState | null) {
    if (pad?.port !== this.pad?.port) {
      this.padBlocked = true;
      this.axis = undefined;
      this.direction = undefined;
    }
    this.pad = pad;
    if (pad && !pad.confirm && !pad.back && !pad.dpad.some(Boolean) &&
        Math.max(Math.abs(pad.x), Math.abs(pad.y)) <= 0.4 * 32768) {
      this.padBlocked = false;
    }
  }

  block() {
    this.keyboardBlocked = this.keys.size > 0;
    if (this.axis || this.pad?.dpad.some(Boolean) || this.pad?.confirm || this.pad?.back) {
      this.padBlocked = true;
    }
    this.direction = undefined;
    this.axis = undefined;
    this.confirm = false;
    this.back = false;
  }

  blur() {
    this.keys.clear();
    this.controller(null);
    this.block();
  }

  tick(now: number) {
    const pad = this.padBlocked ? null : this.pad;
    const down = (action: Action) => !this.keyboardBlocked && this.keys.has(action);
    const confirm = down("confirm") || Boolean(pad?.confirm);
    const back = down("back") || Boolean(pad?.back);
    const button = back && !this.back ? "back" : confirm && !this.confirm ? "confirm" : null;
    this.confirm = confirm;
    this.back = back;

    const direction = directions.find((_, index) => pad?.dpad[index])
      ?? this.stickDirection(pad)
      ?? directions.find(down);
    const changed = direction !== this.direction;
    this.direction = direction;
    if (changed) this.repeatAt = now + 300;
    if (button) {
      this.dispatch(button);
    } else if (direction && (changed || now >= this.repeatAt)) {
      if (!changed) this.repeatAt = now + 120;
      this.dispatch(direction);
    }
  }

  private stickDirection(pad: PadState | null) {
    if (!pad) return this.axis = undefined;
    // Keep the engaged direction through the release band unless a new axis clearly wins.
    const held = { up: pad.y, down: -pad.y, left: -pad.x, right: pad.x };
    const dominant = directions.reduce((a, b) => held[a] >= held[b] ? a : b);
    if (held[dominant] >= 0.55 * 32768) this.axis = dominant;
    else if (this.axis && held[this.axis] <= 0.4 * 32768) this.axis = undefined;
    return this.axis;
  }
}
