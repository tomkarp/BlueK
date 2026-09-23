import kotliteGzipBase64 from 'virtual:bluek-kotlite-gzip';
import { gunzipBase64 } from './embeddedKotlite';
import { startRuntimeWorker } from './runtimeWorker';

// The exported player has no server to fetch from: Kotlite travels in the file.
startRuntimeWorker(() => gunzipBase64(kotliteGzipBase64));
