/** Square crop for profile photos so the demo store stays small. */
export function fileToAvatar(file: File): Promise<string> {
  return resizeImage(file, { size: 256, crop: "square" });
}

/** Keep aspect ratio at a readable size for ID / license review. */
export function fileToDocumentPreview(file: File): Promise<string> {
  return resizeImage(file, { maxEdge: 1600, crop: "fit" });
}

function resizeImage(
  file: File,
  options: { size: number; crop: "square" } | { maxEdge: number; crop: "fit" },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("no canvas"));
        return;
      }

      if (options.crop === "square") {
        const size = options.size;
        canvas.width = size;
        canvas.height = size;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - min) / 2,
          (img.height - min) / 2,
          min,
          min,
          0,
          0,
          size,
          size,
        );
      } else {
        const scale = Math.min(1, options.maxEdge / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}
