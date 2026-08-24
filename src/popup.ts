import browser from "webextension-polyfill";

const fullViewCheckbox = document.getElementById("auto-full-view") as HTMLInputElement | null;
const treeViewCheckbox = document.getElementById("auto-tree-view") as HTMLInputElement | null;

if (fullViewCheckbox) {
  browser.storage.sync.get({ autoFullView: true }).then((result) => {
    fullViewCheckbox.checked = Boolean(result.autoFullView);
  });

  fullViewCheckbox.addEventListener("change", () => {
    browser.storage.sync.set({ autoFullView: fullViewCheckbox.checked });
  });
}

if (treeViewCheckbox) {
  browser.storage.sync.get({ autoTreeView: true }).then((result) => {
    treeViewCheckbox.checked = Boolean(result.autoTreeView);
  });

  treeViewCheckbox.addEventListener("change", () => {
    browser.storage.sync.set({ autoTreeView: treeViewCheckbox.checked });
  });
}
