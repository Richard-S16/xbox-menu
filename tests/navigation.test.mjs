import assert from "node:assert/strict";
import { test } from "node:test";
import { nextFocus } from "../src/navigation.ts";

test("Home stops at both edges and confirmations use left and right", () => {
  const home = ["memory", "music", "live", "settings"].map(id => ({ id }));
  assert.equal(nextFocus(home, "music", "up", "list"), "memory");
  assert.equal(nextFocus(home, "memory", "up", "list"), undefined);
  assert.equal(nextFocus(home, "settings", "down", "list"), undefined);
  assert.equal(nextFocus(home, "music", "right", "list"), undefined);
  const confirmation = [{ id: "cancel" }, { id: "remove" }];
  assert.equal(nextFocus(confirmation, "cancel", "down", "confirmation"), undefined);
  assert.equal(nextFocus(confirmation, "cancel", "right", "confirmation"), "remove");
  assert.equal(nextFocus(confirmation, "remove", "left", "confirmation"), "cancel");
});

test("the soundtrack moves between the selected track and transport controls", () => {
  const rows = [
    { id: "track-1" }, { id: "track-2" },
    ...["previous", "play", "stop", "next", "options"].map(id => ({ id, group: "transport" })),
  ];
  assert.equal(nextFocus(rows, "track-1", "down", "player"), "track-2");
  assert.equal(nextFocus(rows, "track-2", "down", "player"), "play");
  assert.equal(nextFocus(rows, "play", "right", "player"), "stop");
  assert.equal(nextFocus(rows, "stop", "up", "player", "track-2"), "track-2");
  assert.equal(nextFocus(rows, "options", "right", "player"), undefined);
});
