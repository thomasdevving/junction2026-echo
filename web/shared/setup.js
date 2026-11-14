/** The browser is a companion; physical glasses connect through the iPhone app. */
export function mountSetup({ openSettings }) {
  const triggers = [...document.querySelectorAll('[data-open-setup]')];
  if (!triggers.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'glasses-setup';
  dialog.setAttribute('aria-labelledby', 'glasses-setup-title');
  dialog.innerHTML = `
    <header><div><p class="setup-eyebrow">GLASSES + IPHONE + ECHO</p><h2 id="glasses-setup-title">Start with your glasses.</h2></div><button class="btn btn-icon btn-ghost" type="button" data-close-setup aria-label="Close glasses setup">×</button></header>
    <p class="setup-intro">Your glasses connect through Echo on iPhone. This browser is for trying the cook-along, reviewing lessons and watching a session.</p>
    <ol class="setup-steps">
      <li><span>01</span><div><h3>Pair your glasses with your iPhone.</h3><p>Use the Meta AI app to pair your compatible glasses. Keep Bluetooth on and the glasses charged and open.</p></div></li>
      <li><span>02</span><div><h3>Connect them in Echo on iPhone.</h3><p>Use the team’s current iPhone test build. Open <strong>Settings → Glasses Lab → Register with Meta AI</strong>, then follow the permission prompts. Check the glasses status in Settings.</p></div></li>
      <li><span>03</span><div><h3>Pick a lesson in Cook mode.</h3><p>Connect the iPhone app to the team’s server with its demo key, choose Cook and select a published lesson. When the glasses are ready, the app uses their camera, display and inputs.</p></div></li>
      <li><span>04</span><div><h3>Follow along in this browser.</h3><p>Sign in to this website with the shared demo login code. The server keeps the API key private. <a href="../monitor/">Monitor</a> follows the newest session automatically. To make a lesson, record in Chef mode on iPhone, then finish it in <a href="../review/">Review</a>.</p></div></li>
    </ol>
    <details class="setup-extra"><summary>Team demo setup and current limits</summary><p>The iPhone build must be registered for Meta’s Device Access Toolkit and the glasses must have Developer Mode enabled. Ask the team for the build and private demo key; there is no public install link yet. Physical-glasses validation is still in progress, and audio currently plays through the phone.</p></details>
    <footer><div><strong>Trying it without glasses?</strong><p>Sign in with the demo login code, then use a webcam or photo in Simulator.</p></div><button class="btn btn-light" type="button" data-connect-browser>Sign in to this browser</button></footer>`;
  document.body.append(dialog);
  for (const trigger of triggers) trigger.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-close-setup]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-connect-browser]').addEventListener('click', () => { dialog.close(); openSettings(); });
}
