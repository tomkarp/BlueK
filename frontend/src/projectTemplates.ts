import offlineAssets from './offlineAssets';

const templateFiles: Record<string, string> = {
  'empty-blueplay': 'blueplay-empty.bluek.json',
  blueplay: 'blueplay.bluek.json',
  'bluek-demo': 'kotlin-example.bluek.json',
  'space-invaders': 'space-invaders.bluek.json',
};

/** Static HTTP assets online, fresh copies of embedded payloads under file://. */
export async function projectTemplate(choice: string): Promise<unknown> {
  const file = templateFiles[choice];
  if (!file) throw new Error('Project template could not be found.');
  if (offlineAssets) return structuredClone(offlineAssets.projectTemplates[file]);
  const response = await fetch(`./examples/${file}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load project template.');
  return response.json();
}
