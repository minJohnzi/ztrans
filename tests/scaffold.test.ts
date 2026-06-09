import { describe, expect, it } from "vitest";
import { packageVersion } from "../src/index.js";

describe("scaffold", () => {
  it("exports the package version placeholder", () => {
    expect(packageVersion).toBe("0.1.0");
  });
});
