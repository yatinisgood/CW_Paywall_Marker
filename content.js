(() => {
  const ARTICLE_RE = /^https:\/\/www\.cw\.com\.tw\/article\/\d+(?:[/?#].*)?$/;
  const PAID_MARK = "\u{1F512}";
  const SCANNING_MARK = "\u2026";
  const MAX_CONCURRENCY = 4;
  const cache = new Map();
  const queued = new Set();
  let active = 0;

  const normalizeArticleUrl = (href) => {
    try {
      const url = new URL(href, location.href);
      url.hash = "";
      return ARTICLE_RE.test(url.href) ? url.href : null;
    } catch {
      return null;
    }
  };

  const isLikelyTitleLink = (link) => {
    const text = (link.innerText || link.textContent || "").trim();
    if (text.length < 6) return false;
    if (/\u66f4\u591a|\u770b\u66f4\u591a|\u5206\u4eab|\u6536\u85cf|\u767b\u5165|\u8a02\u95b1/.test(text)) return false;
    return true;
  };

  const titleTargetFor = (link) => {
    return link.querySelector("h1,h2,h3,h4,h5,p,span") || link;
  };

  const setMarker = (link, marker, state) => {
    const target = titleTargetFor(link);
    if (!target || target.dataset.cwPaywallState === state) return;

    let badge = target.querySelector(":scope > .cw-paywall-marker");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cw-paywall-marker";
      badge.setAttribute("aria-hidden", "true");
      target.prepend(badge);
    }

    badge.textContent = marker;
    target.dataset.cwPaywallState = state;
    target.classList.toggle("cw-paywall-paid", state === "paid");
    target.classList.toggle("cw-paywall-scanning", state === "scanning");
    target.classList.toggle("cw-paywall-free", state === "free");
  };

  const clearMarker = (link) => {
    const target = titleTargetFor(link);
    const badge = target?.querySelector(":scope > .cw-paywall-marker");
    if (badge) badge.remove();
    if (target) {
      target.dataset.cwPaywallState = "free";
      target.classList.remove("cw-paywall-paid", "cw-paywall-scanning");
      target.classList.add("cw-paywall-free");
    }
  };

  const hasPaywallMarker = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.querySelector('[class*="paywall" i], [id*="paywall" i]')) return true;
    for (const element of doc.querySelectorAll("*")) {
      for (const attr of element.attributes) {
        if (/^data-/i.test(attr.name) && /paywall/i.test(attr.value)) return true;
      }
    }
    return /paywall/i.test(html);
  };

  const fetchPaidState = async (url) => {
    if (cache.has(url)) return cache.get(url);
    const response = await fetch(url, {
      credentials: "include",
      cache: "force-cache"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const paid = hasPaywallMarker(html);
    cache.set(url, paid);
    return paid;
  };

  const processLink = async (link, url) => {
    try {
      setMarker(link, SCANNING_MARK, "scanning");
      const paid = await fetchPaidState(url);
      if (paid) setMarker(link, PAID_MARK, "paid");
      else clearMarker(link);
    } catch {
      clearMarker(link);
    }
  };

  const pump = () => {
    while (active < MAX_CONCURRENCY && queued.size) {
      const item = queued.values().next().value;
      queued.delete(item);
      active += 1;
      processLink(item.link, item.url).finally(() => {
        active -= 1;
        pump();
      });
    }
  };

  const enqueue = (link, url) => {
    if (link.dataset.cwPaywallUrl === url) return;
    link.dataset.cwPaywallUrl = url;
    queued.add({ link, url });
  };

  const scan = () => {
    for (const link of document.querySelectorAll('a[href*="/article/"]')) {
      const url = normalizeArticleUrl(link.href);
      if (!url || !isLikelyTitleLink(link)) continue;
      enqueue(link, url);
    }
    pump();
  };

  scan();

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 400);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();