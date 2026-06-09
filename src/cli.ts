#!/usr/bin/env node

import { packageVersion } from "./index.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`md-bilingual-translator ${packageVersion}\n`);
}
