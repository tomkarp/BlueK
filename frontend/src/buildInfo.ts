export type BuildInfo = {
  version: string;
  revision: string;
  channel: string;
  builtAt: string;
};
declare const __BLUEK_BUILD_INFO__: BuildInfo;
export const bluekBuild = __BLUEK_BUILD_INFO__;
