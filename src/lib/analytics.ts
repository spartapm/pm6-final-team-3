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
  window.sessionStorage.setItem(PENDING_KAKAO_LOGIN_KEY, "1");
}

export function consumePendingKakaoLogin() {
  if (typeof window === "undefined") {
    return false;
  }
  const pending = window.sessionStorage.getItem(PENDING_KAKAO_LOGIN_KEY) === "1";
  if (pending) {
    window.sessionStorage.removeItem(PENDING_KAKAO_LOGIN_KEY);
  }
  return pending;
}
