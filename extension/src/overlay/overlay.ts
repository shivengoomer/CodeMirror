import type { OverlayData } from "../shared/types";
import { OVERLAY_AUTO_DISMISS_MS } from "../shared/constants";

/**
 * CSS for the overlay, injected inside a Shadow DOM so it never conflicts
 * with the host page's styles.
 */
const OVERLAY_CSS = `
:host {
  all: initial;
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  pointer-events: auto;
}
.cm-overlay {
  width: 360px;
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 14px;
  padding: 18px 20px;
  color: #e2e8f0;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 30px rgba(99, 102, 241, 0.1);
  animation: cm-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  line-height: 1.5;
}
@keyframes cm-slide-in {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.cm-overlay.cm-dismissing {
  animation: cm-slide-out 0.25s ease-in forwards;
}
@keyframes cm-slide-out {
  to { opacity: 0; transform: translateY(10px) scale(0.96); }
}
.cm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cm-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #818cf8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cm-logo svg {
  width: 16px;
  height: 16px;
}
.cm-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  white-space: nowrap;
}
.cm-badge.cm-recurring {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}
.cm-headline {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0 0 6px;
}
.cm-body {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 12px;
}
.cm-cta {
  font-size: 12px;
  color: #a5b4fc;
  font-style: italic;
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 2px solid rgba(99, 102, 241, 0.4);
}
.cm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}
.cm-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  color: #c7d2fe;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.cm-dismiss {
  display: block;
  width: 100%;
  padding: 7px 0;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: #64748b;
  font-size: 11px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cm-dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}
.cm-progress-bar {
  height: 2px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 1px;
  margin-top: 10px;
  overflow: hidden;
}
.cm-progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 1px;
  animation: cm-countdown ${OVERLAY_AUTO_DISMISS_MS}ms linear forwards;
}
@keyframes cm-countdown {
  from { width: 100%; }
  to   { width: 0%; }
}
`;

const MIRROR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
  <path d="M2 17l10 5 10-5"/>
  <path d="M2 12l10 5 10-5"/>
</svg>`;

function buildOverlayHTML(data: OverlayData): string {
  const tags = (data.error_types ?? [])
    .map((t) => `<span class="cm-tag">${escapeHtml(t)}</span>`)
    .join("");

  const badgeClass = data.is_recurring ? "cm-badge cm-recurring" : "cm-badge";

  return `
    <div class="cm-overlay">
      <div class="cm-header">
        <span class="cm-logo">${MIRROR_ICON} CodeMirror</span>
        <span class="${badgeClass}">${escapeHtml(data.badge_label)}</span>
      </div>
      <p class="cm-headline">${escapeHtml(data.headline)}</p>
      <p class="cm-body">${escapeHtml(data.body)}</p>
      <p class="cm-cta">${escapeHtml(data.call_to_action)}</p>
      ${tags ? `<div class="cm-tags">${tags}</div>` : ""}
      <div class="cm-progress-bar"><div class="cm-progress-fill"></div></div>
      <button class="cm-dismiss">Dismiss</button>
    </div>
  `;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Inject the CodeMirror overlay into the page using Shadow DOM
 * for complete style isolation.
 */
export function injectOverlay(data: OverlayData): void {
  // Remove any existing overlay
  document.getElementById("codemirror-overlay-host")?.remove();

  const host = document.createElement("div");
  host.id = "codemirror-overlay-host";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.innerHTML = buildOverlayHTML(data);
  shadow.appendChild(container);

  document.body.appendChild(host);

  // Dismiss button
  const dismissBtn = shadow.querySelector(".cm-dismiss");
  dismissBtn?.addEventListener("click", () => dismissOverlay(host, shadow));

  // Auto-dismiss
  setTimeout(() => dismissOverlay(host, shadow), OVERLAY_AUTO_DISMISS_MS);
}

function dismissOverlay(host: HTMLElement, shadow: ShadowRoot): void {
  const overlay = shadow.querySelector(".cm-overlay");
  if (!overlay) {
    host.remove();
    return;
  }
  overlay.classList.add("cm-dismissing");
  overlay.addEventListener("animationend", () => host.remove(), { once: true });
  // Fallback removal
  setTimeout(() => host.remove(), 300);
}

/**
 * Listen for overlay injection messages from the service worker response flow.
 */
export function listenForOverlay(): void {
  window.addEventListener("message", (event) => {
    if (event.data?.type === "__CODEMIRROR_OVERLAY__" && event.data.payload) {
      injectOverlay(event.data.payload as OverlayData);
    }
  });
}
