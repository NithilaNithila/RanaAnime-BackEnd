const net = require("net");

function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  if (net.isIP(host) === 4) {
    const p = host.split(".").map(Number);
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  if (net.isIP(host) === 6) return true;

  return false;
}

function isSafeHttpUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return !isPrivateHostname(parsed.hostname);
}

module.exports = { isSafeHttpUrl, isPrivateHostname };
