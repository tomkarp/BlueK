const downloads = 'https://github.com/tomkarp/BlueK/releases/download/';

export const updateFeed = new URL('bluek-desktop-updates/', downloads).href;
export const updateEndpoint = new URL('latest.json', updateFeed).href;
export const installerFeed = version => new URL(`bluek-v${version}/`, downloads).href;
