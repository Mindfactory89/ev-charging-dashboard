const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeTagsInput, parseTags } = require("../lib/sessionMetadata");

test("normalizeTagsInput trims and deduplicates tags", () => {
  assert.equal(normalizeTagsInput(["#HPC", " hpc ", "reise", ""]), "HPC, reise");
});

test("parseTags returns normalized tag list", () => {
  assert.deepEqual(parseTags("urlaub, #HPC, urlaub"), ["urlaub", "HPC"]);
});
