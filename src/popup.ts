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
  row.className = "input-group input-group-sm";

  const targetInput = document.createElement("input");
  targetInput.type = "text";
  targetInput.className = "form-control";
  targetInput.placeholder = "Target Name";
  targetInput.value = targetValue;

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "form-control";
  urlInput.placeholder = "https://...";
  urlInput.value = urlValue;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-outline-danger";
  deleteBtn.innerText = "×";
  deleteBtn.title = "Delete target";

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
  const hasEntries = Object.keys(map).length > 0;
  const jsonString = hasEntries ? JSON.stringify(map, null, 2) : "";

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

  const currentMap = parseSiteMap(settings.siteMap);
  const hasEntries = Object.keys(currentMap).length > 0;

  if (siteMapTextarea) {
    siteMapTextarea.value = hasEntries ? JSON.stringify(currentMap, null, 2) : "";
  }

  renderRowsFromMap(currentMap);
}

toggleJsonBtn?.addEventListener("click", () => {
  isJsonMode = !isJsonMode;

  if (isJsonMode) {
    const map = getMapFromRows();
    const hasEntries = Object.keys(map).length > 0;

    if (siteMapTextarea) {
      siteMapTextarea.value = hasEntries ? JSON.stringify(map, null, 2) : "";
    }

    visualMapContainer?.classList.add("d-none");
    jsonMapContainer?.classList.remove("d-none");
    jsonMapContainer?.classList.add("d-flex");
    toggleJsonBtn.innerText = "Form View";
  } else {
    if (siteMapTextarea) {
      const map = parseSiteMap(siteMapTextarea.value);
      renderRowsFromMap(map);
      saveVisualMapToStorage();
    }

    jsonMapContainer?.classList.add("d-none");
    jsonMapContainer?.classList.remove("d-flex");
    visualMapContainer?.classList.remove("d-none");
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
