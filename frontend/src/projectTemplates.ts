import offlineAssets from './offlineAssets';
import desktopProjectTemplates from 'virtual:bluek-project-templates';

const templateFiles: Record<string, string> = {
  'empty-blueplay': 'blueplay-empty.bluek',
  blueplay: 'blueplay.bluek',
};

/** Static HTTP assets online, fresh copies of embedded payloads under file://. */
export async function projectTemplate(choice: string): Promise<unknown> {
  const file = templateFiles[choice];
  if (!file) throw new Error('Project template could not be found.');
  if (offlineAssets) return structuredClone(offlineAssets.projectTemplates[file]);
  if (desktopProjectTemplates) return structuredClone(desktopProjectTemplates[file]);
  const response = await fetch(`./examples/${file}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load project template.');
  return response.json();
}
