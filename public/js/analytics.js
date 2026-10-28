/* Product analytics events, sent only when the site owner has enabled a
 * privacy-friendly analytics script (Plausible or Umami, see ENV_REFERENCE.md).
 * Without it every call is a no-op. Never send personal data in props.
 */

export function track(name, props = {}) {
  try {
    if (typeof window.plausible === 'function') window.plausible(name, { props });
    else if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, props);
  } catch {
    // analytics must never break the app
  }
}
