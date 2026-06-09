export function cleanModelOutput(output: string): string {
  let cleaned = output.trim();

  cleaned = cleaned.replace(/^here is the translation:\s*/i, "").trim();
  cleaned = removeFullOutputFence(cleaned);

  return cleaned.trim();
}

function removeFullOutputFence(output: string): string {
  const lines = output.split(/\r?\n/);
  const firstLine = lines[0]?.trim();
  const lastLine = lines.at(-1)?.trim();

  if (!firstLine || !lastLine) {
    return output;
  }

  if (!/^```(?:markdown|md)?\s*$/i.test(firstLine) || lastLine !== "```") {
    return output;
  }

  return lines.slice(1, -1).join("\n").trim();
}
