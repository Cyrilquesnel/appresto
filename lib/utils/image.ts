/**
 * Compresses an image file to max 1080px, 85% JPEG quality.
 * Used by DishCamera and CameraFAB to avoid sending large files to Gemini.
 */
export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.onload = () => {
      const MAX = 1080
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = (height / width) * MAX
          width = MAX
        } else {
          width = (width / height) * MAX
          height = MAX
        }
      }
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        0.85
      )
    }
    img.src = URL.createObjectURL(file)
  })
}
