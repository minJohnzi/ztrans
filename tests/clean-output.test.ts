import { describe, expect, it } from "vitest";
import { cleanModelOutput } from "../src/markdown/cleanModelOutput.js";

describe("cleanModelOutput", () => {
  it("trims output and removes a leading translation label", () => {
    expect(cleanModelOutput("  Here is the translation:\n\n# Title\n")).toBe("# Title");
    expect(cleanModelOutput("here IS the Translation:\nBody")).toBe("Body");
  });

  it("removes a full-output markdown fenced wrapper", () => {
    expect(cleanModelOutput("```markdown\n# Title\n\nBody\n```")).toBe("# Title\n\nBody");
    expect(cleanModelOutput("```md\n# Title\n```")).toBe("# Title");
  });

  it("keeps legitimate inner code fences", () => {
    const output = [
      "Here is the translation:",
      "",
      "# Example",
      "",
      "```ts",
      "const value = 1;",
      "```",
    ].join("\n");

    expect(cleanModelOutput(output)).toBe(
      ["# Example", "", "```ts", "const value = 1;", "```"].join("\n"),
    );
  });
});
