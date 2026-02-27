import { describe, expect, it } from "bun:test";
import { healthcheck } from "../src/index";

describe("scaffold", () => {
  it("returns ok", () => {
    expect(healthcheck()).toBe("ok");
  });
});
