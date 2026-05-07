import type { MessageResponse } from "../shared/types";

const loginForm = document.querySelector("#login-form") as HTMLFormElement;
const loginError = document.querySelector("#login-error") as HTMLElement;
const loginResult = document.querySelector("#login-result") as HTMLElement;
const authState = document.querySelector("#auth-state") as HTMLElement;
const logoutBtn = document.querySelector("#btn-logout") as HTMLButtonElement;

async function sendMessage(msg: Record<string, unknown>): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(msg);
}

function show(el: HTMLElement): void {
  el.hidden = false;
}

function hide(el: HTMLElement): void {
  el.hidden = true;
}

function setLoggedOutView(): void {
  show(loginForm);
  hide(logoutBtn);
  hide(authState);
}

function setLoggedInView(email: string): void {
  hide(loginForm);
  show(logoutBtn);
  authState.textContent = `Logged in as ${email}`;
  show(authState);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(loginError);
  hide(loginResult);

  const email = (document.querySelector("#login-email") as HTMLInputElement).value.trim();
  const password = (document.querySelector("#login-password") as HTMLInputElement).value;
  const btn = loginForm.querySelector("button") as HTMLButtonElement;

  btn.disabled = true;
  btn.textContent = "Signing in...";
  try {
    const resp = await sendMessage({ type: "LOGIN", data: { email, password } });
    if (!resp.success) {
      loginError.textContent = resp.error ?? "Login failed";
      show(loginError);
      return;
    }
    const data = (resp.data ?? {}) as Record<string, unknown>;
    loginResult.textContent =
      `Login successful. Cookie sync: ${String(data.cookie_sync_status ?? "unknown")}. ` +
      `LEETCODE_SESSION: ${String(Boolean(data.has_leetcode_session))}, csrftoken: ${String(Boolean(data.has_csrf))}`;
    show(loginResult);
    const user = (data.user ?? {}) as { email?: string };
    setLoggedInView(user.email ?? email);
  } catch (err) {
    loginError.textContent = String(err);
    show(loginError);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
});

logoutBtn.addEventListener("click", async () => {
  await sendMessage({ type: "LOGOUT" });
  setLoggedOutView();
  loginResult.textContent = "Logged out.";
  show(loginResult);
});

async function init(): Promise<void> {
  hide(loginError);
  hide(loginResult);
  try {
    const resp = await sendMessage({ type: "GET_AUTH_STATUS" });
    const data = (resp.data ?? {}) as { authenticated?: boolean; user?: { email?: string } };
    if (resp.success && data.authenticated) {
      setLoggedInView(data.user?.email ?? "user");
      return;
    }
  } catch {
    // Ignore and show login view.
  }
  setLoggedOutView();
}

void init();
