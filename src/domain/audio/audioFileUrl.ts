export function toAudioUrl(filePath: string) {
  if (/^[a-z]:[\\/]/i.test(filePath)) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return `file:///${encodeURI(normalizedPath)}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  return `file:///${encodeURI(normalizedPath)}`;
}
