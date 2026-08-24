import browser from "webextension-polyfill";

interface StorageSchema {
  autoFullView: boolean;
  autoTreeView: boolean;
  siteMap: string;
}

const fullViewCheckbox = document.getElementById("auto-full-view") as HTMLInputElement | null;
const treeViewCheckbox = document.getElementById("auto-tree-view") as HTMLInputElement | null;

const visualMapContainer = document.getElementById("visual-map-container") as HTMLDivElement | null;
const jsonMapContainer = document.getElementById("json-map-container") as HTMLDivElement | null;
const mapRowsContainer = document.getElementById("map-rows") as HTMLDivElement | null;
const addMapRowBtn = document.getElementById("add-map-row") as HTMLButtonElement | null;
const toggleJsonBtn = document.getElementById("toggle-json-mode") as HTMLButtonElement | null;
const siteMapTextarea = document.getElementById("site-map") as HTMLTextAreaElement | null;

let isJsonMode = false;

function parseSiteMap(jsonString: string): Record<string, string> {
  if (!jsonString.trim()) return {};
  try {
    const parsed = JSON.parse(jsonString);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function renderRowsFromMap(map: Record<string, string>) {
  if (!mapRowsContainer) return;
  mapRowsContainer.innerHTML = "";

  const entries = Object.entries(map);
  if (entries.length === 0) {
    createRow("", "");
    return;
  }

  for (const [target, url] of entries) {
    createRow(target, url);
  }
}

function createRow(targetValue = "", urlValue = "") {
  if (!mapRowsContainer) return;

  const row = document.createElement("div");
  row.style.cssText = "display: flex; gap: 4px; align-items: center;";

  const targetInput = document.createElement("input");
  targetInput.type = "text";
  targetInput.placeholder = "Target Name";
  targetInput.value = targetValue;
  targetInput.style.cssText = "flex: 1; min-width: 0; padding: 4px; font-size: 12px;";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.placeholder = "https://...";
  urlInput.value = urlValue;
  urlInput.style.cssText = "flex: 1.5; min-width: 0; padding: 4px; font-size: 12px;";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.innerText = "×";
  deleteBtn.title = "Delete target";
  deleteBtn.style.cssText = "padding: 2px 6px; font-size: 14px; cursor: pointer; line-height: 1;";

  deleteBtn.addEventListener("click", () => {
    row.remove();
    saveVisualMapToStorage();
  });

  targetInput.addEventListener("change", saveVisualMapToStorage);
  urlInput.addEventListener("change", saveVisualMapToStorage);

  row.appendChild(targetInput);
  row.appendChild(urlInput);
  row.appendChild(deleteBtn);

  mapRowsContainer.appendChild(row);
}

function getMapFromRows(): Record<string, string> {
  if (!mapRowsContainer) return {};
  const map: Record<string, string> = {};

  const rows = mapRowsContainer.querySelectorAll("div");
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const target = inputs[0]?.value.trim();
    const url = inputs[1]?.value.trim().replace(/\/+$/, "");

    if (target && url) {
      map[target] = url;
    }
  });

  return map;
}

function saveVisualMapToStorage() {
  const map = getMapFromRows();
  const jsonString = JSON.stringify(map, null, 2);

  if (siteMapTextarea) siteMapTextarea.value = jsonString;
  browser.storage.sync.set({ siteMap: jsonString });
}

async function loadSettings() {
  const res = await browser.storage.sync.get({
    autoFullView: false,
    autoTreeView: false,
    siteMap: "",
  });

  const settings = res as unknown as StorageSchema;

  if (fullViewCheckbox) fullViewCheckbox.checked = settings.autoFullView;
  if (treeViewCheckbox) treeViewCheckbox.checked = settings.autoTreeView;
  if (siteMapTextarea) siteMapTextarea.value = settings.siteMap;

  const currentMap = parseSiteMap(settings.siteMap);
  renderRowsFromMap(currentMap);
}

toggleJsonBtn?.addEventListener("click", () => {
  isJsonMode = !isJsonMode;

  if (isJsonMode) {
    const map = getMapFromRows();
    if (siteMapTextarea) siteMapTextarea.value = JSON.stringify(map, null, 2);

    if (visualMapContainer) visualMapContainer.style.display = "none";
    if (jsonMapContainer) jsonMapContainer.style.display = "flex";
    toggleJsonBtn.innerText = "Form View";
  } else {
    if (siteMapTextarea) {
      const map = parseSiteMap(siteMapTextarea.value);
      renderRowsFromMap(map);
      saveVisualMapToStorage();
    }

    if (jsonMapContainer) jsonMapContainer.style.display = "none";
    if (visualMapContainer) visualMapContainer.style.display = "flex";
    toggleJsonBtn.innerText = "Raw JSON Mode";
  }
});

addMapRowBtn?.addEventListener("click", () => {
  createRow("", "");
});

fullViewCheckbox?.addEventListener("change", () => {
  browser.storage.sync.set({ autoFullView: fullViewCheckbox.checked });
});

treeViewCheckbox?.addEventListener("change", () => {
  browser.storage.sync.set({ autoTreeView: treeViewCheckbox.checked });
});

siteMapTextarea?.addEventListener("change", () => {
  const value = siteMapTextarea.value.trim();
  if (!value) {
    browser.storage.sync.set({ siteMap: "" });
    return;
  }

  try {
    const parsed = JSON.parse(value);
    browser.storage.sync.set({ siteMap: JSON.stringify(parsed, null, 2) });
  } catch (e) {
    console.error("Invalid JSON format for Site Map", e);
  }
});

loadSettings();
