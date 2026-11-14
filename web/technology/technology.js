import { mountChrome } from "../shared/chrome.js";
import { icon } from "../shared/icons.js";

document.querySelector("[data-open-settings]").innerHTML = icon("gear", { size: 21 });
document.querySelectorAll("[data-icon]").forEach((element) => {
  element.innerHTML = icon(element.dataset.icon, { size: 20 });
});
mountChrome({ requiresKey: false });

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

function selectTab(id, { focus = false, updateHash = false } = {}) {
  const selected = tabs.find((tab) => tab.getAttribute("aria-controls") === id) || tabs[0];
  tabs.forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach((panel) => { panel.hidden = panel.id !== selected.getAttribute("aria-controls"); });
  if (updateHash) history.replaceState(null, "", `#${selected.getAttribute("aria-controls")}`);
  if (focus) selected.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab.getAttribute("aria-controls"), { updateHash: true }));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next].getAttribute("aria-controls"), { focus: true, updateHash: true });
  });
});
window.addEventListener("hashchange", () => selectTab(location.hash.slice(1)));
selectTab(location.hash.slice(1));
