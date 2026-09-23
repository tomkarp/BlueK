/**
 * A stream of the given bytes for `CompressionStream`/`DecompressionStream`.
 * `new Blob([bytes]).stream()` would be shorter, but it fails in WebKit for
 * pages opened from `file://`, which is how exported programs run.
 */
export function byteStream(bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
