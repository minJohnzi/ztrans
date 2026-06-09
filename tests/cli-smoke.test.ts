import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CLI scaffold", () => {
  it("relies on the tsup banner for its shebang", async () => {
    const source = await readFile(new URL("../src/cli.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/^#!/);
  });
});
