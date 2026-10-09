<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { containClicks } from "../uiActions";

  import { standardImages, standardSounds } from "../standardImages";
  import { MEDIA, resourceBytes, type MediaKind } from "../projectMedia";
  import type { ProjectResource } from "../../../runtime-contract/src/index";
  export let imageLibraryOpen: boolean;
  export let soundLibraryOpen: boolean;
  export let images: ProjectResource[];
  export let sounds: ProjectResource[];
  export let mediaErrors: Record<MediaKind, string>;
  export let addMedia: (kind: MediaKind, files: File[]) => Promise<void>;
  export let renameMedia: (kind: MediaKind, path: string) => void;
  export let removeMedia: (kind: MediaKind, path: string) => void;
  export let libraryId: string;

  let imageInput: HTMLInputElement;
  let soundInput: HTMLInputElement;
  let preview: HTMLAudioElement | null = null;
  let previewPath = "";
  const megabytes = (kind: MediaKind) => String(MEDIA[kind].maxBytes / 1024 / 1024);
  const fileName = (path: string) => path.split("/").at(-1) || path;
  const sizeText = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  // A project file replaces the standard file with the same name.
  const notReplaced = (standard: ProjectResource[], own: ProjectResource[]) =>
    standard.filter((item) => !own.some((resource) => resource.path === item.path));

  function stopPreview() {
    preview?.pause();
    preview = null;
    previewPath = "";
  }
  function togglePreview(sound: ProjectResource) {
    const same = previewPath === sound.path;
    stopPreview();
    if (same) return;
    const element = new Audio(sound.data);
    preview = element;
    previewPath = sound.path;
    element.addEventListener("ended", () => {
      if (preview === element) stopPreview();
    });
    element.play().catch(() => {
      if (preview === element) stopPreview();
    });
  }
  async function choose(kind: MediaKind, input: HTMLInputElement) {
    const files = Array.from(input.files || []);
    input.value = "";
    if (files.length) await addMedia(kind, files);
  }
  function closeImages() {
    mediaErrors.image = "";
    imageLibraryOpen = false;
  }
  function closeSounds() {
    stopPreview();
    mediaErrors.sound = "";
    soundLibraryOpen = false;
  }
  $: if (!soundLibraryOpen && preview) stopPreview();
  $: soundGroups = [
    { key: "project", title: t("ui.media.projectSounds"), sounds, removable: true },
    {
      key: "standard",
      title: t("ui.media.standardSounds"),
      sounds: notReplaced(standardSounds, sounds),
      removable: false,
    },
  ];
  $: visibleStandardImages = notReplaced(standardImages, images);
</script>

{#if imageLibraryOpen && libraryId === "blueplay"}<div
    class="modal topmost-modal"
    role="presentation"
  >
    <div
      class="dialog image-library-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="images-title"
      use:containClicks
    >
      <h3 id="images-title">{t("ui.common.images")}</h3>
      <p class="media-library-hint">
        {t("ui.media.imageHint", [megabytes("image"), String(MEDIA.image.maxSide)])}
      </p>
      <h4 class="media-group-title">{t("ui.media.projectImages")}</h4>
      <div class="standard-image-grid project-image-grid">
        <button
          class="standard-image-tile standard-image-add"
          on:click={() => imageInput.click()}
          aria-label={t("ui.media.addImage")}
          title={t("ui.media.addImage")}
          ><span aria-hidden="true">+</span></button
        >
        {#each images as resource (resource.path)}
          <div
            class="standard-image-tile project-image-tile"
            role="group"
            aria-label={fileName(resource.path)}
          >
            <div class="standard-image-preview">
              <img src={resource.data} alt={fileName(resource.path)} />
            </div>
            <span
              title={`${fileName(resource.path)}, ${sizeText(resourceBytes(resource))}`}
              >{fileName(resource.path)}</span
            >
            <div class="media-actions">
              <button
                class="media-rename"
                on:click={() => renameMedia("image", resource.path)}
                aria-label={t("ui.media.renameImage", [fileName(resource.path)])}
                title={t("ui.media.renameImage", [fileName(resource.path)])}
                ><svg viewBox="0 0 24 24" aria-hidden="true"
                  ><path d="M4 20h4L19 9l-4-4L4 16z" /><path
                    d="m13.5 6.5 4 4"
                  /></svg
                ></button
              ><button
                class="media-remove"
                on:click={() => removeMedia("image", resource.path)}
                aria-label={t("ui.media.removeImage", [fileName(resource.path)])}
                title={t("ui.media.removeImage", [fileName(resource.path)])}
                >×</button
              >
            </div>
          </div>
        {/each}
      </div>
      {#if !images.length}<p class="media-empty">{t("ui.media.noImages")}</p>{/if}
      {#if mediaErrors.image}<p class="media-error" role="alert">
          {mediaErrors.image}
        </p>{/if}
      <input
        bind:this={imageInput}
        class="media-file-input"
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        multiple
        hidden
        aria-label={t("ui.media.addImage")}
        on:change={() => choose("image", imageInput)}
      />
      <h4 class="media-group-title">{t("ui.media.standardImages")}</h4>
      <div class="standard-image-grid standard-image-list">
        {#each visibleStandardImages as resource (resource.path)}
          <div class="standard-image-tile" aria-label={fileName(resource.path)}>
            <div class="standard-image-preview">
              <img src={resource.data} alt={fileName(resource.path)} />
            </div>
            <span>{fileName(resource.path)}</span>
          </div>
        {/each}
      </div>
      <div class="dialog-actions">
        <button on:click={closeImages}>{t("ui.common.close")}</button>
      </div>
    </div>
  </div>{/if}
{#if soundLibraryOpen && libraryId === "blueplay"}<div
    class="modal topmost-modal"
    role="presentation"
  >
    <div
      class="dialog sound-library-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="sounds-title"
      use:containClicks
    >
      <h3 id="sounds-title">{t("ui.toolbar.audio")}</h3>
      <p class="media-library-hint">
        {t("ui.media.soundHint", [megabytes("sound")])}
      </p>
      {#each soundGroups as group (group.key)}
        <h4 class="media-group-title">{group.title}</h4>
        {#if group.sounds.length}
          <ul class="sound-list" aria-label={group.title}>
            {#each group.sounds as sound (sound.path)}
              <li class="sound-row">
                <button
                  class="sound-play"
                  class:active={previewPath === sound.path}
                  on:click={() => togglePreview(sound)}
                  aria-label={previewPath === sound.path
                    ? t("ui.media.stopSound", [fileName(sound.path)])
                    : t("ui.media.playSound", [fileName(sound.path)])}
                  title={previewPath === sound.path
                    ? t("ui.media.stopSound", [fileName(sound.path)])
                    : t("ui.media.playSound", [fileName(sound.path)])}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {#if previewPath === sound.path}<rect
                        x="6"
                        y="6"
                        width="12"
                        height="12"
                      />{:else}<path d="M8 5v14l11-7z" />{/if}
                  </svg>
                </button>
                <code class="sound-name">{fileName(sound.path)}</code>
                <span class="sound-size">{sizeText(resourceBytes(sound))}</span>
                {#if group.removable}<button
                    class="media-rename"
                    on:click={() => {
                      if (previewPath === sound.path) stopPreview();
                      renameMedia("sound", sound.path);
                    }}
                    aria-label={t("ui.media.renameSound", [fileName(sound.path)])}
                    title={t("ui.media.renameSound", [fileName(sound.path)])}
                    ><svg viewBox="0 0 24 24" aria-hidden="true"
                      ><path d="M4 20h4L19 9l-4-4L4 16z" /><path
                        d="m13.5 6.5 4 4"
                      /></svg
                    ></button
                  ><button
                    class="media-remove"
                    on:click={() => {
                      if (previewPath === sound.path) stopPreview();
                      removeMedia("sound", sound.path);
                    }}
                    aria-label={t("ui.media.removeSound", [fileName(sound.path)])}
                    title={t("ui.media.removeSound", [fileName(sound.path)])}
                    >×</button
                  >{/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="media-empty">{t("ui.media.noSounds")}</p>
        {/if}
      {/each}
      {#if mediaErrors.sound}<p class="media-error" role="alert">
          {mediaErrors.sound}
        </p>{/if}
      <input
        bind:this={soundInput}
        class="media-file-input"
        type="file"
        accept=".wav,.mp3,audio/wav,audio/mpeg"
        multiple
        hidden
        aria-label={t("ui.media.addSound")}
        on:change={() => choose("sound", soundInput)}
      />
      <div class="dialog-actions">
        <button on:click={() => soundInput.click()}
          >{t("ui.media.addSound")}</button
        >
        <button on:click={closeSounds}>{t("ui.common.close")}</button>
      </div>
    </div>
  </div>{/if}
