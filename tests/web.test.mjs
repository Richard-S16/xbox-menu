import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listWebSaves, removeWebSave, readWebPreferences, writeWebPreferences, readWebGamepad,
} from "../src/web.ts";

test("web storage preserves removals and preferences without restoring fullscreen", t => {
  const data = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  const defaults = { language: "en", hour24: false, volume: 100, muted: false, fullscreen: false, reducedMotion: false };
  assert.deepEqual(readWebPreferences(defaults), defaults);
  const samples = listWebSaves();
  assert.equal(samples.length, 3);
  for (const { id } of samples) removeWebSave(id);
  assert.deepEqual(listWebSaves(), []);

  writeWebPreferences({ ...defaults, language: "pt-BR", muted: true, fullscreen: true });
  assert.deepEqual(readWebPreferences(defaults), { ...defaults, language: "pt-BR", muted: true });
});

test("the web adapter maps standard controllers and keeps the active port", t => {
  const buttons = Array.from({ length: 16 }, (_, index) => ({ pressed: index === 0 || index === 12 }));
  const pad = { index: 1, mapping: "standard", axes: [0.5, -0.75], buttons };
  t.mock.method(globalThis, "navigator", () => ({
    getGamepads: () => [null, pad, { ...pad, index: 2, mapping: "" }, { ...pad, index: 3 }],
  }), { getter: true });
  assert.deepEqual(readWebGamepad(), {
    port: 1, dpad: [true, false, false, false], x: 16384, y: 24576, confirm: true, back: false,
  });
  assert.equal(readWebGamepad(3).port, 3);
});
