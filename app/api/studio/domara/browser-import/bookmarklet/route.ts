import { NextRequest, NextResponse } from "next/server";
import {
  CASAHUD_BROWSER_IMPORT_CAPTURE_VERSION,
  CASAHUD_BROWSER_IMPORT_MAX_IMAGE_CANDIDATES,
  CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS,
  CASAHUD_BROWSER_IMPORT_VERSION,
} from "@/lib/studio/domara/browser-listing-capture-parser";
import { resolveCasaHudPublicAppOrigin } from "@/lib/studio/domara/public-app-origin";

export const runtime = "nodejs";

function buildBookmarkletScript(origin: string, encodedCampaignId?: string) {
  return `
(function () {
  if (window.__CASAFLIX_BROWSER_IMPORT_ACTIVE__) {
    return;
  }
  window.__CASAFLIX_BROWSER_IMPORT_ACTIVE__ = true;

  var APP_ORIGIN = ${JSON.stringify(origin)};
  var CAMPAIGN_ID_ENCODED = ${JSON.stringify(encodedCampaignId || "")};
  var CAMPAIGN_ID = "";
  var CAPTURE_VERSION = ${JSON.stringify(CASAHUD_BROWSER_IMPORT_CAPTURE_VERSION)};
  var PAYLOAD_VERSION = ${JSON.stringify(CASAHUD_BROWSER_IMPORT_VERSION)};
  var MAX_VISIBLE_TEXT_CHARS = ${String(CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS)};
  var MAX_IMAGE_CANDIDATES = ${String(CASAHUD_BROWSER_IMPORT_MAX_IMAGE_CANDIDATES)};

  try {
    CAMPAIGN_ID = CAMPAIGN_ID_ENCODED ? decodeURIComponent(CAMPAIGN_ID_ENCODED) : "";
  } catch (_error) {
    CAMPAIGN_ID = "";
  }

  function cleanText(value) {
    return typeof value === "string" ? value.replace(/\\s+/g, " ").trim() : "";
  }

  function cleanMultiline(value) {
    if (typeof value !== "string") return "";
    return value
      .replace(/\\r/g, "\\n")
      .split(/\\n+/)
      .map(function (line) {
        return line.replace(/\\s+/g, " ").trim();
      })
      .filter(Boolean)
      .join("\\n")
      .trim();
  }

  function resolveHttpUrl(value) {
    if (!value || typeof value !== "string") return null;
    try {
      var normalized = value.indexOf("//") === 0 ? "https:" + value : value;
      var resolved = new URL(normalized, window.location.href);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
      return resolved.toString();
    } catch (_error) {
      return null;
    }
  }

  function metaContent(selector) {
    var node = document.querySelector(selector);
    if (!node) return "";
    return cleanText(node.getAttribute("content"));
  }

  function collectVisibleText() {
    var root = document.body;
    if (!root) return "";
    var chunks = [];
    var dedupe = Object.create(null);

    function pushText(raw) {
      var cleaned = cleanMultiline(raw);
      if (!cleaned) return;
      var key = cleaned.slice(0, 220);
      if (dedupe[key]) return;
      dedupe[key] = true;
      chunks.push(cleaned);
    }

    var bodyText = typeof root.innerText === "string" && root.innerText.trim() ? root.innerText : root.textContent || "";
    pushText(bodyText);

    var selectors = [
      "main",
      "[role='main']",
      "article",
      "[id*='description']",
      "[class*='description']",
      "[id*='details']",
      "[class*='details']"
    ];
    selectors.forEach(function (selector) {
      var nodes = Array.prototype.slice.call(document.querySelectorAll(selector), 0, 10);
      nodes.forEach(function (node) {
        var text = typeof node.innerText === "string" && node.innerText.trim() ? node.innerText : node.textContent || "";
        pushText(text);
      });
    });

    var joined = chunks.join("\\n");
    if (joined.length <= MAX_VISIBLE_TEXT_CHARS) return joined;
    var clipped = joined.slice(0, MAX_VISIBLE_TEXT_CHARS);
    var boundary = Math.max(clipped.lastIndexOf("\\n"), clipped.lastIndexOf(". "), clipped.lastIndexOf(" "));
    return cleanMultiline(clipped.slice(0, boundary > 200 ? boundary : MAX_VISIBLE_TEXT_CHARS));
  }

  function collectImages() {
    var dedupe = Object.create(null);
    var results = [];

    function push(url, source, alt, width, height) {
      var normalizedUrl = resolveHttpUrl(url);
      if (!normalizedUrl) return;
      if (dedupe[normalizedUrl]) return;
      if ((source === "visible_img" || source === "srcset") && Math.max(width || 0, height || 0) > 0 && Math.max(width || 0, height || 0) < 140) return;
      dedupe[normalizedUrl] = true;
      results.push({
        url: normalizedUrl,
        alt: cleanText(alt || ""),
        width: width || undefined,
        height: height || undefined,
        source: source
      });
    }

    push(metaContent('meta[property="og:image"]'), "og");
    push(metaContent('meta[name="twitter:image"]'), "twitter");

    var images = Array.prototype.slice.call(document.images || [], 0, 80);
    images.forEach(function (image) {
      push(image.currentSrc || image.src, "visible_img", image.alt, image.naturalWidth || image.width, image.naturalHeight || image.height);
      var srcset = cleanText(image.getAttribute("srcset"));
      if (srcset) {
        var best = null;
        srcset.split(",").forEach(function (entry) {
          var token = cleanText(entry);
          if (!token) return;
          var parts = token.split(/\\s+/);
          var src = parts[0];
          var descriptor = parts[1] || "";
          var width = Number((descriptor.match(/(\\d+)w/i) || [])[1] || 0);
          if (!best || width > best.width) {
            best = { src: src, width: width };
          }
        });
        if (best && best.src) {
          push(best.src, "srcset", image.alt, best.width || image.naturalWidth || image.width, image.naturalHeight || image.height);
        }
      }
    });

    return results.slice(0, MAX_IMAGE_CANDIDATES);
  }

  function buildReceiverUrl() {
    var receiver = new URL("/apps/studio/casaflix/import", APP_ORIGIN);
    if (CAMPAIGN_ID) receiver.searchParams.set("campaignId", CAMPAIGN_ID);
    receiver.searchParams.set("captureMethod", "bookmarklet");
    return receiver.toString();
  }

  function buildPayload() {
    return {
      version: PAYLOAD_VERSION,
      campaignId: CAMPAIGN_ID || undefined,
      sourceUrl: window.location.href,
      canonicalUrl: resolveHttpUrl((document.querySelector('link[rel="canonical"]') || {}).href || ""),
      providerHost: window.location.hostname,
      capturedAt: new Date().toISOString(),
      captureVersion: CAPTURE_VERSION,
      title: cleanText(document.title || ""),
      metaDescription: metaContent('meta[name="description"]'),
      openGraph: {
        title: metaContent('meta[property="og:title"]'),
        description: metaContent('meta[property="og:description"]'),
        image: metaContent('meta[property="og:image"]')
      },
      twitter: {
        title: metaContent('meta[name="twitter:title"]'),
        description: metaContent('meta[name="twitter:description"]'),
        image: metaContent('meta[name="twitter:image"]')
      },
      visibleText: collectVisibleText(),
      imageCandidates: collectImages()
    };
  }

  try {
    var payload = buildPayload();
    var serialized = JSON.stringify(payload);
    var receiverUrl = buildReceiverUrl();
    var popup = window.open("about:blank", "_blank");

    if (popup) {
      popup.name = serialized;
      popup.location = receiverUrl;
    } else {
      window.name = serialized;
      window.location.href = receiverUrl;
    }
  } catch (error) {
    window.alert("CasaFlix could not capture this page right now. Open the listing again and retry the browser importer.");
    console.error("CasaFlix browser importer failed", error);
  } finally {
    window.setTimeout(function () {
      try {
        delete window.__CASAFLIX_BROWSER_IMPORT_ACTIVE__;
      } catch (_error) {
        window.__CASAFLIX_BROWSER_IMPORT_ACTIVE__ = false;
      }
    }, 500);
  }
})();
  `.trim();
}

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaignId")?.trim() || undefined;
  const encodedCampaignId = campaignId ? encodeURIComponent(campaignId) : undefined;
  const appOrigin = resolveCasaHudPublicAppOrigin(request);
  const script = buildBookmarkletScript(appOrigin, encodedCampaignId);
  return new NextResponse(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
