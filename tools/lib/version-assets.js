const fs = require('fs');
const path = require('path');

// Match http:, https:, tel:, mailto:, data:, file:, blob:, ws:, etc.
// and protocol-relative URLs starting with //.
const SKIP_PROTOCOL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function isLocalAsset(url) {
  if (!url) return false;
  if (url.startsWith('#')) return false;
  if (SKIP_PROTOCOL_RE.test(url)) return false;
  return true;
}

function mtimeStamp(filePath) {
  const d = fs.statSync(filePath).mtime;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function versionAssets(html, root) {
  const stats = { versioned: new Set(), missing: new Set() };

  const versionUrl = (rawUrl) => {
    if (!isLocalAsset(rawUrl)) return rawUrl;

    const qIdx = rawUrl.indexOf('?');
    const pathOnly = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);

    const diskPath = path.join(root, pathOnly);
    if (!fs.existsSync(diskPath)) {
      if (!stats.missing.has(pathOnly)) {
        stats.missing.add(pathOnly);
        console.warn(`  ⚠ Asset introuvable, non versionné : ${pathOnly}`);
      }
      return rawUrl;
    }

    stats.versioned.add(pathOnly);
    return `${pathOnly}?v=${mtimeStamp(diskPath)}`;
  };

  const versionSrcset = (list) =>
    list
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return part;
        const tokens = trimmed.split(/\s+/);
        const url = versionUrl(tokens[0]);
        return tokens.length > 1 ? `${url} ${tokens.slice(1).join(' ')}` : url;
      })
      .join(', ');

  let next = html;

  // 1) href="..." et src="..." (URL unique)
  next = next.replace(
    /(\s(?:href|src)\s*=\s*")([^"]+)(")/gi,
    (_, pre, url, post) => pre + versionUrl(url) + post
  );

  // 2) srcset="..." et imagesrcset="..." (liste d'URLs)
  next = next.replace(
    /(\s(?:srcset|imagesrcset)\s*=\s*")([^"]+)(")/gi,
    (_, pre, list, post) => pre + versionSrcset(list) + post
  );

  // 3) url(...) dans le CSS inline
  next = next.replace(
    /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g,
    (_, quote, url) => `url(${quote}${versionUrl(url)}${quote})`
  );

  return {
    html: next,
    versionedCount: stats.versioned.size,
    missingCount: stats.missing.size,
  };
}

module.exports = { versionAssets };
