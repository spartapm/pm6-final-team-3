"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  createChatSummary,
  createMemo,
  createSchedule,
  createTodo,
  deleteMemo,
  deleteSchedule,
  deleteTodo,
  loadAppData,
  updateMemo,
  updateSchedule,
  updateTodo,
  updateTodoCompleted,
  upsertProfile,
  type AppMemo,
  type AppProfile,
  type AppSchedule,
  type AppTodo,
} from "@/lib/haru-store";
import {
  consumePendingKakaoLogin,
  markPendingKakaoLogin,
  trackEvent,
} from "@/lib/analytics";
import {
  GUEST_USER_ID,
  guestCreateMemo,
  guestCreateSchedule,
  guestCreateTodo,
  guestDeleteMemo,
  guestDeleteSchedule,
  guestDeleteTodo,
  guestUpdateMemo,
  guestUpdateSchedule,
  guestUpdateTodo,
  isGuestUser,
  loadGuestData,
} from "@/lib/guest-store";
import {
  CalendarDot,
  ColorChip,
  Icon,
  ScheduleBar,
  scheduleColorChips,
  type IconName,
} from "@/components/ui-icon";
import { supabase } from "@/lib/supabase/client";

type Tab = "home" | "calendar" | "chat" | "records" | "my";
type RecordMode = "memo" | "todo";
type ModalType =
  | "scheduleCreate"
  | "scheduleEdit"
  | "memoEdit"
  | "todoEdit"
  | "todoItemEdit"
  | "manualMemo"
  | "manualTodo"
  | "saved"
  | "cancel"
  | "logout"
  | "deleteSchedule"
  | "deleteMemo"
  | "deleteTodo";

type Todo = AppTodo;
type Schedule = AppSchedule;
type Memo = AppMemo;

type Message = {
  id: number;
  from: "user" | "ai";
  text: string;
};
type ScheduleSuggestion = {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  color: string;
  accepted?: boolean | null;
};
type AiSummary = {
  memo: {
    title: string;
    body: string;
  };
  todos: string[];
  schedules: ScheduleSuggestion[];
};
type ScheduleFormPayload = {
  title: string;
  date: string;
  endDate: string;
  color: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  repeatDays: string[];
};
type EditorSavePayload =
  | {
      kind: "memo";
      date: string;
      title: string;
      body: string;
    }
  | {
      kind: "todo";
      date: string;
      todos: string[];
    };
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const today = getTodayInfo();
const TAB_STORAGE_KEY = "haru-active-tab";

function readStoredTab(): Tab {
  if (typeof window === "undefined") {
    return "home";
  }

  const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
  if (
    stored === "home" ||
    stored === "calendar" ||
    stored === "chat" ||
    stored === "records" ||
    stored === "my"
  ) {
    return stored;
  }

  return "home";
}

const initialMessages: Message[] = [
  {
    id: 1,
    from: "ai",
    text: "안녕하세요, 저는 AI요정 하루예요. 오늘 있었던 일과 내일 해야 할 일을 편하게 말해주세요.",
  },
];

const navItems: Array<{ tab: Tab; label: string; icon: IconName }> = [
  { tab: "home", label: "홈", icon: "home" },
  { tab: "calendar", label: "캘린더", icon: "calendar" },
  { tab: "chat", label: "", icon: "message" },
  { tab: "records", label: "기록", icon: "record" },
  { tab: "my", label: "마이", icon: "user" },
];

export default function HaruFairyApp() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [recordMode, setRecordMode] = useState<RecordMode>("memo");
  const [chatDone, setChatDone] = useState(false);
  const [modal, setModal] = useState<ModalType | null>(null);
  const [pendingCloseModal, setPendingCloseModal] = useState<ModalType | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonthIndex, setViewMonthIndex] = useState(today.monthIndex);
  const [selectedDateKey, setSelectedDateKey] = useState(today.dateKey);
  const [homeSelectedDateKey] = useState(today.dateKey);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [hasHydratedTab, setHasHydratedTab] = useState(false);

  const monthDays = useMemo(
    () => buildMonthDays(viewYear, viewMonthIndex),
    [viewYear, viewMonthIndex],
  );
  const viewMonthName = `${viewMonthIndex + 1}월`;
  const viewMonthTitle = `${viewYear}년 ${viewMonthName}`;
  const todaysTodos = todos.filter((todo) => todo.date === today.dateKey);
  const todaysSchedules = schedules.filter(
    (schedule) => schedule.date === today.dateKey,
  );
  const completedCount = todaysTodos.filter((todo) => todo.done).length;
  const totalCompletedCount = todos.filter((todo) => todo.done).length;
  const selectedSchedules = schedules.filter(
    (schedule) => schedule.date === selectedDateKey,
  );
  const selectedWeekday = getWeekdayForDateKey(selectedDateKey);
  const selectedDay = Number(selectedDateKey.split("-")[2]);

  useEffect(() => {
    // 링크/새로고침 진입은 항상 홈 화면
    setActiveTab("home");
    window.localStorage.setItem(TAB_STORAGE_KEY, "home");
    setHasHydratedTab(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedTab) {
      return;
    }
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab, hasHydratedTab]);

  useEffect(() => {
    let mounted = true;

    async function syncInitialSession() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({}, document.title, window.location.pathname);
        if (error) {
          setAppError(getErrorMessage(error));
        }
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        void applySession(data.session, {
          shouldGoHome: Boolean(data.session) && !window.localStorage.getItem(TAB_STORAGE_KEY),
        });
      }
    }

    void syncInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        void applySession(session, {
          shouldGoHome: event === "SIGNED_IN",
        });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function applySession(
    nextSession: Session | null,
    options: { shouldGoHome?: boolean } = {},
  ) {
    setSession(nextSession);
    setIsLoggedIn(Boolean(nextSession));
    setAppError(null);

    if (!nextSession) {
      setProfile(null);
      const guest = loadGuestData();
      setMemos(guest.memos);
      setTodos(guest.todos);
      setSchedules(guest.schedules);
      setIsLoadingData(false);
      window.localStorage.removeItem("haru-has-session");
      window.localStorage.setItem(TAB_STORAGE_KEY, "home");
      setActiveTab("home");
      return;
    }

    window.localStorage.setItem("haru-has-session", "1");
    setIsLoadingData(true);

    const provider = getProviderFromSession(nextSession);
    if (isKakaoProvider(nextSession, provider) && consumePendingKakaoLogin()) {
      window.setTimeout(() => {
        trackEvent("login_social", { method: "kakao" });
      }, 500);
    }

    try {
      const authProfile = getProfileFromSession(nextSession);
      await upsertProfile({
        userId: nextSession.user.id,
        nickname: authProfile.nickname,
        avatarUrl: authProfile.avatarUrl,
        provider,
      });
      const data = await loadAppData(nextSession.user.id);
      setProfile(normalizeProfile(data.profile, authProfile));
      setMemos(data.memos);
      setTodos(data.todos);
      setSchedules(data.schedules);

      if (options.shouldGoHome) {
        setActiveTab("home");
        window.localStorage.setItem(TAB_STORAGE_KEY, "home");
      }
    } catch (error) {
      setAppError(getErrorMessage(error));
    } finally {
      setIsLoadingData(false);
    }
  }

  const scheduleColorsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const schedule of schedules) {
      const colors = map.get(schedule.date) ?? [];
      if (!colors.includes(schedule.color)) {
        colors.push(schedule.color);
      }
      map.set(schedule.date, colors);
    }
    return map;
  }, [schedules]);

  const calendarCells = useMemo(() => {
    return monthDays.map((cell) => ({
      id: cell.dateKey,
      day: cell.day,
      muted: cell.muted,
      today: cell.dateKey === today.dateKey,
      selected: cell.dateKey === selectedDateKey,
      scheduleColors: scheduleColorsByDate.get(cell.dateKey) ?? [],
    }));
  }, [monthDays, scheduleColorsByDate, selectedDateKey]);

  const homeCalendarCells = useMemo(() => {
    const homeDays = buildMonthDays(today.year, today.monthIndex);

    return homeDays.map((cell) => ({
      id: cell.dateKey,
      day: cell.day,
      muted: cell.muted,
      today: cell.dateKey === today.dateKey,
      selected: cell.dateKey === homeSelectedDateKey,
      scheduleColors: scheduleColorsByDate.get(cell.dateKey) ?? [],
    }));
  }, [homeSelectedDateKey, scheduleColorsByDate]);

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonthIndex + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth();
    setViewYear(nextYear);
    setViewMonthIndex(nextMonth);

    const selected = new Date(`${selectedDateKey}T00:00:00`);
    if (selected.getFullYear() !== nextYear || selected.getMonth() !== nextMonth) {
      const day = Math.min(selected.getDate(), new Date(nextYear, nextMonth + 1, 0).getDate());
      setSelectedDateKey(formatDateKey(nextYear, nextMonth, day));
    }
  }

  function selectCalendarDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    const date = new Date(`${dateKey}T00:00:00`);
    setViewYear(date.getFullYear());
    setViewMonthIndex(date.getMonth());
  }

  function requestCloseModal(source: ModalType, dirty: boolean) {
    if (dirty) {
      setPendingCloseModal(source);
      setModal("cancel");
      return;
    }
    closeModal();
  }

  async function toggleTodo(id: string) {
    const target = todos.find((todo) => todo.id === id);
    if (!target) {
      return;
    }

    const nextDone = !target.done;
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, done: nextDone } : todo,
      ),
    );

    try {
      const userId = getActorId();
      if (isGuestUser(userId)) {
        guestUpdateTodo({ id, done: nextDone });
        return;
      }
      await updateTodoCompleted({ id, completed: nextDone });
    } catch (error) {
      setTodos((current) =>
        current.map((todo) =>
          todo.id === id ? { ...todo, done: target.done } : todo,
        ),
      );
      setAppError(getErrorMessage(error));
    }
  }

  async function sendMessage() {
    const text = messageDraft.trim();
    if (!text) {
      return;
    }

    trackEvent("send_to_message");

    const nextMessages: Message[] = [
      ...messages,
      { id: Date.now(), from: "user", text },
    ];

    setMessages(nextMessages);
    setMessageDraft("");
    setIsSendingMessage(true);
    setAppError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: nextMessages }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !data.reply) {
        throw new Error(data.error || "AI 응답을 불러오지 못했어요.");
      }

      const reply = data.reply;
      setMessages((currentMessages) => [
        ...currentMessages,
        { id: Date.now() + 1, from: "ai", text: reply },
      ]);
    } catch (error) {
      setAppError(getErrorMessage(error));
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now() + 1,
          from: "ai",
          text: "지금은 답변을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
        },
      ]);
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function finishChat() {
    trackEvent("arrange_chat");
    setIsSummarizing(true);
    setAppError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "summary",
          messages,
          today: today.dateKey,
        }),
      });
      const data = (await response.json()) as {
        summary?: AiSummary;
        error?: string;
      };

      if (!response.ok || !data.summary) {
        throw new Error(data.error || "정리 결과를 만들지 못했어요.");
      }

      setSummary(data.summary);
      setChatDone(true);
    } catch (error) {
      setAppError(getErrorMessage(error));
    } finally {
      setIsSummarizing(false);
    }
  }

  async function saveSummary() {
    const userId = requireUserId();
    if (!summary) {
      return;
    }

    try {
      const acceptedSchedules = summary.schedules.filter(
        (schedule) => schedule.accepted !== false,
      );

      if (isGuestUser(userId)) {
        const memo = guestCreateMemo({
          date: today.dateKey,
          title: summary.memo.title,
          body: summary.memo.body,
        });
        const createdTodos = summary.todos.map((text) =>
          guestCreateTodo({
            date: today.dateKey,
            text,
          }),
        );
        const createdSchedules = acceptedSchedules.map((schedule) =>
          guestCreateSchedule({
            date: schedule.date,
            title: schedule.title,
            startTime: schedule.startTime,
            isAllDay: schedule.isAllDay,
            color: schedule.color,
          }),
        );
        setMemos((current) => [memo, ...current]);
        setTodos((current) => [...createdTodos, ...current]);
        if (createdSchedules.length > 0) {
          setSchedules((current) => [...createdSchedules, ...current]);
        }
        trackEvent("succeed_to_chat");
        setModal("saved");
        return;
      }

      const [memo, createdTodos, createdSchedules] = await Promise.all([
        createMemo({
          userId,
          date: today.dateKey,
          title: summary.memo.title,
          body: summary.memo.body,
          source: "ai",
        }),
        Promise.all(
          summary.todos.map((text) =>
            createTodo({
              userId,
              date: today.dateKey,
              text,
              source: "ai",
            }),
          ),
        ),
        Promise.all(
          acceptedSchedules.map((schedule) =>
            createSchedule({
              userId,
              date: schedule.date,
              title: schedule.title,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              isAllDay: schedule.isAllDay,
              color: schedule.color,
              source: "ai",
            }),
          ),
        ),
      ]);

      await createChatSummary({
        userId,
        conversation: messages,
        memoTitle: summary.memo.title,
        memoBody: summary.memo.body,
        todos: summary.todos,
        scheduleSuggestions: acceptedSchedules,
      });

      setMemos((current) => [memo, ...current]);
      setTodos((current) => [...createdTodos, ...current]);
      if (createdSchedules.length > 0) {
        setSchedules((current) => [...createdSchedules, ...current]);
      }
      trackEvent("succeed_to_chat");
      setModal("saved");
    } catch (error) {
      setAppError(getErrorMessage(error));
    }
  }

  function closeModal() {
    setModal(null);
    setPendingCloseModal(null);
    setEditingSchedule(null);
    setEditingMemo(null);
    setEditingTodo(null);
    setEditingScheduleIndex(null);
    setDeletingTodoId(null);
  }

  function getActorId() {
    return session?.user.id ?? GUEST_USER_ID;
  }

  function requireUserId() {
    return getActorId();
  }

  function toAuthEmail(rawId: string) {
    const value = rawId.trim();
    if (value.includes("@")) {
      return value;
    }
    return `${value}@harufairy.local`;
  }

  // Supabase Auth 최소 6자 요건을 맞추면서, UX는 숫자 4자리로 유지
  function toAuthPassword(rawPassword: string) {
    const value = rawPassword.trim();
    return value.length < 6 ? `${value}__hf` : value;
  }

  async function signInWithKakao() {
    const redirectTo = window.location.origin;
    markPendingKakaoLogin();

    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        scopes: "profile_nickname",
        queryParams: {
          scope: "profile_nickname",
        },
      },
    });
  }

  function handleNavTab(tab: Tab) {
    const navEvents = {
      home: "click_to_home",
      calendar: "click_to_calendar",
      chat: "click_to_chat",
      records: "click_to_write",
      my: "click_to_my",
    } as const;

    trackEvent(navEvents[tab]);
    setActiveTab(tab);
  }

  async function signInWithEmail(id: string, password: string) {
    setAppError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: toAuthEmail(id),
      password: toAuthPassword(password),
    });

    if (error) {
      setAppError(getAuthErrorMessage(error));
      throw error;
    }
  }

  async function signUpWithEmail(input: {
    id: string;
    nickname: string;
    password: string;
  }) {
    setAppError(null);
    const email = toAuthEmail(input.id);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: toAuthPassword(input.password),
      options: {
        data: {
          name: input.nickname.trim(),
          nickname: input.nickname.trim(),
        },
      },
    });

    if (error) {
      setAppError(getAuthErrorMessage(error));
      throw error;
    }

    if (data.user && !data.session) {
      setAppError("가입 메일을 확인한 뒤 로그인해 주세요.");
      return;
    }

    if (data.session) {
      await upsertProfile({
        userId: data.session.user.id,
        nickname: input.nickname.trim() || getEmailName(email) || "사용자",
        provider: "email",
      });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    window.localStorage.removeItem("haru-has-session");
    setActiveTab("home");
    window.localStorage.setItem(TAB_STORAGE_KEY, "home");
  }

  return (
    <main>
      <section className="screen-shell">
        <div className="screen-scroll">
          {activeTab === "home" && (
            <HomeScreen
              userName={
                session
                  ? profile?.nickname ?? getProfileFromSession(session).nickname
                  : "게스트"
              }
              isLoading={Boolean(session) && isLoadingData}
              error={appError}
              todos={todaysTodos}
              schedules={todaysSchedules}
              completedCount={completedCount}
              calendarCells={homeCalendarCells}
              onChat={() => {
                trackEvent("click_to_chat_pop");
                setActiveTab("chat");
              }}
              onCalendar={() => setActiveTab("calendar")}
              onTodos={() => {
                setRecordMode("todo");
                setActiveTab("records");
              }}
              onToggleTodo={toggleTodo}
              onAddTodo={() => setModal("manualTodo")}
              onEditTodo={(todo) => {
                setEditingTodo(todo);
                setModal("todoItemEdit");
              }}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarScreen
              monthTitle={viewMonthTitle}
              monthName={viewMonthName}
              calendarCells={calendarCells}
              schedules={selectedSchedules}
              selectedDate={selectedDay}
              selectedWeekday={selectedWeekday}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
              onSelectDate={selectCalendarDate}
              onCreate={() => {
                trackEvent("add_to_schedule");
                setEditingSchedule(null);
                setModal("scheduleCreate");
              }}
              onEdit={(schedule) => {
                setEditingSchedule(schedule);
                setModal("scheduleEdit");
              }}
              onDelete={(schedule) => {
                setEditingSchedule(schedule);
                setModal("deleteSchedule");
              }}
            />
          )}

          {activeTab === "chat" && (
            <ChatScreen
              messages={messages}
              summary={summary}
              draft={messageDraft}
              chatDone={chatDone}
              isSending={isSendingMessage}
              isSummarizing={isSummarizing}
              onDraft={setMessageDraft}
              onSend={sendMessage}
              onFinish={finishChat}
              onSave={saveSummary}
              onBack={() => {
                if (chatDone) {
                  setChatDone(false);
                  return;
                }
                setActiveTab("home");
              }}
              onEditMemo={() => {
                setEditingMemo(null);
                setModal("memoEdit");
              }}
              onEditTodo={() => setModal("todoEdit")}
              onEditSchedule={(index) => {
                setEditingScheduleIndex(index);
                setModal("scheduleEdit");
              }}
              onAcceptSchedule={(index, accepted) => {
                setSummary((current) => {
                  if (!current) {
                    return current;
                  }
                  return {
                    ...current,
                    schedules: current.schedules.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, accepted } : item,
                    ),
                  };
                });
              }}
            />
          )}

          {activeTab === "records" && (
            <RecordsScreen
              mode={recordMode}
              memos={memos}
              todos={todos}
              onMode={setRecordMode}
              onToggleTodo={toggleTodo}
              onMemoWrite={() => {
                setEditingMemo(null);
                setModal("manualMemo");
              }}
              onTodoWrite={() => setModal("manualTodo")}
              onMemoDetail={(memo) => {
                setEditingMemo(memo);
                setModal("memoEdit");
              }}
              onDeleteMemo={(memo) => {
                setEditingMemo(memo);
                setModal("deleteMemo");
              }}
              onEditTodo={(todo) => {
                setEditingTodo(todo);
                setModal("todoItemEdit");
              }}
              onDeleteTodo={(todoId) => {
                setDeletingTodoId(todoId);
                setModal("deleteTodo");
              }}
            />
          )}

          {activeTab === "my" && (
            <MyScreen
              userName={profile?.nickname ?? getProfileFromSession(session).nickname}
              isLoggedIn={isLoggedIn}
              error={appError}
              onKakaoLogin={signInWithKakao}
              onEmailLogin={signInWithEmail}
              onEmailSignUp={signUpWithEmail}
              onLogout={() => setModal("logout")}
            />
          )}
        </div>
        <BottomNav activeTab={activeTab} onTab={handleNavTab} />
      </section>

      {modal === "scheduleCreate" && (
        <ScheduleModal
          title="새 일정"
          submitLabel="일정 추가"
          defaultDate={selectedDateKey}
          onClose={(dirty) => requestCloseModal("scheduleCreate", dirty)}
          onSubmit={async (payload) => {
            const userId = requireUserId();

            try {
              const targetDates = buildScheduleDates(
                payload.date,
                payload.endDate,
                payload.repeatDays,
              );
              const created = isGuestUser(userId)
                ? targetDates.map((date) =>
                    guestCreateSchedule({
                      date,
                      title: payload.title,
                      isAllDay: payload.isAllDay,
                      startTime: payload.startTime,
                      color: payload.color,
                    }),
                  )
                : await Promise.all(
                    targetDates.map((date) =>
                      createSchedule({
                        userId,
                        date,
                        title: payload.title,
                        isAllDay: payload.isAllDay,
                        startTime: payload.startTime,
                        endTime: payload.endTime,
                        color: payload.color,
                        repeatDays: payload.repeatDays,
                      }),
                    ),
                  );
              setSchedules((current) => [...created, ...current]);
              setSelectedDateKey(payload.date);
              trackEvent("succeed_to_schedule");
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}

      {modal === "scheduleEdit" && (
        <ScheduleModal
          title="일정 수정"
          submitLabel="저장"
          defaultDate={
            editingSchedule?.date ??
            (editingScheduleIndex != null
              ? summary?.schedules[editingScheduleIndex]?.date
              : selectedDateKey) ??
            selectedDateKey
          }
          initial={
            editingSchedule
              ? {
                  title: editingSchedule.title,
                  date: editingSchedule.date,
                  endDate: editingSchedule.date,
                  color: editingSchedule.color,
                  isAllDay: editingSchedule.isAllDay,
                  startTime: editingSchedule.isAllDay
                    ? "09:00"
                    : normalizeTimeValue(editingSchedule.time),
                  endTime: "10:00",
                  repeatDays: [],
                }
              : editingScheduleIndex != null && summary?.schedules[editingScheduleIndex]
                ? {
                    title: summary.schedules[editingScheduleIndex].title,
                    date: summary.schedules[editingScheduleIndex].date,
                    endDate: summary.schedules[editingScheduleIndex].date,
                    color: summary.schedules[editingScheduleIndex].color,
                    isAllDay: summary.schedules[editingScheduleIndex].isAllDay,
                    startTime:
                      summary.schedules[editingScheduleIndex].startTime ?? "09:00",
                    endTime:
                      summary.schedules[editingScheduleIndex].endTime ?? "10:00",
                    repeatDays: [],
                  }
                : undefined
          }
          onClose={(dirty) => requestCloseModal("scheduleEdit", dirty)}
          onDelete={
            editingSchedule
              ? () => setModal("deleteSchedule")
              : undefined
          }
          onSubmit={async (payload) => {
            if (editingSchedule) {
              try {
                const updated = isGuestUser(requireUserId())
                  ? guestUpdateSchedule({
                      id: editingSchedule.id,
                      date: payload.date,
                      title: payload.title,
                      isAllDay: payload.isAllDay,
                      startTime: payload.startTime,
                      color: payload.color,
                    })
                  : await updateSchedule({
                      id: editingSchedule.id,
                      date: payload.date,
                      title: payload.title,
                      isAllDay: payload.isAllDay,
                      startTime: payload.startTime,
                      endTime: payload.endTime,
                      color: payload.color,
                      repeatDays: payload.repeatDays,
                    });
                setSchedules((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                );
                closeModal();
              } catch (error) {
                setAppError(getErrorMessage(error));
              }
              return;
            }

            if (editingScheduleIndex != null && summary) {
              setSummary({
                ...summary,
                schedules: summary.schedules.map((item, index) =>
                  index === editingScheduleIndex
                    ? {
                        ...item,
                        title: payload.title,
                        date: payload.date,
                        color: payload.color,
                        isAllDay: payload.isAllDay,
                        startTime: payload.startTime,
                        endTime: payload.endTime,
                      }
                    : item,
                ),
              });
              closeModal();
            }
          }}
        />
      )}

      {modal === "memoEdit" && (
        <EditorModal
          kind="memo"
          title="메모"
          summary={summary}
          initialMemo={editingMemo}
          onClose={(dirty) => requestCloseModal("memoEdit", dirty)}
          onDelete={
            editingMemo
              ? () => setModal("deleteMemo")
              : undefined
          }
          onSave={async (payload) => {
            if (payload.kind !== "memo") {
              return;
            }

            if (editingMemo) {
              try {
                const updated = isGuestUser(requireUserId())
                  ? guestUpdateMemo({
                      id: editingMemo.id,
                      date: payload.date,
                      title: payload.title,
                      body: payload.body,
                    })
                  : await updateMemo({
                      id: editingMemo.id,
                      date: payload.date,
                      title: payload.title,
                      body: payload.body,
                    });
                setMemos((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                );
                closeModal();
              } catch (error) {
                setAppError(getErrorMessage(error));
              }
              return;
            }

            if (summary) {
              setSummary({
                ...summary,
                memo: {
                  title: payload.title,
                  body: payload.body,
                },
              });
              closeModal();
            }
          }}
        />
      )}

      {modal === "todoEdit" && (
        <EditorModal
          kind="todo"
          title="To-do"
          summary={summary}
          onClose={(dirty) => requestCloseModal("todoEdit", dirty)}
          onSave={async (payload) => {
            if (payload.kind !== "todo" || !summary) {
              return;
            }
            setSummary({
              ...summary,
              todos: payload.todos,
            });
            closeModal();
          }}
        />
      )}

      {modal === "todoItemEdit" && editingTodo && (
        <EditorModal
          kind="todo"
          title="To-do 수정"
          manual
          initialTodos={[editingTodo.text]}
          initialDate={editingTodo.date}
          onClose={(dirty) => requestCloseModal("todoItemEdit", dirty)}
          onSave={async (payload) => {
            if (payload.kind !== "todo" || payload.todos.length === 0) {
              return;
            }

            try {
              const nextText = payload.todos[0];
              const updated = isGuestUser(requireUserId())
                ? guestUpdateTodo({
                    id: editingTodo.id,
                    text: nextText,
                    date: payload.date,
                  })
                : await updateTodo({
                    id: editingTodo.id,
                    text: nextText,
                    date: payload.date,
                  });
              setTodos((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
              );
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}

      {modal === "manualMemo" && (
        <EditorModal
          kind="memo"
          title="메모 작성"
          manual
          onClose={(dirty) => requestCloseModal("manualMemo", dirty)}
          onSave={async (payload) => {
            const userId = requireUserId();
            if (payload.kind !== "memo") {
              return;
            }

            try {
              const memo = isGuestUser(userId)
                ? guestCreateMemo({
                    date: payload.date,
                    title: payload.title,
                    body: payload.body,
                  })
                : await createMemo({
                    userId,
                    date: payload.date,
                    title: payload.title,
                    body: payload.body,
                  });
              setMemos((current) => [memo, ...current]);
              trackEvent("add_to_write", { content_type: "memo" });
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}

      {modal === "manualTodo" && (
        <EditorModal
          kind="todo"
          title="To-do 작성"
          manual
          onClose={(dirty) => requestCloseModal("manualTodo", dirty)}
          onSave={async (payload) => {
            const userId = requireUserId();
            if (payload.kind !== "todo") {
              return;
            }

            try {
              const createdTodos = isGuestUser(userId)
                ? payload.todos.map((text) =>
                    guestCreateTodo({
                      date: payload.date,
                      text,
                    }),
                  )
                : await Promise.all(
                    payload.todos.map((text) =>
                      createTodo({
                        userId,
                        date: payload.date,
                        text,
                      }),
                    ),
                  );
              setTodos((current) => [...current, ...createdTodos]);
              trackEvent("add_to_write", { content_type: "todo" });
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}

      {modal === "saved" && (
        <SimpleModal
          icon="✓"
          title="저장 완료"
          description="오늘의 기록이 안전하게 저장되었어요."
          actionLabel="확인"
          onAction={() => {
            closeModal();
            setChatDone(false);
            setSummary(null);
            setMessages(initialMessages);
            setRecordMode("memo");
            setActiveTab("records");
          }}
        />
      )}

      {modal === "cancel" && (
        <ConfirmModal
          title="작성을 취소하시겠습니까?"
          description="변경한 내용은 저장되지 않아요."
          onCancel={() => setModal(pendingCloseModal)}
          onConfirm={closeModal}
        />
      )}

      {modal === "logout" && (
        <ConfirmModal
          title="정말 로그아웃 하시겠습니까?"
          description="로그아웃해도 게스트로 홈에서 계속 이용할 수 있어요."
          onCancel={closeModal}
          onConfirm={() => {
            closeModal();
            void signOut();
          }}
        />
      )}

      {modal === "deleteSchedule" && editingSchedule && (
        <ConfirmModal
          title="일정을 삭제할까요?"
          description="삭제한 일정은 되돌릴 수 없어요."
          onCancel={() => setModal("scheduleEdit")}
          onConfirm={async () => {
            try {
              if (isGuestUser(requireUserId())) {
                guestDeleteSchedule(editingSchedule.id);
              } else {
                await deleteSchedule(editingSchedule.id);
              }
              setSchedules((current) =>
                current.filter((item) => item.id !== editingSchedule.id),
              );
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}

      {modal === "deleteMemo" && editingMemo && (
        <ConfirmModal
          title="메모를 삭제할까요?"
          description="삭제한 메모는 되돌릴 수 없어요."
          onCancel={() => setModal("memoEdit")}
          onConfirm={async () => {
            try {
              if (isGuestUser(requireUserId())) {
                guestDeleteMemo(editingMemo.id);
              } else {
                await deleteMemo(editingMemo.id);
              }
              setMemos((current) =>
                current.filter((item) => item.id !== editingMemo.id),
              );
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}

      {modal === "deleteTodo" && deletingTodoId && (
        <ConfirmModal
          title="할 일을 삭제할까요?"
          description="삭제한 할 일은 되돌릴 수 없어요."
          onCancel={closeModal}
          onConfirm={async () => {
            try {
              if (isGuestUser(requireUserId())) {
                guestDeleteTodo(deletingTodoId);
              } else {
                await deleteTodo(deletingTodoId);
              }
              setTodos((current) =>
                current.filter((item) => item.id !== deletingTodoId),
              );
              closeModal();
            } catch (error) {
              setAppError(getErrorMessage(error));
            }
          }}
        />
      )}
    </main>
  );
}

function HomeScreen({
  userName,
  isLoading,
  error,
  todos,
  schedules,
  completedCount,
  calendarCells,
  onChat,
  onCalendar,
  onTodos,
  onToggleTodo,
  onAddTodo,
  onEditTodo,
}: {
  userName: string;
  isLoading: boolean;
  error: string | null;
  todos: Todo[];
  schedules: Schedule[];
  completedCount: number;
  calendarCells: Array<{
    id: string;
    day: number;
    muted: boolean;
    today: boolean;
    selected: boolean;
    scheduleColors: string[];
  }>;
  onChat: () => void;
  onCalendar: () => void;
  onTodos: () => void;
  onToggleTodo: (id: string) => void;
  onAddTodo: () => void;
  onEditTodo: (todo: Todo) => void;
}) {
  return (
    <div className="space-y-6">
      <header className="home-header">
        <div>
          <h1>안녕하세요, {userName}님</h1>
          <p>{today.dateLabel}</p>
        </div>
        <LogoMark compact />
      </header>

      {isLoading && <p className="status-copy">기록을 불러오는 중이에요...</p>}
      {error && <p className="status-copy error">{error}</p>}

      <button className="ai-entry-card" onClick={onChat}>
        <span className="fairy-thumb"><LogoMark /></span>
        <span className="ai-entry-copy">
          <strong>기록하고 싶은 내용이 있나요?</strong>
          <small>AI요정 하루가 정리해드릴게요</small>
        </span>
        <span className="chat-bubble-icon">
          <Icon name="chat-fab" size={56} />
        </span>
      </button>

      <button className="calendar-summary-card" onClick={onCalendar}>
        <div className="mini-month">
          <h2>{today.monthName}</h2>
          <WeekHeader />
          <CalendarGrid cells={calendarCells} mini />
        </div>
        <div className="today-schedule">
          <div className="large-date">
            <strong>{today.shortDate}</strong>
            <span>{today.weekday}</span>
          </div>
          {schedules.length > 0 ? (
            schedules.slice(0, 2).map((schedule) => (
              <ScheduleLine key={schedule.id} schedule={schedule} />
            ))
          ) : (
            <p className="empty-copy">등록된 일정이 없습니다</p>
          )}
        </div>
      </button>

      <section className="todo-card">
        <button className="card-title-row" onClick={onTodos}>
          <h2>오늘의 To-do</h2>
          <span>{completedCount}/{todos.length} 완료</span>
        </button>
        <TodoList
          todos={todos}
          onToggle={onToggleTodo}
          onEdit={onEditTodo}
          emptyText="등록된 To-do가 없습니다"
        />
        <button className="ghost-add-button" onClick={onAddTodo}>
          + To-do 추가
        </button>
      </section>
    </div>
  );
}

function CalendarScreen({
  monthTitle,
  monthName,
  calendarCells,
  schedules,
  selectedDate,
  selectedWeekday,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onCreate,
  onEdit,
  onDelete,
}: {
  monthTitle: string;
  monthName: string;
  calendarCells: Array<{
    id: string;
    day: number;
    muted: boolean;
    today: boolean;
    selected: boolean;
    scheduleColors: string[];
  }>;
  schedules: Schedule[];
  selectedDate: number;
  selectedWeekday: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateKey: string) => void;
  onCreate: () => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}) {
  return (
    <div className="page-stack">
      <header className="page-header centered">
        <button className="nav-arrow prev" aria-label="이전 월" onClick={onPrevMonth}>
          <Icon name="chevron-left" />
        </button>
        <h1>{monthTitle}</h1>
        <button className="nav-arrow" aria-label="다음 월" onClick={onNextMonth}>
          <Icon name="chevron-right" />
        </button>
      </header>

      <section className="month-card">
        <WeekHeader />
        <div className="calendar-grid large">
          {calendarCells.map((cell) => (
            <button
              key={cell.id}
              className={[
                "calendar-cell",
                cell.muted ? "muted" : "",
                cell.today ? "today" : "",
                cell.selected ? "selected" : "",
              ].join(" ")}
              onClick={() => onSelectDate(cell.id)}
            >
              <span>{cell.day}</span>
              {cell.scheduleColors.length > 0 && (
                <span className="calendar-dot-row">
                  {cell.scheduleColors.slice(0, 3).map((color) => (
                    <CalendarDot key={`${cell.id}-${color}`} color={color} />
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="schedule-list-section">
        <p className="section-eyebrow">
          {monthName} {selectedDate}일 {selectedWeekday}요일 · 일정 {schedules.length}개
        </p>
        {schedules.length > 0 ? (
          schedules.map((schedule) => (
            <SwipeScheduleRow
              key={schedule.id}
              schedule={schedule}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        ) : (
          <EmptyState text="등록된 일정이 없습니다" />
        )}
      </section>

      <button className="floating-plus" onClick={onCreate} aria-label="일정 추가">
        <Icon name="plus" />
        <small>추가</small>
      </button>
    </div>
  );
}

function ChatScreen({
  messages,
  summary,
  draft,
  chatDone,
  isSending,
  isSummarizing,
  onDraft,
  onSend,
  onFinish,
  onSave,
  onBack,
  onEditMemo,
  onEditTodo,
  onEditSchedule,
  onAcceptSchedule,
}: {
  messages: Message[];
  summary: AiSummary | null;
  draft: string;
  chatDone: boolean;
  isSending: boolean;
  isSummarizing: boolean;
  onDraft: (value: string) => void;
  onSend: () => Promise<void>;
  onFinish: () => Promise<void>;
  onSave: () => void;
  onBack: () => void;
  onEditMemo: () => void;
  onEditTodo: () => void;
  onEditSchedule: (index: number) => void;
  onAcceptSchedule: (index: number, accepted: boolean) => void;
}) {
  if (chatDone && summary) {
    return (
      <div className="page-stack">
        <header className="page-header result-header">
          <button type="button" className="back-button" onClick={onBack} aria-label="뒤로가기">
            <Icon name="chevron-left" />
          </button>
          <div className="result-header-title">
            <Icon name="sparkle" />
            <h1>오늘의 기록이 완성됐어요</h1>
          </div>
          <p>AI가 대화를 바탕으로 작성했어요. 확인하고 저장해주세요.</p>
        </header>

        <ResultCard title={summary.memo.title} onEdit={onEditMemo}>
          <p>{summary.memo.body}</p>
        </ResultCard>

        {summary.todos.length > 0 && (
          <ResultCard title="To-do 정리" onEdit={onEditTodo}>
            <ul className="readonly-todos">
              {summary.todos.map((todo) => (
                <li key={todo}>
                  <Icon name="checkbox" size={18} />
                  {todo}
                </li>
              ))}
            </ul>
          </ResultCard>
        )}

        {summary.schedules.map((schedule, index) => (
          <ResultCard
            key={`${schedule.title}-${index}`}
            title="일정 등록 제안"
            onEdit={() => onEditSchedule(index)}
          >
            <div className="suggestion-card">
              <strong>{schedule.title}</strong>
              <small>
                {formatKoreanDate(schedule.date)}
                {formatScheduleTimeLabel(schedule.startTime, schedule.isAllDay)}
              </small>
              <p>
                {schedule.accepted === false
                  ? "이 일정은 무시됩니다."
                  : "이 일정을 캘린더에 등록할까요?"}
              </p>
              <div className="suggestion-actions">
                <button
                  type="button"
                  className={schedule.accepted === false ? "active" : ""}
                  onClick={() => onAcceptSchedule(index, false)}
                >
                  무시
                </button>
                <button
                  type="button"
                  className={schedule.accepted !== false ? "active" : ""}
                  onClick={() => onAcceptSchedule(index, true)}
                >
                  등록
                </button>
              </div>
            </div>
          </ResultCard>
        ))}

        <button className="primary-action bottom-space" onClick={onSave}>
          저장하고 완료
        </button>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <header className="page-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="뒤로가기">
          <Icon name="chevron-left" />
        </button>
        <h1>대화</h1>
        <p>편하게 대화하시면 메모, 일정 등을 AI가 정리해드려요</p>
      </header>

      <section className="message-list">
        {messages.map((message) => (
          <div key={message.id} className={`message-row ${message.from}`}>
            {message.from === "ai" && <span className="ai-avatar"><LogoMark compact /></span>}
            <p>{message.text}</p>
          </div>
        ))}

        {isSending && (
          <div className="message-row ai">
            <span className="ai-avatar"><LogoMark compact /></span>
            <p>하루 요정이 답변을 쓰고 있어요...</p>
          </div>
        )}
      </section>

      <button
        className="finish-chat-button"
        onClick={onFinish}
        disabled={isSending || isSummarizing}
      >
        {isSummarizing ? "AI가 정리하는 중..." : "대화 마치고 정리하기"}
      </button>

      <div className="chat-input-bar">
        <input
          value={draft}
          placeholder="답장을 입력하세요"
          disabled={isSending}
          onChange={(event) => onDraft(event.target.value)}
        />
        <button disabled={!draft.trim() || isSending} onClick={onSend} aria-label="메시지 전송">
          <Icon name="send" />
        </button>
      </div>
    </div>
  );
}

function RecordsScreen({
  mode,
  memos,
  todos,
  onMode,
  onToggleTodo,
  onMemoWrite,
  onTodoWrite,
  onMemoDetail,
  onDeleteMemo,
  onEditTodo,
  onDeleteTodo,
}: {
  mode: RecordMode;
  memos: Memo[];
  todos: Todo[];
  onMode: (mode: RecordMode) => void;
  onToggleTodo: (id: string) => void;
  onMemoWrite: () => void;
  onTodoWrite: () => void;
  onMemoDetail: (memo: Memo) => void;
  onDeleteMemo: (memo: Memo) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todoId: string) => void;
}) {
  const memoGroups = groupMemosByDate(memos);
  const todoGroups = groupTodosByDate(todos);

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>기록</h1>
      </header>

      <div className="segmented-control">
        <button className={mode === "memo" ? "active" : ""} onClick={() => onMode("memo")}>
          메모
        </button>
        <button className={mode === "todo" ? "active" : ""} onClick={() => onMode("todo")}>
          To-do
        </button>
      </div>

      {mode === "memo" ? (
        <section className="record-list">
          {memoGroups.length === 0 ? (
            <EmptyState text="등록된 메모가 없습니다" />
          ) : (
            memoGroups.map((group) => (
              <div key={group.date} className="record-date-group">
                <p className="date-heading">{formatKoreanDate(group.date)}</p>
                {group.items.map((memo) => (
                  <article key={memo.id} className="memo-card">
                    <button onClick={() => onMemoDetail(memo)}>
                      <strong>{memo.title}</strong>
                      <p>{memo.body}</p>
                    </button>
                    <div className="memo-card-actions">
                      <button
                        className="more-button"
                        onClick={() => onMemoDetail(memo)}
                        aria-label="메모 상세 보기"
                      >
                        <Icon name="chevron-right" />
                      </button>
                      <button
                        className="more-button"
                        onClick={() => onDeleteMemo(memo)}
                        aria-label="메모 삭제"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="record-todo">
          {todoGroups.length === 0 ? (
            <EmptyState text="등록된 To-do가 없습니다" />
          ) : (
            todoGroups.map((group) => (
              <div key={group.date} className="record-date-group todo-date-box">
                <div className="card-title-row">
                  <h2>{formatKoreanDate(group.date)}</h2>
                  <span>
                    {group.items.filter((todo) => todo.done).length}/{group.items.length} 완료
                  </span>
                </div>
                <TodoList
                  todos={group.items}
                  onToggle={onToggleTodo}
                  onEdit={onEditTodo}
                  onDelete={onDeleteTodo}
                  emptyText="등록된 To-do가 없습니다"
                />
              </div>
            ))
          )}
        </section>
      )}
      <button
        className="floating-plus"
        onClick={mode === "memo" ? onMemoWrite : onTodoWrite}
        aria-label={mode === "memo" ? "메모 작성" : "To-do 작성"}
      >
        <Icon name="plus" />
        <small>추가</small>
      </button>
    </div>
  );
}

function MyScreen({
  userName,
  isLoggedIn,
  error,
  onKakaoLogin,
  onEmailLogin,
  onEmailSignUp,
  onLogout,
}: {
  userName: string;
  isLoggedIn: boolean;
  error: string | null;
  onKakaoLogin: () => void;
  onEmailLogin: (id: string, password: string) => Promise<void>;
  onEmailSignUp: (input: {
    id: string;
    nickname: string;
    password: string;
  }) => Promise<void>;
  onLogout: () => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!userId.trim() || !password.trim()) {
      setFormError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    if (userId.trim().includes("@")) {
      setFormError("이메일이 아니라 아이디만 입력해 주세요.");
      return;
    }

    if (authMode === "signup" && !/^\d{4}$/.test(password.trim())) {
      setFormError("비밀번호는 숫자 4자리로 입력해 주세요.");
      return;
    }

    if (authMode === "login" && password.trim().length < 4) {
      setFormError("비밀번호를 입력해 주세요.");
      return;
    }

    if (authMode === "signup" && !nickname.trim()) {
      setFormError("닉네임을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === "login") {
        await onEmailLogin(userId, password);
      } else {
        await onEmailSignUp({
          id: userId,
          nickname,
          password,
        });
      }
    } catch {
      // parent sets appError
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="auth-gate">
        {(error || formError) && (
          <p className="status-copy error">{formError || error}</p>
        )}
        <section className="my-card auth-card">
          <div className="auth-logo">
            <LogoMark />
          </div>
          <h1>하루 요정 시작하기</h1>
          <p>
            {authMode === "login"
              ? "카카오 또는 아이디로 로그인할 수 있어요."
              : "아이디·닉네임·숫자 4자리 비밀번호로 가입해요."}
          </p>

          <div className="auth-mode-tabs">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              로그인
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "active" : ""}
              onClick={() => setAuthMode("signup")}
            >
              회원가입
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>아이디</span>
              <input
                type="text"
                inputMode="text"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="사용할 아이디 (이메일 아님)"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            {authMode === "signup" && (
              <label className="auth-field">
                <span>닉네임</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="사용할 닉네임"
                  autoComplete="nickname"
                />
              </label>
            )}
            <label className="auth-field">
              <span>비밀번호</span>
              <div className="auth-password-row">
                <input
                  type={showPassword ? "text" : "password"}
                  inputMode={authMode === "signup" ? "numeric" : "text"}
                  pattern={authMode === "signup" ? "[0-9]*" : undefined}
                  maxLength={authMode === "signup" ? 4 : undefined}
                  value={password}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPassword(
                      authMode === "signup"
                        ? next.replace(/\D/g, "").slice(0, 4)
                        : next,
                    );
                  }}
                  placeholder={
                    authMode === "signup" ? "숫자 4자리" : "비밀번호 입력"
                  }
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "숨김" : "보기"}
                </button>
              </div>
              {authMode === "signup" && (
                <small>숫자 4자리로 입력해 주세요</small>
              )}
            </label>
            <button
              className="primary-action full"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "처리 중..."
                : authMode === "login"
                  ? "로그인"
                  : "가입하기"}
            </button>
          </form>

          <div className="auth-divider">
            <span>또는</span>
          </div>

          <button className="kakao-action" onClick={onKakaoLogin}>
            <Icon name="kakao" />
            카카오로 시작하기
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>마이</h1>
      </header>

      {error && <p className="status-copy error">{error}</p>}

      <section className="my-card">
        <div className="profile-summary">
          <div className="profile-orb fairy"><LogoMark compact /></div>
          <div>
            <h2>{userName}님 안녕하세요.</h2>
            <p>오늘도 하루 요정과 함께해요.</p>
          </div>
        </div>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLScmNvKEFQuF5Nwt0e5gpu22BnR7clz_DgQgpDzdWhL_B41YPw/viewform"
          target="_blank"
          rel="noreferrer"
          className="primary-action"
        >
          리뷰 남기기
        </a>
        <button className="secondary-action" onClick={onLogout}>
          로그아웃
        </button>
      </section>
    </div>
  );
}

function WeekHeader() {
  return (
    <div className="week-header">
      {weekdays.map((weekday) => (
        <span key={weekday}>{weekday}</span>
      ))}
    </div>
  );
}

function CalendarGrid({
  cells,
  mini = false,
}: {
  cells: Array<{
    id: string;
    day: number;
    muted: boolean;
    today: boolean;
    selected: boolean;
    scheduleColors: string[];
  }>;
  mini?: boolean;
}) {
  return (
    <div className={`calendar-grid ${mini ? "mini" : ""}`}>
      {cells.map((cell) => (
        <span
          key={cell.id}
          className={[
            "calendar-cell",
            cell.muted ? "muted" : "",
            cell.today ? "today" : "",
            cell.selected ? "selected" : "",
          ].join(" ")}
        >
          <span>{cell.day}</span>
          {cell.scheduleColors.length > 0 && (
            <span className="calendar-dot-row">
              {cell.scheduleColors.slice(0, 3).map((color) => (
                <CalendarDot key={`${cell.id}-${color}`} color={color} />
              ))}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function SwipeScheduleRow({
  schedule,
  onEdit,
  onDelete,
}: {
  schedule: Schedule;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const ignoreClick = useRef(false);

  function resetSwipe() {
    setOffset(0);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // 마우스(노트북)는 스와이프 제스처를 쓰지 않고 클릭 수정만 사용
    if (event.pointerType === "mouse") {
      return;
    }
    dragging.current = true;
    moved.current = false;
    startX.current = event.clientX;
    startOffset.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) {
      return;
    }
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 8) {
      moved.current = true;
    }
    const next = Math.min(0, Math.max(-88, startOffset.current + delta));
    setOffset(next);
  }

  function onPointerUp() {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    if (moved.current) {
      ignoreClick.current = true;
      setOffset((current) => (current < -44 ? -88 : 0));
      window.setTimeout(() => {
        ignoreClick.current = false;
      }, 0);
      return;
    }
    resetSwipe();
  }

  function openEdit() {
    if (ignoreClick.current || offset < -20) {
      resetSwipe();
      return;
    }
    onEdit(schedule);
  }

  return (
    <div className="swipe-schedule-row">
      <button
        type="button"
        className="swipe-delete-action"
        aria-label="일정 삭제"
        onClick={() => onDelete(schedule)}
      >
        삭제
      </button>
      <div
        className="swipe-schedule-front"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button type="button" className="schedule-card" onClick={openEdit}>
          <ScheduleBar color={schedule.color} />
          <strong>{schedule.time.replace("오늘 ", "")}</strong>
          <em>{schedule.title}</em>
          <span
            className="schedule-edit-button"
            aria-hidden="true"
          >
            <Icon name="pencil" />
          </span>
        </button>
      </div>
    </div>
  );
}

function ScheduleLine({ schedule }: { schedule: Schedule }) {
  return (
    <div className="schedule-line">
      <ScheduleBar color={schedule.color} />
      <div>
        <strong>{schedule.title}</strong>
        <small>{schedule.time}</small>
      </div>
    </div>
  );
}

function TodoList({
  todos,
  onToggle,
  onEdit,
  onDelete,
  emptyText = "등록된 항목이 없습니다",
}: {
  todos: Todo[];
  onToggle: (id: string) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
  emptyText?: string;
}) {
  if (todos.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="todo-list">
      {todos.map((todo) => (
        <div key={todo.id} className="todo-row-wrap">
          <button
            type="button"
            className="todo-check-button"
            aria-label={todo.done ? "완료 취소" : "완료 처리"}
            onClick={() => onToggle(todo.id)}
          >
            {todo.done ? (
              <Icon name="check" size={22} />
            ) : (
              <Icon name="checkbox" size={22} />
            )}
          </button>
          <button
            type="button"
            className="todo-row"
            onClick={() => onEdit?.(todo)}
          >
            <em className={todo.done ? "done" : ""}>{todo.text}</em>
          </button>
          {onEdit && (
            <button
              type="button"
              className="todo-edit-button"
              aria-label="할 일 수정"
              onClick={() => onEdit(todo)}
            >
              <Icon name="pencil" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="todo-delete-button"
              aria-label="할 일 삭제"
              onClick={() => onDelete(todo.id)}
            >
              <Icon name="trash" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ResultCard({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <section className="result-card">
      <div>
        <h2>{title}</h2>
        <button className="edit-icon-button" onClick={onEdit} aria-label="수정">
          <Icon name="pencil" />
        </button>
      </div>
      {children}
    </section>
  );
}

function BottomNav({
  activeTab,
  onTab,
}: {
  activeTab: Tab;
  onTab: (tab: Tab) => void;
}) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isCenter = item.tab === "chat";
        const isActive = activeTab === item.tab;

        return (
          <button
            key={item.tab}
            className={`${isActive ? "active" : ""} ${isCenter ? "center" : ""}`}
            onClick={() => onTab(item.tab)}
          >
            <span className={isCenter ? "nav-fab" : "nav-icon"}>
              <Icon
                name={isCenter ? "chat-fab" : item.icon}
                active={isActive}
                size={isCenter ? 70 : 28}
              />
            </span>
            {item.label && <small>{item.label}</small>}
          </button>
        );
      })}
    </nav>
  );
}

function ScheduleModal({
  title,
  submitLabel,
  compact = false,
  defaultDate,
  initial,
  onClose,
  onSubmit,
  onDelete,
}: {
  title: string;
  submitLabel: string;
  compact?: boolean;
  defaultDate: string;
  initial?: ScheduleFormPayload;
  onClose: (dirty: boolean) => void;
  onSubmit: (payload: ScheduleFormPayload) => Promise<void>;
  onDelete?: () => void;
}) {
  const [startDate, setStartDate] = useState(initial?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(initial?.endDate ?? initial?.date ?? defaultDate);
  const [repeatDays, setRepeatDays] = useState<string[]>(initial?.repeatDays ?? []);
  const [isAllDay, setIsAllDay] = useState(initial?.isAllDay ?? true);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "10:00");
  const [dirty, setDirty] = useState(false);

  function toggleDay(day: string) {
    setDirty(true);
    setRepeatDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const titleValue = String(formData.get("title") ?? "").trim();
    const colorValue = String(formData.get("color") ?? scheduleColorChips[0].value);

    if (!titleValue) {
      return;
    }

    const normalizedEndDate = endDate < startDate ? startDate : endDate;

    void onSubmit({
      title: titleValue,
      date: startDate,
      endDate: normalizedEndDate,
      color: colorValue,
      isAllDay,
      startTime: isAllDay ? null : startTime,
      endTime: isAllDay ? null : endTime,
      repeatDays,
    });
  }

  return (
    <ModalShell>
      <form onSubmit={handleSubmit} onChange={() => setDirty(true)}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            onClick={() => onClose(dirty)}
            aria-label="닫기"
          >
            <Icon name="close" />
          </button>
        </div>
        <label className="field-label">제목*</label>
        <input
          className="field-input"
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder="일정 제목"
          maxLength={30}
          required
        />
        <div className="date-field-grid">
          <label className="field-box date-picker-field">
            <small>시작일({getWeekdayForDateKey(startDate)})</small>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setDirty(true);
                const next = event.target.value;
                setStartDate(next);
                if (endDate < next) {
                  setEndDate(next);
                }
              }}
            />
          </label>
          <label className="field-box date-picker-field">
            <small>종료일({getWeekdayForDateKey(endDate)})</small>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => {
                setDirty(true);
                setEndDate(event.target.value);
              }}
            />
          </label>
        </div>
        {!compact && (
          <>
            <p className="field-label">반복 요일*</p>
            <div className="weekday-pills">
              {weekdays.map((day) => (
                <button
                  type="button"
                  key={day}
                  className={repeatDays.includes(day) ? "active" : ""}
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="field-help">
              시작일~종료일 범위에서 선택한 요일마다 일정이 생성돼요. 요일을 고르지 않으면 범위의 모든 날짜에 등록돼요.
            </p>
          </>
        )}
        <div className="toggle-row">
          <div>
            <strong>시간 설정*</strong>
            <small>
              {isAllDay
                ? "하루 종일 일정으로 등록돼요."
                : "시작 시간과 종료 시간을 선택해주세요."}
            </small>
          </div>
          <button
            type="button"
            className={`time-toggle ${isAllDay ? "" : "on"}`}
            onClick={() => {
              setDirty(true);
              setIsAllDay((current) => !current);
            }}
            aria-label="시간 설정 토글"
          >
            <i />
          </button>
        </div>
        {!isAllDay && (
          <div className="time-field-grid">
            <label className="field-box date-picker-field">
              <small>시작 시간</small>
              <input
                type="time"
                value={startTime ?? "09:00"}
                onChange={(event) => {
                  setDirty(true);
                  setStartTime(event.target.value);
                }}
              />
            </label>
            <label className="field-box date-picker-field">
              <small>종료 시간</small>
              <input
                type="time"
                value={endTime ?? "10:00"}
                onChange={(event) => {
                  setDirty(true);
                  setEndTime(event.target.value);
                }}
              />
            </label>
          </div>
        )}
        <p className="field-label">색상*</p>
        <div className="color-dots">
          {scheduleColorChips.map((chip, index) => (
            <ColorChip
              key={chip.value}
              value={chip.value}
              asset={chip.asset}
              defaultChecked={
                initial?.color ? initial.color === chip.value : index === 0
              }
            />
          ))}
        </div>
        <button className="primary-action full" type="submit">
          {submitLabel}
        </button>
        {onDelete && (
          <button
            type="button"
            className="secondary-action full"
            onClick={onDelete}
          >
            일정 삭제
          </button>
        )}
      </form>
    </ModalShell>
  );
}

function EditorModal({
  kind,
  title,
  manual = false,
  summary,
  initialMemo,
  initialTodos,
  initialDate,
  onClose,
  onSave,
  onDelete,
}: {
  kind: "memo" | "todo";
  title: string;
  manual?: boolean;
  summary?: AiSummary | null;
  initialMemo?: Memo | null;
  initialTodos?: string[];
  initialDate?: string;
  onClose: (dirty: boolean) => void;
  onSave: (payload: EditorSavePayload) => Promise<void>;
  onDelete?: () => void;
}) {
  const seedMemo = initialMemo ?? (manual ? null : summary?.memo ?? null);
  const seedTodos =
    initialTodos && initialTodos.length > 0
      ? initialTodos
      : manual
        ? [""]
        : summary?.todos.length
          ? summary.todos
          : [""];
  const [dateValue, setDateValue] = useState(
    initialDate ?? initialMemo?.date ?? today.dateKey,
  );
  const [todoItems, setTodoItems] = useState(seedTodos);
  const [dirty, setDirty] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (kind === "memo") {
      const titleValue = String(formData.get("title") ?? "").trim();
      const bodyValue = String(formData.get("body") ?? "").trim();

      // 제목만 입력해도 저장되도록 (검증 재현: 제목 입력 → 저장)
      if (!titleValue && !bodyValue) {
        return;
      }

      void onSave({
        kind: "memo",
        date: dateValue,
        title: titleValue || bodyValue.slice(0, 10),
        body: bodyValue || titleValue,
      });
      return;
    }

    const todos = todoItems.map((value) => value.trim()).filter(Boolean);

    if (todos.length === 0) {
      return;
    }

    void onSave({
      kind: "todo",
      date: dateValue,
      todos,
    });
  }

  return (
    <ModalShell>
      <form onSubmit={handleSubmit}>
        <div className="edit-topbar">
          <button type="button" onClick={() => onClose(dirty)}>취소</button>
          <strong>{title}</strong>
          <button type="submit">저장</button>
        </div>
        <label className="date-chip date-picker-field">
          <input
            type="date"
            value={dateValue}
            onChange={(event) => {
              setDirty(true);
              setDateValue(event.target.value);
            }}
          />
        </label>
        {kind === "memo" ? (
          <div className="editor-body" onChange={() => setDirty(true)}>
            <input
              name="title"
              defaultValue={seedMemo?.title ?? ""}
              placeholder="제목"
            />
            <textarea
              name="body"
              defaultValue={seedMemo?.body ?? ""}
              placeholder="내용을 입력하세요."
              rows={8}
            />
          </div>
        ) : (
          <div className="todo-editor">
            {todoItems.map((todo, index) => (
              <div key={`todo-edit-${index}`}>
                <Icon name="checkbox" size={20} />
                <input
                  value={todo}
                  placeholder="할 일을 입력하세요."
                  onChange={(event) => {
                    setDirty(true);
                    const next = [...todoItems];
                    next[index] = event.target.value;
                    setTodoItems(next);
                  }}
                />
                <button
                  type="button"
                  aria-label="할 일 삭제"
                  onClick={() => {
                    setDirty(true);
                    setTodoItems((current) =>
                      current.length === 1
                        ? [""]
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    );
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ghost-add-button"
              onClick={() => {
                setDirty(true);
                setTodoItems((current) => [...current, ""]);
              }}
            >
              + 할 일 추가
            </button>
          </div>
        )}
        {onDelete && (
          <button type="button" className="secondary-action full" onClick={onDelete}>
            삭제
          </button>
        )}
      </form>
    </ModalShell>
  );
}

function ConfirmModal({
  title = "작성을 취소하시겠습니까?",
  description = "변경한 내용은 저장되지 않아요.",
  onCancel,
  onConfirm,
}: {
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <SimpleModal
      icon="!"
      title={title}
      description={description}
      actionLabel="예"
      secondaryLabel="아니오"
      onAction={onConfirm}
      onSecondary={onCancel}
    />
  );
}

function SimpleModal({
  icon,
  title,
  description,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  secondaryLabel?: string;
  onAction: () => void;
  onSecondary?: () => void;
}) {
  return (
    <ModalShell small>
      <div className="simple-modal">
        <div>
          <Icon name={icon === "!" ? "alert" : "check"} />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <button className="primary-action full" onClick={onAction}>{actionLabel}</button>
        {secondaryLabel && (
          <button className="secondary-action full" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  small = false,
}: {
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <section className={`modal-panel ${small ? "small" : ""}`}>
        {children}
      </section>
    </div>
  );
}

function FieldBox({ label, value }: { label: string; value: string }) {
  return (
    <button className="field-box">
      <small>{label}</small>
      <strong>{value}</strong>
    </button>
  );
}

function getTodayInfo() {
  const date = new Date();
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  const monthName = `${monthIndex + 1}월`;

  return {
    year,
    monthIndex,
    day,
    dateKey: formatDateKey(year, monthIndex, day),
    dateLabel: `${monthName} ${day}일 ${weekday}요일`,
    shortDate: `${monthIndex + 1}.${day}`,
    weekday,
    monthName,
    monthTitle: `${year}년 ${monthName}`,
  };
}

function buildMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  const previousLastDate = new Date(year, monthIndex, 0).getDate();
  const cells: Array<{ day: number; dateKey: string; muted: boolean }> = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    const day = previousLastDate - index;
    cells.push({
      day,
      dateKey: formatDateKey(year, monthIndex - 1, day),
      muted: true,
    });
  }

  for (let day = 1; day <= lastDate; day += 1) {
    cells.push({
      day,
      dateKey: formatDateKey(year, monthIndex, day),
      muted: false,
    });
  }

  const nextMonthDayCount = Math.ceil(cells.length / 7) * 7 - cells.length;
  for (let day = 1; day <= nextMonthDayCount; day += 1) {
    cells.push({
      day,
      dateKey: formatDateKey(year, monthIndex + 1, day),
      muted: true,
    });
  }

  return cells;
}

function formatDateKey(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${dateDay}`;
}

function buildScheduleDates(
  startDate: string,
  endDate: string,
  repeatDays: string[],
) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const weekday = weekdays[cursor.getDay()];
    const dateKey = formatDateKey(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
    );

    if (repeatDays.length === 0 || repeatDays.includes(weekday)) {
      dates.push(dateKey);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates.length > 0 ? dates : [startDate];
}

function normalizeTimeValue(value: string | null | undefined) {
  if (!value || value === "종일" || value === "시간 미정") {
    return "09:00";
  }
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return "09:00";
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function getWeekdayForDateKey(dateKey: string) {
  return weekdays[new Date(`${dateKey}T00:00:00`).getDay()];
}

function groupMemosByDate(memos: Memo[]) {
  return memos.reduce<Array<{ date: string; items: Memo[] }>>((groups, memo) => {
    const group = groups.find((item) => item.date === memo.date);
    if (group) {
      group.items.push(memo);
      return groups;
    }

    return [...groups, { date: memo.date, items: [memo] }];
  }, []);
}

function groupTodosByDate(todos: Todo[]) {
  return todos.reduce<Array<{ date: string; items: Todo[] }>>((groups, todo) => {
    const group = groups.find((item) => item.date === todo.date);
    if (group) {
      group.items.push(todo);
      return groups;
    }

    return [...groups, { date: todo.date, items: [todo] }];
  }, []);
}

function formatKoreanDate(date: string) {
  const separator = date.includes(".") ? "." : "-";
  const [year, month, day] = date.split(separator);
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "일시적인 오류가 발생했어요. 다시 시도해주세요.";
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (lower.includes("password") && (lower.includes("6") || lower.includes("least"))) {
    return "비밀번호는 숫자 4자리로 입력해 주세요.";
  }
  if (
    lower.includes("email") ||
    lower.includes("invalid login") ||
    lower.includes("invalid credentials")
  ) {
    return "아이디 또는 비밀번호를 확인해 주세요.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "이미 사용 중인 아이디예요.";
  }

  return getErrorMessage(error);
}

function formatScheduleTimeLabel(
  startTime: string | null | undefined,
  isAllDay?: boolean,
) {
  if (isAllDay || !startTime || startTime.toLowerCase() === "null") {
    return " 종일";
  }
  return ` ${startTime}`;
}

function getProfileFromSession(session: Session | null): AppProfile {
  const metadata = session?.user.user_metadata ?? {};
  const nickname =
    cleanNickname(readMetadataText(metadata, "name")) ??
    cleanNickname(readMetadataText(metadata, "nickname")) ??
    cleanNickname(readMetadataText(metadata, "full_name")) ??
    cleanNickname(readMetadataText(metadata, "preferred_username")) ??
    getEmailName(session?.user.email) ??
    "사용자";

  return {
    nickname,
    avatarUrl:
      readMetadataText(metadata, "avatar_url") ??
      readMetadataText(metadata, "picture") ??
      null,
  };
}

function normalizeProfile(profile: AppProfile | null, authProfile: AppProfile) {
  return {
    nickname: cleanNickname(profile?.nickname) ?? authProfile.nickname,
    avatarUrl: profile?.avatarUrl ?? authProfile.avatarUrl,
  };
}

function cleanNickname(value?: string | null) {
  const nickname = value?.trim();
  if (!nickname || nickname === "지원") {
    return null;
  }

  return nickname;
}

function getProviderFromSession(session: Session) {
  return typeof session.user.app_metadata.provider === "string"
    ? session.user.app_metadata.provider
    : "kakao";
}

function isKakaoProvider(session: Session, provider: string) {
  if (provider.toLowerCase() === "kakao") {
    return true;
  }
  return (session.user.identities ?? []).some(
    (identity) => identity.provider?.toLowerCase() === "kakao",
  );
}

function readMetadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getEmailName(email?: string | null) {
  return email?.split("@")[0] || null;
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      className={compact ? "logo-mark compact" : "logo-mark"}
      src="/logo.png"
      alt="하루 요정 로고"
      width={compact ? 34 : 54}
      height={compact ? 34 : 54}
      priority={!compact}
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}
