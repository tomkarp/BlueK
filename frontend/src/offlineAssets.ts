/** Replaced only by the single-file build; hosted BlueK loads static assets. */
export interface OfflineAssets {
  projectTemplates: Record<string, unknown>;
  playerTemplate: string;
  formatterGzipBase64: string;
}
const offlineAssets: OfflineAssets | null = null;
export default offlineAssets;
