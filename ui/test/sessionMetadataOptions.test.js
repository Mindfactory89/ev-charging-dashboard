import test from "node:test";
import assert from "node:assert/strict";

import { buildSessionMetadataOptions } from "../src/ui/sessionMetadataOptions.js";

test("buildSessionMetadataOptions merges intelligence filters with fallback session values", () => {
  const result = buildSessionMetadataOptions({
    sessions: [
      { provider: "Ionity", location: "Brohltal Ost", vehicle: "Born", tags: "hpc, reise" },
      { provider: "EnBW", location: "Hamburg", vehicle: "Born", tags: "public" },
    ],
    intelligence: {
      filters: {
        providers: ["EnBW", "Ionity"],
        locations: ["Brohltal Ost"],
        vehicles: ["Born"],
        tags: ["hpc", "reise"],
      },
    },
  });

  assert.deepEqual(result.providers, ["EnBW", "Ionity"]);
  assert.deepEqual(result.tags, ["hpc", "reise"]);
});
