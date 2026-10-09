// Optimización de imágenes en el navegador antes de subirlas (spec/06 RF-ANX-03): lado máximo
// 2560 px, WebP (o JPEG si el navegador no lo soporta), orientación corregida y sin metadatos
// (el canvas no conserva EXIF, así que se va también la ubicación GPS).

const LADO_MAX = 2560;
const CALIDAD = 0.8;
const OPTIMIZABLES = ["image/jpeg", "image/png", "image/webp"];

const aBlob = (c: HTMLCanvasElement, tipo: string) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, CALIDAD));

export async function optimizarImagen(archivo: File): Promise<File> {
  if (!OPTIMIZABLES.includes(archivo.type)) return archivo;
  const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  let blob = await aBlob(canvas, "image/webp");
  // Safari viejo devuelve PNG cuando no soporta WebP: en ese caso, JPEG.
  if (!blob || blob.type !== "image/webp") blob = await aBlob(canvas, "image/jpeg");
  if (!blob || blob.size >= archivo.size) return archivo; // ya estaba liviana
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + `.${ext}`, { type: blob.type });
}
