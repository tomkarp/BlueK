<script lang="ts">
  import { containClicks, focusOnMount } from "../uiActions";
  export let close: () => void;
  const sections = [
    ["start", "Quick start"],
    ["objects", "Objects & codepad"],
    ["projects", "Projects & saving"],
    ["state", "Saved state"],
    ["tests", "Testing"],
    ["kotlin", "Kotlin compatibility"],
    ["blueplay", "BluePlay"],
    ["shortcuts", "Keyboard shortcuts"],
    ["troubleshooting", "Troubleshooting"],
  ] as const;
  let selected: (typeof sections)[number][0] = "start";
  let content: HTMLElement;
  function select(id: typeof selected) {
    selected = id;
    if (content) content.scrollTop = 0;
  }
</script>

<div class="modal topmost-modal" role="presentation">
  <div
    class="dialog user-help-dialog"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-labelledby="user-help-title"
    use:containClicks
    use:focusOnMount
  >
    <header>
      <h3 id="user-help-title">BlueK Help</h3>
    </header>
    <div class="user-help-layout">
      <nav aria-label="Help sections">
        {#each sections as [id, title]}
          <button
            aria-current={selected === id ? "page" : undefined}
            on:click={() => select(id)}>{title}</button
          >
        {/each}
      </nav>
      <!-- The scrollable reading area needs keyboard focus for Page Up/Down. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <article
        bind:this={content}
        tabindex="0"
        aria-label={sections.find(([id]) => id === selected)?.[1]}
      >
        {#if selected === "start"}
          <h4>Quick start</h4>
          <p>
            BlueK runs Kotlin in your browser. You can run a program through <code
              >main</code
            > or create objects and call their methods directly.
          </p>
          <ol>
            <li>
              Choose <strong>New Project</strong> for an empty project, a
              template or a demo. Use <strong>Open / Import</strong> for an existing
              project.
            </li>
            <li>
              Choose <strong>New File</strong>, enter a name and select its
              type. Double-click a card to edit its code.
            </li>
            <li>
              Click <strong>Compile</strong>. Errors link to their file and
              line.
            </li>
            <li>
              Right-click a class to create an object, or click <strong
                >Start main</strong
              > to run an entry point.
            </li>
            <li>
              Use <strong>Save / Export → Export Project JSON</strong> to keep a portable
              copy.
            </li>
          </ol>
          <h5>A first class</h5>
          <pre><code
              >{`class Counter {
    var value = 0
    fun increment() { value++ }
}`}</code
            ></pre>
          <p>
            Create a Counter, call <code>increment()</code> from its context
            menu and double-click the object to inspect <code>value</code>.
          </p>
          <h5>Workspace reference</h5>
          <ul>
            <li>
              <strong>Diagram:</strong> files and classes. Drag cards to arrange them;
              use the inheritance tool to select a subclass, then its superclass.
            </li>
            <li>
              <strong>Object bench:</strong> named live objects.
            </li>
            <li>
              <strong>Codepad:</strong> Kotlin expressions and statements. The arrow
              beside the bench shows or hides it.
            </li>
            <li>
              <strong>Terminal:</strong> program output and input. Its top-right icon
              cycles between closed, window and split views.
            </li>
            <li>
              <strong>View icons:</strong> terminal, inheritance arrows and test-class
              visibility.
            </li>
            <li>
              <strong>Bottom-left icons:</strong> offline download, Help and Settings.
              Settings controls dark mode, editor font size and Vim mode.
            </li>
          </ul>
          <h5>Editing</h5>
          <p>
            Use the editor’s <strong>//</strong> button to comment or uncomment
            selected lines and <strong>≡</strong> to format the file. Open files can
            be arranged in tabs or separate windows.
          </p>
          <h5>Running a complete program</h5>
          <p>
            Choose <strong>Kotlin Functions</strong> in New File and write
            <code>fun main() &#123; /* your code */ &#125;</code>. Start main is
            disabled without an entry point. With several entry points, choose
            the file each time. <code>main(args: Array&lt;String&gt;)</code> receives
            an empty array.
          </p>
          <p>
            <strong>Compile</strong> creates a fresh session and clears live
            objects and codepad variables. Source changes require recompilation.
            <strong>Stop</strong> ends a running operation, including an endless loop
            or input wait.
          </p>
        {:else if selected === "objects"}
          <h4>Objects &amp; codepad</h4>
          <h5>Creating and using objects</h5>
          <p>
            Right-click a class to choose a constructor. Enter a name and Kotlin
            expressions for its arguments. Right-click a bench object to call a
            method. Clicking another bench object can insert its name into an
            argument field.
          </p>
          <p>
            A returned value appears in a result dialog. <strong>Get</strong> gives
            it a name on the bench. Get preserves object identity.
          </p>
          <h5>Inspecting and editing</h5>
          <p>
            Double-click an object to see its properties. Follow references to
            inspect connected objects. Field edits accept Kotlin expressions.
          </p>
          <p>
            Opening or refreshing the inspector evaluates getters. A getter may
            have effects or throw an exception. Automatic inspection is excluded
            from saved state and test recording. Removing an object from the
            bench hides or releases its name; references held by other objects
            may still keep it alive.
          </p>
          <h5>Codepad</h5>
          <pre><code
              >{`val counter = Counter()
counter.increment()
counter.value`}</code
            ></pre>
          <p>
            Press Enter to run a statement or expression. Declarations remain
            available until Compile or Reset.
          </p>
          <h5>Input and output</h5>
          <p>
            <code>print</code> and <code>println</code> write to the terminal.
            <code>readln()</code>, <code>readLine()</code> and
            <code>readlnOrNull()</code> wait for input there. Submit a line or use
            the terminal's EOF control. Stop cancels the wait.
          </p>
        {:else if selected === "projects"}
          <h4>Projects &amp; saving</h4>
          <h5>Browser drafts</h5>
          <p>
            BlueK automatically saves project source, resources, README, diagram
            positions and the default state class in this browser. Each tab
            updates one independent draft. Reload restores it. Live objects are
            not autosaved: use Saved state to recreate them.
          </p>
          <p>
            <strong>Open / Import → Recent work</strong> opens saved drafts. The
            trash icons and <strong>Delete all</strong> remove browser copies after
            confirmation. Open projects stay open; later edits can save them again.
          </p>
          <p>
            Drafts have no BlueK expiry date, but browser cleanup, private
            browsing or storage limits can remove them. Export JSON for work you
            need to keep or transfer to another browser.
          </p>
          <h5>Import and export reference</h5>
          <dl>
            <dt>Open / Import</dt>
            <dd>
              Open a BlueK JSON file, or import a BlueJ project ZIP or folder.
              Kotlin, positions and resources are imported; Java source cannot
              run.
            </dd>
            <dt>Export Project JSON</dt>
            <dd>
              Save an editable project with its resources and test/state
              classes.
            </dd>
            <dt>Copy Full Project Link</dt>
            <dd>
              Encode the project in a URL. Large projects may exceed the link
              size limit.
            </dd>
            <dt>Copy Short Link</dt>
            <dd>
              Store the project on the share service for 30 days. Anyone with
              the link can open it.
            </dd>
            <dt>Export as HTML (Beta)</dt>
            <dd>
              Create a standalone program page that runs its main without BlueK.
            </dd>
            <dt>Export BlueJ Project</dt>
            <dd>Not implemented yet.</dd>
          </dl>
          <p>
            Both link types share <strong>Open README</strong> and
            <strong>Load state</strong> options. Load state requires a default test
            class. JSON imports do not load state automatically.
          </p>
          <p>
            Opening a project link replaces this tab's draft and removes the
            project payload from the address bar. Reload keeps your changes. To
            start from the original again, open the original link explicitly.
          </p>
          <h5>README and resources</h5>
          <p>
            Click the document in the diagram to edit the project's README using
            Markdown. Name the project in the top bar. Import custom images and
            sounds through project JSON or a BlueJ project; the resource
            browsers cannot add files yet.
          </p>
          <h5>Offline version</h5>
          <p>
            Open the download icon, download and extract the ZIP, then open <strong
              >BlueK.html</strong
            > in a recent browser. No installation is needed. Short links require
            the online service; full links open online BlueK. Moving the HTML file
            may make its browser drafts unavailable.
          </p>
          <p>
            The offline version has had limited practical testing. Check your
            projects and browser before relying on it, and keep JSON backups.
          </p>
        {:else if selected === "state"}
          <h4>Saved state</h4>
          <p>
            Save state stores the preparation needed to recreate your objects as
            ordinary Kotlin in a test class. You do not need a test method to
            use it.
          </p>
          <ol>
            <li>
              Create objects and prepare them through method calls, assignments
              or the codepad.
            </li>
            <li>
              Use <strong>Save state</strong> below the bench. The first save
              suggests <strong>StateTest</strong> as the class name.
            </li>
            <li>
              Review the code, then choose <strong>Save &amp; Compile</strong>.
              Saving clears the live bench.
            </li>
            <li>
              Use <strong>Load state</strong> to recreate them.
            </li>
          </ol>
          <h5>The three buttons below the bench</h5>
          <dl>
            <dt>Save state</dt>
            <dd>Write the current preparation to the default class.</dd>
            <dt>Load state</dt>
            <dd>Compile, create the default class and run its setup.</dd>
            <dt>Choose default test class</dt>
            <dd>
              Select another class for both actions. Empty test classes are
              eligible.
            </dd>
          </dl>
          <p>
            The default is saved with the project. A test card’s context menu
            saves or loads that class.
          </p>
          <h5>What gets saved</h5>
          <p>
            Constructors, method calls, explicit property reads, assignments and
            supported codepad steps become <code>val</code> properties and setup code.
            Automatic inspector reads are excluded. Shared references remain shared.
            Removed objects and intermediate results become local variables only when
            later preparation needs them.
          </p>
          <p>
            Saving over existing preparation replaces <strong
              >all class properties, all @BeforeTest methods and init blocks</strong
            >. BlueK warns before replacing them. Other methods, including @Test
            methods, stay.
          </p>
          <h5>Limits</h5>
          <p>
            Loading repeats the saved actions; it is not a snapshot of every
            value in memory. Random values, time, input and external effects can
            differ. Main execution and BluePlay simulation steps are not
            recorded. Primitive bench values are excluded; String references are
            supported.
          </p>
          <p>
            After a failed action, partial changes may remain. Reset and prepare
            the state again. BlueK rejects actions it cannot reconstruct.
          </p>
        {:else if selected === "tests"}
          <h4>Testing</h4>
          <p>
            Testing in BlueK is in alpha. Tests use a reduced <code
              >kotlin.test</code
            > API and run in the browser interpreter.
          </p>
          <h5>Create, run and inspect</h5>
          <p>
            Right-click a class and choose <strong>Create Test Class</strong>
            for an attached green card. Use
            <strong>New File → Test Class</strong> for a free card. Attached cards
            move with their class.
          </p>
          <p>
            Expand the arrow below Start main. <strong>Tests…</strong> opens the
            class and test list, including empty classes. Use
            <strong>Run All Tests</strong>
            or a test card’s <strong>Run Tests</strong>. Results show passed,
            failed or ignored tests, error details and source navigation. Stop
            aborts the remaining tests.
          </p>
          <pre><code
              >{`import kotlin.test.*

class CounterTest {
    val counter = Counter()

    @Test
    fun incrementChangesValue() {
        counter.increment()
        assertEquals(1, counter.value)
    }
}`}</code
            ></pre>
          <h5>Annotations</h5>
          <dl>
            <dt>@Test</dt>
            <dd>A public, parameterless instance method returning Unit.</dd>
            <dt>@BeforeTest</dt>
            <dd>Prepare a fresh test-class instance before each test.</dd>
            <dt>@AfterTest</dt>
            <dd>
              Clean up after setup or a test, including failures after setup
              begins.
            </dd>
            <dt>@Ignore</dt>
            <dd>Skip a method or the whole class.</dd>
          </dl>
          <p>
            At most one BeforeTest and AfterTest per class. Test classes need a
            parameterless constructor and cannot have inheritance or type
            parameters. There are no BeforeAll/AfterAll, parameterized or nested
            tests. Each run recompiles and clears interactive objects; top-level
            state is shared within a run.
          </p>
          <h5>Assertions</h5>
          <p>
            <code>assertEquals(expected, actual)</code>,
            <code>assertNotEquals(illegal, actual)</code>,
            <code>assertTrue(condition)</code>,
            <code>assertFalse(condition)</code>, <code>assertNull(value)</code>,
            <code>assertNotNull(value)</code>
            and <code>fail()</code>. Each accepts an optional message.
            Additional overloads and assertions such as assertFailsWith are
            unsupported.
          </p>
          <h5>Record a test</h5>
          <ol>
            <li>
              Choose <strong>Record Test…</strong> for a class. BlueK loads its saved
              state first.
            </li>
            <li>
              Perform the actions to test. Use <strong>Add Assertion</strong> in a
              method-result dialog to check equality, null or non-null.
            </li>
            <li>
              Choose <strong>Finish Recording…</strong>, review the generated
              method and save it.
            </li>
          </ol>
          <p>
            <strong>Cancel Recording</strong> discards the recording, but leaves changes
            made to live objects. Editing source or compiling ends the recording.
          </p>
        {:else if selected === "kotlin"}
          <h4>Kotlin compatibility</h4>
          <p>
            BlueK interprets a subset of Kotlin, with language and library
            differences from Kotlin/JVM.
          </p>
          <h5>Important boundaries</h5>
          <ul>
            <li>
              Each project file contains one class, interface or enum, or
              top-level functions and properties. Executable top-level
              statements belong in the codepad.
            </li>
            <li>
              No package declarations, Java source, <code>java.*</code>/<code
                >javax.*</code
              >
              imports or arbitrary external libraries. Imports must come from supported
              <code>kotlin.*</code> APIs.
            </li>
            <li>
              No object expressions, named companion objects, typealias or fun
              interface.
            </li>
            <li>
              Secondary constructors can delegate to <code>this(...)</code>, but
              not <code>super(...)</code>.
            </li>
            <li>
              Some smart casts, generic inference and standard-library overloads
              are missing. An explicit type or cast can help.
            </li>
            <li>
              Top-level properties initialize in file order; reading one too
              early fails.
            </li>
          </ul>
          <p>
            Details: <a
              href="https://github.com/tomkarp/BlueK/blob/main/docs/kotlin-support.md"
              target="_blank"
              rel="noopener noreferrer">Kotlin compatibility reference</a
            >
            and
            <a
              href="https://github.com/tomkarp/BlueK/blob/main/docs/kotlin-surface.md"
              target="_blank"
              rel="noopener noreferrer">standard-library reference</a
            >.
          </p>
        {:else if selected === "blueplay"}
          <h4>BluePlay</h4>
          <p>
            BluePlay provides worlds, actors, images, keyboard/mouse input and
            sound. Choose a BluePlay template or demo in <strong
              >New Project</strong
            >. Its library cards are read-only; double-click one for signatures
            and API help.
          </p>
          <pre><code
              >{`class MyWorld : World(600, 400, 1)

fun main() {
    val world = MyWorld()
    world.show()
}`}</code
            ></pre>
          <h5>Execution</h5>
          <p>
            <strong>Act</strong> performs one step. <strong>Run/Pause</strong>
            repeats steps; <strong>Speed</strong> controls their rate. Each step calls
            the world's act and then its actors' act methods. Pause before using the
            codepad or object operations.
          </p>
          <p>
            <strong>Reset</strong> calls the selected main again in the current session.
            It does not reinitialize top-level properties. Showing a world pauses
            it.
          </p>
          <h5>API overview</h5>
          <dl>
            <dt>World</dt>
            <dd>
              Size and background; show, act, addObject, removeObject,
              getObjects, getObjectsAt and showText.
            </dd>
            <dt>Actor</dt>
            <dd>
              x, y, rotation, image and world; act, move, turn, turnTowards,
              collision queries and edge/click checks.
            </dd>
            <dt>Image</dt>
            <dd>
              Create a blank image, load a resource or copy an image; draw
              shapes/text/images, scale and change transparency.
            </dd>
            <dt>Functions</dt>
            <dd>
              isKeyDown, playSound, start, stop, step, getSpeed and setSpeed.
            </dd>
          </dl>
          <p>
            Use Kotlin properties: <code>actor.image = Image("duck.png")</code>.
            World requires width, height and cellSize. Add an actor with
            <code>world.addObject(actor, x, y)</code>. Accessing
            <code>actor.world</code> before adding it throws an exception.
          </p>
          <h5>Resources and boundaries</h5>
          <p>
            Standard images such as duck.png, cat.png and pizza.png are
            included. Imported project resources with the same path take
            precedence. playSound uses project audio resources.
          </p>
          <p>
            The browser API excludes JVM/AWT internals and file access. Fonts
            and text collision are approximate. Saving preparation can replay
            object creation and explicit calls, but cannot preserve a running
            simulation.
          </p>
        {:else if selected === "shortcuts"}
          <h4>Keyboard shortcuts</h4>
          <p>
            Use Cmd on macOS and Ctrl elsewhere. Formatting and commenting act
            on the current Kotlin editor.
          </p>
          <slot name="shortcuts" />
        {:else}
          <h4>Troubleshooting</h4>
          <dl>
            <dt>Start main is disabled</dt>
            <dd>
              Add a top-level main function in a functions file, then compile.
              Class methods are not entry points.
            </dd>
            <dt>Objects disappeared</dt>
            <dd>
              Compile, test runs and state saving start fresh sessions. Load
              state to recreate saved preparation.
            </dd>
            <dt>A program is waiting or will not finish</dt>
            <dd>
              Check the terminal for an input request. Use Stop for an endless
              loop or to cancel execution.
            </dd>
            <dt>A call failed after changing an object</dt>
            <dd>
              Changes made before the error remain. Compile or Reset and repeat
              the preparation if you need a clean state.
            </dd>
            <dt>The inspector shows an error</dt>
            <dd>
              A property getter failed. Inspect its error details; check whether
              the object needs initialization or world membership.
            </dd>
            <dt>A draft is missing</dt>
            <dd>
              Check Recent work in the same browser and site. Use an exported
              JSON file if browser data was removed.
            </dd>
            <dt>The generated state cannot be saved</dt>
            <dd>
              Reset and repeat the preparation using actions supported by saved
              state.
            </dd>
          </dl>
          <p>
            <a
              href="https://github.com/tomkarp/BlueK/issues/new"
              target="_blank"
              rel="noopener noreferrer">report a bug on GitHub</a
            >. Include a small project, the steps to reproduce it, the error and
            your browser/version.
          </p>
        {/if}
      </article>
    </div>
    <div class="dialog-actions"><button on:click={close}>Close</button></div>
  </div>
</div>
