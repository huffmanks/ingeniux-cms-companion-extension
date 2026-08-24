import browser from "webextension-polyfill";

const CMS_SITE_BASE = "https://woffordcollege.ingeniuxondemand.com";
const BUTTON_ID = "cms-live-view-button";

const SITE_MAP: Record<string, string> = {
  "Wofford.edu": "https://www.wofford.edu",
  "Wofford edu Staging": "https://woffordstaging.ingeniuxondemand.com",
  myWofford: "https://my.wofford.edu",
  "myWofford Staging": "https://mywoffordstaging.ingeniuxondemand.com",
};

const DEFAULT_LIVE_SITE = "https://www.wofford.edu";

function getLiveSiteBase(): string {
  const selectElements = document.querySelectorAll<HTMLSelectElement>(
    'select[dojoattachpoint="pubTargetsSelect"], select.pubTargetSelect',
  );

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
    return SITE_MAP[targetData.name] || DEFAULT_LIVE_SITE;
  } catch (e) {
    console.error("Failed to parse Ingeniux publishing target JSON:", e);
    return DEFAULT_LIVE_SITE;
  }
}

async function switchToFullView() {
  const { autoFullView = true } = await browser.storage.sync.get("autoFullView");
  if (!autoFullView) return;

  const fullBtn = document.querySelector<HTMLSpanElement>('.viewButtons .viewButton[title="Full"]:not(.current)');
  if (fullBtn) {
    fullBtn.click();
  }
}

async function openTreeView(isSitePath: boolean, isAssetPath: boolean) {
  const { autoTreeView = true } = await browser.storage.sync.get("autoTreeView");
  if (!autoTreeView) return;

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

let retryTimeout: ReturnType<typeof setTimeout> | null = null;

function handleUrlChange() {
  if (retryTimeout) clearTimeout(retryTimeout);

  const currentUrl = window.location.href;

  document.getElementById(BUTTON_ID)?.remove();

  const isSitePath = currentUrl.includes(`${CMS_SITE_BASE}/#/site`);
  const isAssetPath = currentUrl.includes(`${CMS_SITE_BASE}/#/assets`);

  if (isSitePath) {
    switchToFullView();
  }

  if (isSitePath || isAssetPath) {
    openTreeView(isSitePath, isAssetPath);
  }

  if (!isSitePath && !isAssetPath) return;

  const liveSiteBase = getLiveSiteBase();

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

  new MutationObserver(() => {
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

    const currentLiveBase = getLiveSiteBase();

    if (!currentLiveBase || !existingButton.href.startsWith(currentLiveBase)) {
      handleUrlChange();
    }
  }).observe(document, { subtree: true, childList: true, attributes: true });
}
