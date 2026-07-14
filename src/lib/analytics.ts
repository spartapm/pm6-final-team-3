export type AnalyticsEvent =
  | "click_to_chat_pop"
  | "click_to_home"
  | "click_to_calendar"
  | "click_to_chat"
  | "click_to_write"
  | "click_to_my"
  | "add_to_schedule"
  | "succeed_to_schedule"
  | "send_to_message"
  | "arrange_chat"
  | "succeed_to_chat"
  | "add_to_write"
  | "login_social";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  params?: Record<string, string>,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
  });
}

const PENDING_KAKAO_LOGIN_KEY = "haru-pending-kakao-login";

export function markPendingKakaoLogin() {
  if (typeof window === "undefined") {
    return;
  }
  // OAuth 리다이렉트 대비 localStorage 사용
  window.localStorage.setItem(PENDING_KAKAO_LOGIN_KEY, "1");
}

export function consumePendingKakaoLogin() {
  if (typeof window === "undefined") {
    return false;
  }
  const pending = window.localStorage.getItem(PENDING_KAKAO_LOGIN_KEY) === "1";
  if (pending) {
    window.localStorage.removeItem(PENDING_KAKAO_LOGIN_KEY);
  }
  return pending;
}

