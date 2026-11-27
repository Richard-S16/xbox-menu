import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/player.ts";

class TestAudio extends EventTarget {
  src = "";
  getAttribute() { return this.src || null; }
  removeAttribute() { this.src = ""; }
  load() {}
  pause() {}
  play() { return Promise.resolve(); }
}

test("stopping or switching ignores an older playback request", async () => {
  globalThis.Audio = TestAudio;
  try {
    const pending = new Map();
    const states = [];
    const player = new Player(id => new Promise(resolve => pending.set(id, resolve)), () => {
      states.push([player.id, player.state]);
    }, () => {});

    const first = player.play(1);
    player.stop();
    pending.get(1)("first");
    await first;
    assert.equal(player.state, "Stopped");
    assert.equal(player.id, undefined);

    const second = player.play(2);
    const third = player.play(3);
    pending.get(3)("third");
    await third;
    pending.get(2)("second");
    await second;
    assert.deepEqual(states.at(-1), [3, "Playing"]);
    player.pause();
    assert.deepEqual(states.at(-1), [3, "Paused"]);
  } finally {
    delete globalThis.Audio;
  }
});
