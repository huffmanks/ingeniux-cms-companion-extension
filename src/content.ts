import browser from "webextension-polyfill";

const BUTTON_ID = "cms-live-view-button";

const SELECTORS = {
  toolbarSection: ".toolbarContainer .leftSideToolbar.buttonsContainer .toolbarSection",
  pubTargetSelect: 'select[dojoattachpoint="pubTargetsSelect"], select.pubTargetSelect',
  fullViewButton: '.viewButtons .viewButton[title="Full"]:not(.current)',
  siteTreeButton: 'utility-button .Icon[title="Site Tree Navigation"]:not(.current)',
  assetTreeButton: 'utility-button .Icon[title="Assets Tree Navigation"]:not(.current)',
  searchAssetCheckbox: 'input[dojoattachpoint="includeAssetsCheckbox"]:not(:checked)',
} as const;

interface Settings {
  siteMap: Record<string, string>;
  autoFullView: boolean;
  autoTreeView: boolean;
  autoIncludeSearchAssets: boolean;
}

interface PathState {
  isSitePath: boolean;
  isAssetPath: boolean;
}

let cachedSettings: Settings = {
  siteMap: {},
  autoFullView: false,
  autoTreeView: false,
  autoIncludeSearchAssets: false,
};

let settingsLoaded = false;

async function syncSettings(): Promise<Settings | null> {
  try {
    const data = await browser.storage.sync.get({
      siteMap: "",
      autoFullView: false,
      autoTreeView: false,
      autoIncludeSearchAssets: false,
    });

    let siteMap: Record<string, string> = {};
    if (data.siteMap) {
      try {
        siteMap = typeof data.siteMap === "string" ? JSON.parse(data.siteMap) : data.siteMap;
      } catch (e) {
        console.error("Failed to parse siteMap storage JSON:", e);
      }
    }

    cachedSettings = {
      siteMap,
      autoFullView: Boolean(data.autoFullView),
      autoTreeView: Boolean(data.autoTreeView),
      autoIncludeSearchAssets: Boolean(data.autoIncludeSearchAssets),
    };

    settingsLoaded = true;
    return cachedSettings;
  } catch (err) {
    if (String(err).includes("Extension context invalidated")) {
      return null;
    }
    console.error("Storage error:", err);
    return null;
  }
}

function getPathState(url: string): PathState {
  return {
    isSitePath: url.includes("/#/site"),
    isAssetPath: url.includes("/#/assets"),
  };
}

function applyAutoViewPreferences({ isSitePath, isAssetPath }: PathState) {
  if (isSitePath && cachedSettings.autoFullView) {
    document.querySelector<HTMLElement>(SELECTORS.fullViewButton)?.click();
  }

  if (cachedSettings.autoTreeView) {
    if (isSitePath) {
      document.querySelector<HTMLElement>(SELECTORS.siteTreeButton)?.click();
    } else if (isAssetPath) {
      document.querySelector<HTMLElement>(SELECTORS.assetTreeButton)?.click();
    }
  }

  if (cachedSettings.autoIncludeSearchAssets) {
    document.querySelector<HTMLInputElement>(SELECTORS.searchAssetCheckbox)?.click();
  }
}

function findVisibleSelect(selectElements: NodeListOf<HTMLSelectElement>): HTMLSelectElement | null {
  for (const el of Array.from(selectElements)) {
    const rect = el.getBoundingClientRect();
    const isVisible = !!(el.offsetWidth || el.offsetHeight || rect.width || rect.height);
    const isHidden = el.closest('[style*="display: none"], [style*="visibility: hidden"]') !== null;

    if (isVisible && !isHidden) return el;
  }

  return selectElements[0] ?? null;
}

function getLiveSiteBase(siteMap: Record<string, string>): string {
  const selectElements = document.querySelectorAll<HTMLSelectElement>(SELECTORS.pubTargetSelect);
  const activeSelectEl = findVisibleSelect(selectElements);
  const rawValue = activeSelectEl?.value ?? "";

  if (!rawValue) return "";

  if (!rawValue.startsWith("{")) return "";

  try {
    const targetData = JSON.parse(rawValue);
    return siteMap[targetData.name || ""] || "";
  } catch (e) {
    console.error("Failed to parse Ingeniux publishing target JSON:", e);
    return "";
  }
}

function buildLiveUrl(url: string, liveSiteBase: string, { isSitePath, isAssetPath }: PathState): string {
  if (isSitePath) {
    const pageMatch = url.match(/(x\d+)/);
    return pageMatch ? `${liveSiteBase}/${pageMatch[1]}.xml` : "";
  }

  if (isAssetPath) {
    const assetMatch = url.match(/a_(\d+)/);
    return assetMatch ? `${liveSiteBase}/a/${assetMatch[1]}` : "";
  }

  return "";
}

function injectButton(url: string) {
  const toolbarContainer = document.querySelector(SELECTORS.toolbarSection);
  if (!toolbarContainer) return;

  const existingBtn = document.getElementById(BUTTON_ID) as HTMLAnchorElement | null;

  if (existingBtn) {
    if (!toolbarContainer.contains(existingBtn)) {
      toolbarContainer.appendChild(existingBtn);
    }
    if (existingBtn.href !== url) {
      existingBtn.href = url;
    }
    return;
  }

  const btn = document.createElement("a");
  btn.id = BUTTON_ID;
  btn.href = url;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.className = "newToolbarButton ngFlatToolbarButton";

  const label = document.createElement("span");
  label.className = "label";
  label.innerText = "View Live";
  btn.appendChild(label);

  Object.assign(btn.style, {
    display: "inline-block",
    margin: "0px 2px 0px 4px",
    padding: "8px 8px 0 8px",
    lineHeight: "normal",
    backgroundColor: "#314058",
    color: "#ffffff",
    borderRadius: "3px",
    border: "1px solid #283448",
    textDecoration: "none",
    fontWeight: 400,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.backgroundColor = "#3d4d67";
    btn.style.borderColor = "#4a5d7c";
    btn.style.boxShadow = "0 2px 6px rgba(61, 78, 104, 0.4)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.backgroundColor = "#314058";
    btn.style.borderColor = "#283448";
    btn.style.boxShadow = "none";
  });

  toolbarContainer.appendChild(btn);
}

function updateLiveViewButton(pathState: PathState) {
  const liveSiteBase = getLiveSiteBase(cachedSettings.siteMap);
  if (!liveSiteBase) return;

  const targetUrl = buildLiveUrl(window.location.href, liveSiteBase, pathState);
  if (targetUrl) {
    injectButton(targetUrl);
    return true;
  }
  return false;
}

async function handleUrlChange() {
  if (!window.location.hostname.endsWith("ingeniuxondemand.com")) return;

  if (!settingsLoaded) {
    await syncSettings();
  }

  const pathState = getPathState(window.location.href);
  applyAutoViewPreferences(pathState);

  if (!pathState.isSitePath && !pathState.isAssetPath) {
    document.getElementById(BUTTON_ID)?.remove();
    return;
  }

  updateLiveViewButton(pathState);
}

if (window === window.top) {
  syncSettings().then(() => {
    handleUrlChange();
  });

  browser.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === "sync") {
      syncSettings().then(() => handleUrlChange());
    }
  });

  window.addEventListener("hashchange", handleUrlChange);

  let lastUrl = location.href;
  let isProcessing = false;

  const observer = new MutationObserver(() => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const currentUrl = location.href;

      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        handleUrlChange();
        return;
      }

      const pathState = getPathState(currentUrl);
      applyAutoViewPreferences(pathState);

      if (pathState.isSitePath || pathState.isAssetPath) {
        updateLiveViewButton(pathState);
      }
    } finally {
      isProcessing = false;
    }
  });

  observer.observe(document, { subtree: true, childList: true });
}
