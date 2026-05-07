export function toAudioUrl(filePath: string) {
  if (/^[a-z]:[\\/]/i.test(filePath)) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return `file:///${encodeLocalPath(normalizedPath)}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  return `file:///${encodeLocalPath(normalizedPath)}`;
}

function encodeLocalPath(normalizedPath: string) {
  return normalizedPath
    .split("/")
    .map((segment, index) => {
      if (index === 0 && /^[a-z]:$/i.test(segment)) {
        return segment;
      }

      return encodeURIComponent(segment);
    })
    .join("/");
}
