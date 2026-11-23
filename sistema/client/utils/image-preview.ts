export function safeImagePreview(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return undefined;
  return value;
}
