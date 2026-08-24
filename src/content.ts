import browser from "webextension-polyfill";

const BUTTON_ID = "cms-live-view-button";
let retryTimeout: ReturnType<typeof setTimeout> | null = null;

interface Settings {
  defaultLiveSite: string;
  siteMap: Record<string, string>;
  autoFullView: boolean;
  autoTreeView: boolean;
}

async function getSettings(): Promise<Settings> {
  const data = await browser.storage.sync.get({
    defaultLiveSite: "",
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
    defaultLiveSite: String(data.defaultLiveSite || ""),
    siteMap,
    autoFullView: Boolean(data.autoFullView),
    autoTreeView: Boolean(data.autoTreeView),
  };
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

function getLiveSiteBase(
  selectElements: NodeListOf<HTMLSelectElement>,
  siteMap: Record<string, string>,
  defaultLiveSite: string,
): string {
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
    return siteMap[targetData.name] || defaultLiveSite;
  } catch (e) {
    console.error("Failed to parse Ingeniux publishing target JSON:", e);
    return defaultLiveSite;
  }
}

async function handleUrlChange() {
  if (retryTimeout) clearTimeout(retryTimeout);

  if (!window.location.hostname.endsWith("ingeniuxondemand.com")) return;

  const settings = await getSettings();
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

  const liveSiteBase = getLiveSiteBase(selectElements, settings.siteMap, settings.defaultLiveSite);

  if (!liveSiteBase) {
    retryTimeout = setTimeout(handleUrlChange, 100);
    return;
  }

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
  if (document.getElementById(BUTTON_ID)) return;

  const container = document.body;
  if (!container) return;

  const btn = document.createElement("a");
  btn.id = BUTTON_ID;
  btn.href = url;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.innerText = "View Live";

  Object.assign(btn.style, {
    position: "fixed",
    top: "60px",
    right: "45px",
    zIndex: "99999",
    padding: "8px 16px",
    backgroundColor: "rgb(81, 103, 138)",
    color: "#fff",
    borderRadius: "3px",
    textDecoration: "none",
    fontWeight: 300,
    fontSize: 14,
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
    cursor: "pointer",
    transition: "background-color 0.3s ease-in",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.backgroundColor = "rgb(83, 172, 227)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.backgroundColor = "rgb(81, 103, 138)";
  });

  container.appendChild(btn);
}

if (window === window.top) {
  window.addEventListener("hashchange", handleUrlChange);

  handleUrlChange();

  let lastUrl = location.href;

  new MutationObserver(async () => {
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
    if (!settings) return;

    const selectElements = document.querySelectorAll<HTMLSelectElement>(
      'select[dojoattachpoint="pubTargetsSelect"], select.pubTargetSelect',
    );
    const currentLiveBase = getLiveSiteBase(selectElements, settings.siteMap, settings.defaultLiveSite);

    if (!currentLiveBase || !existingButton.href.startsWith(currentLiveBase)) {
      handleUrlChange();
    }
  }).observe(document, { subtree: true, childList: true, attributes: true });
}
