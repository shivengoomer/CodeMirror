import { apiClient } from "../shared/api-client";
import {
  clearAuthTokens,
  clearUserProfile,
  getAuthTokens,
  setAuthTokens,
  setUserProfile,
} from "../shared/storage";
import type { ExtensionMessage, MessageResponse } from "../shared/types";

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }
);

async function handleMessage(msg: ExtensionMessage): Promise<MessageResponse> {
  switch (msg.type) {
    case "LOGIN":
      return handleLogin(msg.data.email, msg.data.password);
    case "GET_AUTH_STATUS":
      return getAuthStatus();
    case "LOGOUT":
      await clearAuthTokens();
      await clearUserProfile();
      return { success: true };
    default:
      return { success: false, error: "Unsupported message type" };
  }
}

async function getAuthStatus(): Promise<MessageResponse> {
  try {
    const tokens = await getAuthTokens();
    if (!tokens) {
      return { success: true, data: { authenticated: false } };
    }
    const user = await apiClient.me();
    return { success: true, data: { authenticated: true, user } };
  } catch {
    return { success: true, data: { authenticated: false } };
  }
}

async function handleLogin(email: string, password: string): Promise<MessageResponse> {
  const resp = await apiClient.login(email, password);
  await setAuthTokens({
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
  });
  await setUserProfile(resp.user);

  const cookies = await getLeetCodeCookies();
  const syncResp = await apiClient.syncLeetCodeSession({
    leetcode_session: cookies.session ?? undefined,
    leetcode_csrf: cookies.csrf ?? undefined,
    leetcode_headers: cookies.headers,
  });

  return {
    success: true,
    data: {
      user: resp.user,
      cookie_sync_status: syncResp.status,
      has_leetcode_session: Boolean(cookies.session),
      has_csrf: Boolean(cookies.csrf),
    },
  };
}

async function getLeetCodeCookies(): Promise<{
  session: string | null;
  csrf: string | null;
  headers: Record<string, string>;
}> {
  const sessionCookie = await chrome.cookies.get({
    url: "https://leetcode.com",
    name: "LEETCODE_SESSION",
  });
  const csrfCookie = await chrome.cookies.get({
    url: "https://leetcode.com",
    name: "csrftoken",
  });

  const session = sessionCookie?.value || null;
  const csrf = csrfCookie?.value || null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Referer: "https://leetcode.com",
    "User-Agent": "Mozilla/5.0",
  };
  if (session && csrf) {
    headers.Cookie = `LEETCODE_SESSION=${session}; csrftoken=${csrf}`;
    headers["x-csrftoken"] = csrf;
  }

  return { session, csrf, headers };
}
