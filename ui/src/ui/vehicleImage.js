export const VEHICLE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const VEHICLE_IMAGE_MAX_INPUT_BYTES = 12 * 1024 * 1024;
export const VEHICLE_IMAGE_MAX_DATA_URL_LENGTH = 480_000;

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SAFE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;

export function validateVehicleImageFile(file) {
  if (!file) return { valid: false, error: "missing" };
  if (!SUPPORTED_TYPES.has(String(file.type || "").toLowerCase())) {
    return { valid: false, error: "type" };
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > VEHICLE_IMAGE_MAX_INPUT_BYTES) {
    return { valid: false, error: "size" };
  }
  return { valid: true, error: null };
}

export function isSafeVehicleImageDataUrl(value) {
  return typeof value === "string"
    && value.length <= VEHICLE_IMAGE_MAX_DATA_URL_LENGTH
    && SAFE_DATA_URL.test(value);
}

export function calculateCoverCrop(sourceWidth, sourceHeight, targetAspect = 16 / 9) {
  const width = Number(sourceWidth);
  const height = Number(sourceHeight);
  if (!(width > 0) || !(height > 0) || !(targetAspect > 0)) return null;
  const sourceAspect = width / height;
  if (sourceAspect > targetAspect) {
    const cropWidth = height * targetAspect;
    return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height };
  }
  const cropHeight = width / targetAspect;
  return { x: 0, y: (height - cropHeight) / 2, width, height: cropHeight };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("decode"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode"));
    image.src = src;
  });
}

function renderImage(image, crop, width, height, mimeType, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("output");
  context.fillStyle = "#090c11";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}

export async function processVehicleImageFile(file) {
  const validation = validateVehicleImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const crop = calculateCoverCrop(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (!crop) throw new Error("decode");

  const attempts = [
    [1200, 675, 0.82],
    [1080, 608, 0.72],
    [960, 540, 0.64],
    [800, 450, 0.56],
  ];
  for (const [width, height, quality] of attempts) {
    let result = renderImage(image, crop, width, height, "image/webp", quality);
    if (!result.startsWith("data:image/webp")) {
      result = renderImage(image, crop, width, height, "image/jpeg", quality);
    }
    if (isSafeVehicleImageDataUrl(result)) return result;
  }
  throw new Error("output");
}
