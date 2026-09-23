import { byteStream } from './byteStream';

/** Decodes the Kotlite bundle an exported HTML file carries as gzip + base64. */
export async function gunzipBase64(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Response(byteStream(bytes).pipeThrough(new DecompressionStream('gzip'))).text();
}
