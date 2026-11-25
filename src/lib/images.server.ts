import "server-only";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Detecta o tipo real pelo conteúdo (não confia na extensão nem no Content-Type do navegador). */
export function detectImageType(
  bytes: Uint8Array,
): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/** Lê e valida um arquivo de imagem vindo de FormData. */
export async function readImageFile(
  file: FormDataEntryValue | null,
): Promise<{ bytes: Uint8Array; ext: string; mime: string } | null> {
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  return type ? { bytes, ...type } : null;
}
