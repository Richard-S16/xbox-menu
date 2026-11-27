import assert from "node:assert/strict";
import { test } from "node:test";
import { playIntro } from "../src/startup.ts";
import { Input } from "../src/input.ts";

class Clip extends EventTarget {
  paused = false;
  play() { return Promise.resolve(); }
  pause() { this.paused = true; }
}

test("an intro skipped before startup never loads the clip", async () => {
  const video = new Clip();
  assert.equal(await playIntro(video, AbortSignal.abort()), true);
  assert.equal(video.src, undefined);
});

test("the intro hands off on natural end, media error, or autoplay rejection", async () => {
  for (const type of ["ended", "error"]) {
    const video = new Clip();
    const result = playIntro(video, new AbortController().signal);
    video.dispatchEvent(new Event(type));
    assert.equal(await result, false);
    assert.equal(video.paused, true);
  }
  const rejected = new Clip();
  rejected.play = () => Promise.reject(new Error("Cannot play"));
  assert.equal(await playIntro(rejected, new AbortController().signal), false);
  assert.equal(rejected.paused, true);
});

test("holding the keyboard or controller skip does not confirm on Home", async () => {
  for (const device of ["keyboard", "controller"]) {
    const skip = new AbortController();
    const neutral = { port: 0, dpad: [false, false, false, false], x: 0, y: 0, confirm: false, back: false };
    let starting = true;
    let confirmed = 0;
    const input = new Input(action => {
      if (action !== "confirm") return;
      if (starting) skip.abort();
      else confirmed++;
    });
    const press = held => device === "keyboard"
      ? input.keyboard("Enter", held)
      : input.controller({ ...neutral, confirm: held });
    press(false);
    const video = new Clip();
    const result = playIntro(video, skip.signal);
    press(true);
    input.tick(0);
    assert.equal(await result, true);
    assert.equal(video.paused, true);
    input.block();
    starting = false;
    input.tick(400);
    assert.equal(confirmed, 0);
    press(false);
    input.tick(410);
    press(true);
    input.tick(420);
    assert.equal(confirmed, 1);
  }
});
