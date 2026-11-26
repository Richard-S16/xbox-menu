import assert from "node:assert/strict";
import { test } from "node:test";
import { Input } from "../src/input.ts";

const neutral = { port: 0, dpad: [false, false, false, false], x: 0, y: 0, confirm: false, back: false };

test("direction fires immediately, then at 300 and 120 ms", () => {
  const actions = [];
  const input = new Input(action => actions.push(action));
  input.keyboard("ArrowDown", true);
  input.tick(0);
  input.tick(299);
  assert.deepEqual(actions, ["down"]);
  input.tick(300);
  input.tick(419);
  input.tick(420);
  input.keyboard("ArrowDown", false);
  input.tick(1000);
  assert.deepEqual(actions, ["down", "down", "down"]);
});

test("D-pad wins over stick and reconnect requires neutral input", () => {
  const actions = [];
  const input = new Input(action => actions.push(action));
  input.controller({ ...neutral, x: 28000 });
  input.tick(0);
  input.controller(neutral);
  input.controller({ ...neutral, dpad: [true, false, false, false], x: 28000 });
  input.tick(1);
  input.controller(null);
  input.tick(501);
  input.controller({ ...neutral, confirm: true });
  input.tick(601);
  input.controller(neutral);
  input.controller({ ...neutral, confirm: true });
  input.tick(701);
  input.block();
  input.tick(1401);
  assert.deepEqual(actions, ["up", "confirm"]);
});

test("transition and blur discard held input without replay", () => {
  const actions = [];
  const input = new Input(action => actions.push(action));
  input.keyboard("Enter", true);
  input.tick(0);
  input.block();
  input.tick(650);
  input.keyboard("Enter", false);
  input.tick(700);
  input.keyboard("Escape", true);
  input.tick(800);
  input.blur();
  input.keyboard("Escape", true, true);
  input.tick(1000);
  assert.deepEqual(actions, ["confirm", "back"]);
});

test("stick engages on one axis and stays engaged through hysteresis", () => {
  const actions = [];
  const input = new Input(action => actions.push(action));
  input.controller(neutral);
  input.controller({ ...neutral, x: 16000, y: 16000 });
  input.tick(0);
  input.controller({ ...neutral, x: 19500, y: 21000 });
  input.tick(1);
  input.controller({ ...neutral, y: 16000 });
  input.tick(301);
  input.controller({ ...neutral, y: 11000 });
  input.tick(421);
  assert.deepEqual(actions, ["up", "up"]);
});
