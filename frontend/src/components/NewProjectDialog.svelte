<script lang="ts">
  export let newProjectOpen: boolean;
  export let projectInfo: "template" | "example" | null;
  export let chooseTemplate: (choice: string) => Promise<void>;
</script>

{#if newProjectOpen}<div class="modal topmost-modal">
    <div
      class="dialog new-project-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="new-project-title"
    >
      <h3 id="new-project-title">Create New Project</h3>
      <p>Choose a starting point:</p>
      <div class="project-choice-list">
        <div class="project-choice-row">
          <button on:click={() => chooseTemplate("empty")}
            ><strong>Empty Project</strong><span
              >Start with a blank BlueK project.</span
            ></button
          >
        </div>
        <div class="project-choice-with-info">
          <button on:click={() => chooseTemplate("empty-blueplay")}
            ><strong>BluePlay Template</strong><span
              >Start with the built-in World, Actor and Image library.</span
            ></button
          ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "template")}
            aria-label="What is BluePlay?">?</button
          >
        </div>
        <div class="project-choice-with-info">
          <button on:click={() => chooseTemplate("blueplay")}
            ><strong>BluePlay Example</strong><span
              >Open a small runnable World and Actor project.</span
            ></button
          ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "example")}
            aria-label="What is BluePlay?">?</button
          >
        </div>
        <div class="project-choice-secondary">
          <p class="project-choice-note">
            The following examples currently exist to test and demonstrate
            BlueK. They will be removed in the long run.
          </p>
          <div class="project-choice-row">
            <button on:click={() => chooseTemplate("bluek-demo")}
              ><strong>BlueK Demo Project</strong><span
                >Explore classes, inheritance and object interaction with Person
                and Student.</span
              ></button
            >
          </div>
          <div class="project-choice-row">
            <button on:click={() => chooseTemplate("space-invaders")}
              ><strong>Space Invaders Demo</strong><span
                >Play a simplified BluePlay game with a movable defender and
                invaders.</span
              ></button
            >
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button
          on:click={() => {
            newProjectOpen = false;
            projectInfo = null;
          }}>Cancel</button
        >
      </div>
      {#if projectInfo}<div
          class="project-info-panel"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
        >
          <button
            class="project-info-close"
            on:click={() => (projectInfo = null)}
            aria-label="Close BluePlay information">×</button
          >
          <h4>What is BluePlay?</h4>
          <p>
            BluePlay is a lightweight Kotlin framework for creating graphical
            games and simulations with worlds, actors and images.
          </p>
          <p>
            {projectInfo === "template"
              ? "The template provides an empty starting point."
              : "The example demonstrates a small World and Actor project."}
          </p>
          <a
            href="https://github.com/tomkarp/BluePlay"
            target="_blank"
            rel="noreferrer">View BluePlay on GitHub</a
          >
        </div>{/if}
    </div>
  </div>{/if}
