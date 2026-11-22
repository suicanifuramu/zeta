/**
 * Prepares a local image the way the official app does before upload (ds-max §5.3):
 * at most 10 MB as picked, long edge ≤ 2048 px, re-encoded as JPEG (quality 0.9).
 * HEIC/HEIF are not accepted here because browsers cannot decode them reliably.
 */

import { UserError } from "@/lib/user-error"

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const IMAGE_MAX_EDGE = 2048
export const IMAGE_MIN_EDGE = 224
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const
export const ACCEPTED_IMAGE_ATTR = ACCEPTED_IMAGE_MIME.join(",")

export interface PreparedImage {
  blob: Blob
  fileName: string
  width: number
  height: number
  aspectRatio: number
}

/** Rejected local picks; the message is Japanese and safe to show. */
export class ImageRejectedError extends UserError {}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!(ACCEPTED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    throw new ImageRejectedError("JPG・PNG・WEBP の画像を選んでください")
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ImageRejectedError("10MB以下の画像を選んでください")
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageRejectedError("この画像は読み込めませんでした。別の画像を選んでください")
  }
  if (Math.min(bitmap.width, bitmap.height) < IMAGE_MIN_EDGE) {
    bitmap.close()
    throw new ImageRejectedError(`画像は${IMAGE_MIN_EDGE}px以上のものを選んでください`)
  }
  const longEdge = Math.max(bitmap.width, bitmap.height)
  const scale = longEdge > IMAGE_MAX_EDGE ? IMAGE_MAX_EDGE / longEdge : 1
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    throw new ImageRejectedError("画像を変換できませんでした")
  }
  // JPEG has no alpha: paint a white background first.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
  if (!blob) throw new ImageRejectedError("画像を変換できませんでした")

  const base = file.name.replace(/\.[^.]+$/, "") || "image"
  return {
    blob,
    fileName: `${base}.jpg`,
    width,
    height,
    aspectRatio: width / height,
  }
}
