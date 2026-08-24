import browser from "webextension-polyfill";

const BUTTON_ID = "cms-live-view-button";

interface Settings {
  siteMap: Record<string, string>;
  autoFullView: boolean;
  autoTreeView: boolean;
}

async function getSettings(): Promise<Settings | null> {
  try {
    const data = await browser.storage.sync.get({
      siteMap: "",
      autoFullView: false,
      autoTreeView: false,
    });

    let siteMap: Record<string, string> = {};
    if (data.siteMap) {
      try {
        siteMap = typeof data.siteMap === "string" ? JSON.parse(data.siteMap) : data.siteMap;
      } catch (e) {
        console.error("Failed to parse siteMap storage JSON:", e);
      }
    }

    return {
      siteMap,
      autoFullView: Boolean(data.autoFullView),
      autoTreeView: Boolean(data.autoTreeView),
    };
  } catch (err) {
    if (String(err).includes("Extension context invalidated")) {
      return null;
    }
    console.error("Storage error:", err);
    return null;
  }
}

function switchToFullView() {
  const fullBtn = document.querySelector<HTMLSpanElement>('.viewButtons .viewButton[title="Full"]:not(.current)');
  if (fullBtn) {
    fullBtn.click();
  }
}

function openTreeView(isSitePath: boolean, isAssetPath: boolean) {
  let selector = "";

  if (isSitePath) {
    selector = 'utility-button .Icon[title="Site Tree Navigation"]:not(.current)';
  } else if (isAssetPath) {
    selector = 'utility-button .Icon[title="Assets Tree Navigation"]:not(.current)';
  }

  if (!selector) return;

  const treeBtn = document.querySelector<HTMLSpanElement>(selector);
  if (treeBtn) {
    treeBtn.click();
  }
}

function getLiveSiteBase(selectElements: NodeListOf<HTMLSelectElement>, siteMap: Record<string, string>): string {
  let activeSelectEl: HTMLSelectElement | null = null;

  for (const el of Array.from(selectElements)) {
    const rect = el.getBoundingClientRect();
    const isVisible = !!(el.offsetWidth || el.offsetHeight || rect.width || rect.height);
    const isNotHidden = el.closest('[style*="display: none"], [style*="visibility: hidden"]') === null;

    if (isVisible && isNotHidden) {
      activeSelectEl = el;
      break;
    }
  }

  if (!activeSelectEl && selectElements.length > 0) {
    activeSelectEl = selectElements[0];
  }

  if (!activeSelectEl || !activeSelectEl.value) {
    return "";
  }

  try {
    const targetData = JSON.parse(activeSelectEl.value);
    const targetName = targetData.name || "";

    return siteMap[targetName] || "";
  } catch (e) {
    console.error("Failed to parse Ingeniux publishing target JSON:", e);
    return "";
  }
}

async function handleUrlChange() {
  if (!window.location.hostname.endsWith("ingeniuxondemand.com")) return;

  const settings = await getSettings();
  if (!settings) return;

  const currentUrl = window.location.href;

  document.getElementById(BUTTON_ID)?.remove();

  const isSitePath = currentUrl.includes("/#/site");
  const isAssetPath = currentUrl.includes("/#/assets");

  if (isSitePath && settings.autoFullView) {
    switchToFullView();
  }

  if ((isSitePath || isAssetPath) && settings.autoTreeView) {
    openTreeView(isSitePath, isAssetPath);
  }

  if (!isSitePath && !isAssetPath) return;

  const selectElements = document.querySelectorAll<HTMLSelectElement>(
    'select[dojoattachpoint="pubTargetsSelect"], select.pubTargetSelect',
  );

  const liveSiteBase = getLiveSiteBase(selectElements, settings.siteMap);

  if (!liveSiteBase) return;

  let targetUrl = "";

  if (isSitePath) {
    const pageMatch = currentUrl.match(/(x\d+)/);
    if (pageMatch) {
      targetUrl = `${liveSiteBase}/${pageMatch[1]}.xml`;
    }
  } else if (isAssetPath) {
    const assetMatch = currentUrl.match(/a_(\d+)/);
    if (assetMatch) {
      targetUrl = `${liveSiteBase}/a/${assetMatch[1]}`;
    }
  }

  if (targetUrl) {
    injectButton(targetUrl);
  }
}

function injectButton(url: string) {
  const existingBtn = document.getElementById(BUTTON_ID) as HTMLAnchorElement | null;
  if (existingBtn) {
    if (existingBtn.href !== url) existingBtn.href = url;
    return;
  }

  const toolbarSections = document.querySelectorAll(
    ".toolbarContainer .leftSideToolbar.buttonsContainer .toolbarSection",
  );

  if (toolbarSections.length === 0) return;

  const targetContainer = toolbarSections[0];

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

  targetContainer.appendChild(btn);
}

if (window === window.top) {
  window.addEventListener("hashchange", handleUrlChange);

  handleUrlChange();

  let lastUrl = location.href;

  const observer = new MutationObserver(async () => {
    const currentUrl = location.href;
    const existingButton = document.getElementById(BUTTON_ID) as HTMLAnchorElement | null;

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      handleUrlChange();
      return;
    }

    if (!existingButton) {
      handleUrlChange();
      return;
    }

    const settings = await getSettings();
    if (!settings) {
      observer.disconnect();
      return;
    }

    const selectElements = document.querySelectorAll<HTMLSelectElement>(
      'select[dojoattachpoint="pubTargetsSelect"], select.pubTargetSelect',
    );
    const currentLiveBase = getLiveSiteBase(selectElements, settings.siteMap);

    if (!currentLiveBase || !existingButton.href.startsWith(currentLiveBase)) {
      handleUrlChange();
    }
  });

  observer.observe(document, { subtree: true, childList: true, attributes: true });
}
