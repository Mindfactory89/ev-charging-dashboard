import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCoverCrop,
  isSafeVehicleImageDataUrl,
  validateVehicleImageFile,
  VEHICLE_IMAGE_MAX_INPUT_BYTES,
} from "../src/ui/vehicleImage.js";

test("vehicle image validation accepts supported images within the size limit", () => {
  assert.deepEqual(validateVehicleImageFile({ type: "image/jpeg", size: 2_000_000 }), { valid: true, error: null });
  assert.equal(validateVehicleImageFile({ type: "image/svg+xml", size: 2_000 }).error, "type");
  assert.equal(validateVehicleImageFile({ type: "image/png", size: VEHICLE_IMAGE_MAX_INPUT_BYTES + 1 }).error, "size");
});

test("vehicle image data URLs reject executable or remote content", () => {
  assert.equal(isSafeVehicleImageDataUrl("data:image/webp;base64,UklGRg=="), true);
  assert.equal(isSafeVehicleImageDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isSafeVehicleImageDataUrl("https://example.com/car.jpg"), false);
});

test("cover crop keeps a centered sixteen by nine composition", () => {
  assert.deepEqual(calculateCoverCrop(1600, 1200), { x: 0, y: 150, width: 1600, height: 900 });
  assert.deepEqual(calculateCoverCrop(2400, 900), { x: 400, y: 0, width: 1600, height: 900 });
  assert.equal(calculateCoverCrop(0, 900), null);
});
