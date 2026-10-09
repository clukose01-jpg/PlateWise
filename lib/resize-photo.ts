// Phone photos are often 5–12 MB. Shrinking them before upload keeps scans fast,
// stays under the hosting upload limit, and lowers the cost of each scan.
// Several photos sent together are shrunk a bit more so they all fit in one upload.
const JPEG_QUALITY = 0.85;

export async function resizePhoto(file: File, maxEdgePx = 2048): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdgePx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not shrink photo"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
