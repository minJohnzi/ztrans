import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildCliProgram } from "../src/cli.js";

describe("CLI scaffold", () => {
  it("relies on the tsup banner for its shebang", async () => {
    const source = await readFile(new URL("../src/cli.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/^#!/);
  });

  it("does not terminate with process.exit from the source entrypoint", async () => {
    const source = await readFile(new URL("../src/cli.ts", import.meta.url), "utf8");

    expect(source).not.toContain("process.exit(");
  });

  it("smoke-runs init through the Commander program", async () => {
    let stdout = "";
    const program = buildCliProgram({
      stdout: {
        write: (chunk: string) => {
          stdout += chunk;
        },
      },
      stderr: { write: () => undefined },
    });

    await program.parseAsync(["node", "md-translator", "init"], { from: "node" });

    expect(stdout).toContain("provider:");
    expect(stdout).toContain("translation:");
  });
});
