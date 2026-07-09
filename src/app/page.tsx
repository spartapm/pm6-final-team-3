"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  createChatSummary,
  createMemo,
  createSchedule,
  createTodo,
  loadAppData,
  updateTodoCompleted,
  upsertProfile,
  type AppMemo,
  type AppProfile,
  type AppSchedule,
  type AppTodo,
} from "@/lib/haru-store";
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
  | "manualMemo"
  | "manualTodo"
  | "saved"
  | "cancel";

type Todo = AppTodo;
type Schedule = AppSchedule;
type Memo = AppMemo;

type Message = {
  id: number;
  from: "user" | "ai";
  text: string;
};
type AiSummary = {
  memo: {
    title: string;
    body: string;
  };
  todos: string[];
  schedule: {
    title: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    isAllDay: boolean;
    color: string;
  } | null;
};
type ScheduleFormPayload = {
  title: string;
  date: string;
  color: string;
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
const monthDays = buildMonthDays(today.year, today.monthIndex);

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
  const [activeTab, setActiveTab] = useState<Tab>("my");
  const [recordMode, setRecordMode] = useState<RecordMode>("memo");
  const [chatDone, setChatDone] = useState(false);
  const [modal, setModal] = useState<ModalType | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState(today.day);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const todaysTodos = todos.filter((todo) => todo.date === today.dateKey);
  const todaysSchedules = schedules.filter(
    (schedule) => schedule.date === today.dateKey,
  );
  const completedCount = todaysTodos.filter((todo) => todo.done).length;
  const totalCompletedCount = todos.filter((todo) => todo.done).length;
  const selectedDateKey = formatDateKey(today.year, today.monthIndex, selectedDate);
  const selectedSchedules = schedules.filter(
    (schedule) => schedule.date === selectedDateKey,
  );
  const selectedWeekday = getWeekdayForDateKey(selectedDateKey);

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
        void applySession(data.session, { shouldGoHome: Boolean(data.session) });
      }
    }

    void syncInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        void applySession(session, {
          shouldGoHome: event === "SIGNED_IN" || event === "TOKEN_REFRESHED",
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
      setMemos([]);
      setTodos([]);
      setSchedules([]);
      setActiveTab("my");
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);

    try {
      const authProfile = getProfileFromSession(nextSession);
      await upsertProfile({
        userId: nextSession.user.id,
        nickname: authProfile.nickname,
        avatarUrl: authProfile.avatarUrl,
        provider: getProviderFromSession(nextSession),
      });
      const data = await loadAppData(nextSession.user.id);
      setProfile(normalizeProfile(data.profile, authProfile));
      setMemos(data.memos);
      setTodos(data.todos);
      setSchedules(data.schedules);
      if (options.shouldGoHome) {
        setActiveTab("home");
      }
    } catch (error) {
      setAppError(getErrorMessage(error));
    } finally {
      setIsLoadingData(false);
    }
  }

  const calendarCells = useMemo(() => {
    const scheduledDates = new Set(schedules.map((schedule) => schedule.date));

    return monthDays.map((cell) => ({
      id: cell.dateKey,
      day: cell.day,
      muted: cell.muted,
      today: cell.dateKey === today.dateKey,
      selected: cell.dateKey === selectedDateKey,
      hasSchedule: scheduledDates.has(cell.dateKey),
    }));
  }, [schedules, selectedDateKey]);

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

    if (!requireUserId()) {
      return;
    }

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
    if (!requireUserId()) {
      return;
    }

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
    if (!userId || !summary) {
      return;
    }

    try {
      const [memo, createdTodos, schedule] = await Promise.all([
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
        summary.schedule
          ? createSchedule({
              userId,
              date: summary.schedule.date,
              title: summary.schedule.title,
              startTime: summary.schedule.startTime,
              endTime: summary.schedule.endTime,
              isAllDay: summary.schedule.isAllDay,
              color: summary.schedule.color,
              source: "ai",
            })
          : Promise.resolve(null),
      ]);

      await createChatSummary({
        userId,
        conversation: messages,
        memoTitle: summary.memo.title,
        memoBody: summary.memo.body,
        todos: summary.todos,
        scheduleSuggestions: summary.schedule ? [summary.schedule] : [],
      });

      setMemos((current) => [memo, ...current]);
      setTodos((current) => [...createdTodos, ...current]);
      if (schedule) {
        setSchedules((current) => [schedule, ...current]);
      }
      setModal("saved");
    } catch (error) {
      setAppError(getErrorMessage(error));
    }
  }

  function closeModal() {
    setModal(null);
  }

  function requireUserId() {
    if (!session) {
      setActiveTab("my");
      setModal(null);
      setAppError("로그인 후 이용할 수 있어요.");
      return null;
    }

    return session.user.id;
  }

  async function signInWithKakao() {
    const redirectTo = window.location.origin;

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

  async function signOut() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setActiveTab("my");
  }

  return (
    <main>
      <section className="screen-shell">
        <div className={`screen-scroll ${session ? "" : "auth-only"}`}>
          {activeTab === "home" && (
            <HomeScreen
              userName={profile?.nickname ?? getProfileFromSession(session).nickname}
              isLoading={isLoadingData}
              error={appError}
              todos={todaysTodos}
              schedules={todaysSchedules}
              completedCount={completedCount}
              calendarCells={calendarCells}
              onChat={() => setActiveTab("chat")}
              onCalendar={() => setActiveTab("calendar")}
              onTodos={() => {
                setRecordMode("todo");
                setActiveTab("records");
              }}
              onToggleTodo={toggleTodo}
              onAddTodo={() => setModal("manualTodo")}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarScreen
              monthTitle={today.monthTitle}
              monthName={today.monthName}
              calendarCells={calendarCells}
              schedules={selectedSchedules}
              selectedDate={selectedDate}
              selectedWeekday={selectedWeekday}
              onSelectDate={setSelectedDate}
              onCreate={() => setModal("scheduleCreate")}
              onEdit={() => setModal("scheduleEdit")}
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
              onEditMemo={() => setModal("memoEdit")}
              onEditTodo={() => setModal("todoEdit")}
              onEditSchedule={() => setModal("scheduleEdit")}
            />
          )}

          {activeTab === "records" && (
            <RecordsScreen
              mode={recordMode}
              memos={memos}
              todos={todos}
              completedCount={totalCompletedCount}
              onMode={setRecordMode}
              onToggleTodo={toggleTodo}
              onMemoWrite={() => setModal("manualMemo")}
              onTodoWrite={() => setModal("manualTodo")}
              onMemoDetail={() => setModal("memoEdit")}
            />
          )}

          {activeTab === "my" && (
            <MyScreen
              userName={profile?.nickname ?? getProfileFromSession(session).nickname}
              isLoggedIn={isLoggedIn}
              error={appError}
              onLogin={signInWithKakao}
              onLogout={signOut}
            />
          )}
        </div>
        {session && <BottomNav activeTab={activeTab} onTab={setActiveTab} />}
      </section>

      {modal === "scheduleCreate" && (
        <ScheduleModal
          title="새 일정"
          submitLabel="일정 추가"
          onClose={() => setModal("cancel")}
          onSubmit={async (payload) => {
            const userId = requireUserId();
            if (!userId) {
              return;
            }

            try {
              const schedule = await createSchedule({
                userId,
                date: payload.date,
                title: payload.title,
                isAllDay: true,
                color: payload.color,
              });
              setSchedules((current) => [schedule, ...current]);
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
          compact
          onClose={() => setModal("cancel")}
          onSubmit={async () => closeModal()}
        />
      )}

      {modal === "memoEdit" && (
        <EditorModal
          kind="memo"
          title="메모"
          summary={summary}
          onClose={() => setModal("cancel")}
          onSave={async () => closeModal()}
        />
      )}

      {modal === "todoEdit" && (
        <EditorModal
          kind="todo"
          title="할 일"
          summary={summary}
          onClose={() => setModal("cancel")}
          onSave={async () => closeModal()}
        />
      )}

      {modal === "manualMemo" && (
        <EditorModal
          kind="memo"
          title="메모 작성"
          manual
          onClose={() => setModal("cancel")}
          onSave={async (payload) => {
            const userId = requireUserId();
            if (!userId || payload.kind !== "memo") {
              return;
            }

            try {
              const memo = await createMemo({
                userId,
                date: payload.date,
                title: payload.title,
                body: payload.body,
              });
              setMemos((current) => [memo, ...current]);
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
          title="할 일 작성"
          manual
          onClose={() => setModal("cancel")}
          onSave={async (payload) => {
            const userId = requireUserId();
            if (!userId || payload.kind !== "todo") {
              return;
            }

            try {
              const createdTodos = await Promise.all(
                payload.todos.map((text) =>
                  createTodo({
                    userId,
                    date: payload.date,
                    text,
                  }),
                ),
              );
              setTodos((current) => [...current, ...createdTodos]);
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
            setRecordMode("memo");
            setActiveTab("records");
          }}
        />
      )}

      {modal === "cancel" && (
        <ConfirmModal
          onCancel={closeModal}
          onConfirm={closeModal}
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
    hasSchedule: boolean;
  }>;
  onChat: () => void;
  onCalendar: () => void;
  onTodos: () => void;
  onToggleTodo: (id: string) => void;
  onAddTodo: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="home-header">
        <div>
          <h1>안녕하세요, {userName}님</h1>
          <p>{today.dateLabel}</p>
        </div>
      </header>

      {isLoading && <p className="status-copy">기록을 불러오는 중이에요...</p>}
      {error && <p className="status-copy error">{error}</p>}

      <button className="ai-entry-card" onClick={onChat}>
        <span className="fairy-thumb"><LogoMark /></span>
        <span className="ai-entry-copy">
          <strong>기록하고 싶은 내용이 있나요?</strong>
          <small>AI요정 하루가 정리해드릴게요</small>
        </span>
        <span className="chat-bubble-icon"><Icon name="message" /></span>
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
          <h2>오늘의 할 일</h2>
          <span>{completedCount}/{todos.length} 완료</span>
        </button>
        <TodoList todos={todos} onToggle={onToggleTodo} emptyText="등록된 할 일이 없습니다" />
        <button className="ghost-add-button" onClick={onAddTodo}>
          + 할 일 추가
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
  onSelectDate,
  onCreate,
  onEdit,
}: {
  monthTitle: string;
  monthName: string;
  calendarCells: Array<{
    id: string;
    day: number;
    muted: boolean;
    today: boolean;
    selected: boolean;
    hasSchedule: boolean;
  }>;
  schedules: Schedule[];
  selectedDate: number;
  selectedWeekday: string;
  onSelectDate: (date: number) => void;
  onCreate: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="page-stack">
      <header className="page-header centered">
        <button className="nav-arrow prev" aria-label="이전 월">
          <Icon name="chevron-left" />
        </button>
        <h1>{monthTitle}</h1>
        <button className="nav-arrow" aria-label="다음 월">
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
              onClick={() => onSelectDate(cell.day)}
            >
              <span>{cell.day}</span>
              {cell.hasSchedule && <CalendarDot />}
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
            <button key={schedule.id} className="schedule-card" onClick={onEdit}>
              <ScheduleBar color={schedule.color} />
              <strong>{schedule.time.replace("오늘 ", "")}</strong>
              <em>{schedule.title}</em>
            </button>
          ))
        ) : (
          <EmptyState text="등록된 일정이 없습니다" />
        )}
      </section>

      <button className="floating-plus" onClick={onCreate} aria-label="일정 추가">
        <Icon name="plus" />
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
  onEditMemo,
  onEditTodo,
  onEditSchedule,
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
  onEditMemo: () => void;
  onEditTodo: () => void;
  onEditSchedule: () => void;
}) {
  if (chatDone && summary) {
    return (
      <div className="page-stack">
        <header className="page-header result-header">
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
          <ResultCard title="할 일 정리" onEdit={onEditTodo}>
            <ul className="readonly-todos">
              {summary.todos.map((todo) => (
                <li key={todo}>
                  <Icon name="checkbox" size={22} />
                  {todo}
                </li>
              ))}
            </ul>
          </ResultCard>
        )}

        {summary.schedule && (
          <ResultCard title="일정 등록 제안" onEdit={onEditSchedule}>
            <div className="suggestion-card">
              <strong>{summary.schedule.title}</strong>
              <small>
                {formatKoreanDate(summary.schedule.date)}
                {summary.schedule.startTime ? ` ${summary.schedule.startTime}` : " 종일"}
              </small>
              <p>이 일정을 캘린더에 등록할까요?</p>
            </div>
          </ResultCard>
        )}

        <button className="primary-action bottom-space" onClick={onSave}>
          저장하고 완료
        </button>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <header className="page-header">
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

        {messages.some((message) => message.from === "user") && (
          <div className="extract-card">
            <span>대화에서 메모, 할 일, 일정 후보를 찾고 있어요</span>
            <span>대화를 마치면 정리 결과를 확인할 수 있어요</span>
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
  completedCount,
  onMode,
  onToggleTodo,
  onMemoWrite,
  onTodoWrite,
  onMemoDetail,
}: {
  mode: RecordMode;
  memos: Memo[];
  todos: Todo[];
  completedCount: number;
  onMode: (mode: RecordMode) => void;
  onToggleTodo: (id: string) => void;
  onMemoWrite: () => void;
  onTodoWrite: () => void;
  onMemoDetail: () => void;
}) {
  const memoGroups = groupMemosByDate(memos);

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
          할 일
        </button>
      </div>

      {mode === "memo" ? (
        <section className="record-list">
          {memoGroups.map((group) => (
            <div key={group.date} className="record-date-group">
              <p className="date-heading">{formatKoreanDate(group.date)}</p>
              {group.items.map((memo) => (
                <article key={memo.id} className="memo-card">
                  <button onClick={onMemoDetail}>
                    <strong>{memo.title}</strong>
                    <p>{memo.body}</p>
                  </button>
                  <button className="more-button" onClick={onMemoDetail} aria-label="메모 상세 보기">
                    <Icon name="chevron-right" />
                  </button>
                </article>
              ))}
            </div>
          ))}
          <button className="floating-plus" onClick={onMemoWrite} aria-label="메모 작성">
            <Icon name="plus" />
          </button>
        </section>
      ) : (
        <section className="todo-card record-todo">
          <div className="card-title-row">
            <h2>{today.monthName} {today.day}일 할 일</h2>
            <span>{completedCount}/{todos.length} 완료</span>
          </div>
          <TodoList todos={todos} onToggle={onToggleTodo} emptyText="등록된 할 일이 없습니다" />
          <button className="floating-plus" onClick={onTodoWrite} aria-label="할 일 작성">
            <Icon name="plus" />
          </button>
        </section>
      )}
    </div>
  );
}

function MyScreen({
  userName,
  isLoggedIn,
  error,
  onLogin,
  onLogout,
}: {
  userName: string;
  isLoggedIn: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  if (!isLoggedIn) {
    return (
      <div className="auth-gate">
        {error && <p className="status-copy error">{error}</p>}
        <section className="my-card auth-card">
          <div className="auth-logo">
            <LogoMark />
          </div>
          <h1>하루 요정 시작하기</h1>
          <p>카카오로 로그인하고 오늘의 기록을 안전하게 저장해요.</p>
          <button className="kakao-action" onClick={onLogin}>
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
    hasSchedule: boolean;
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
          {cell.hasSchedule && <CalendarDot />}
        </span>
      ))}
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
  emptyText = "등록된 항목이 없습니다",
}: {
  todos: Todo[];
  onToggle: (id: string) => void;
  emptyText?: string;
}) {
  if (todos.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="todo-list">
      {todos.map((todo) => (
        <button key={todo.id} className="todo-row" onClick={() => onToggle(todo.id)}>
          {todo.done ? (
            <Icon name="check" size={31} />
          ) : (
            <Icon name="checkbox" size={31} />
          )}
          <em className={todo.done ? "done" : ""}>{todo.text}</em>
        </button>
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
      {navItems.map((item) => (
        <button
          key={item.tab}
          className={`${activeTab === item.tab ? "active" : ""} ${item.tab === "chat" ? "center" : ""}`}
          onClick={() => onTab(item.tab)}
        >
          <span><Icon name={item.icon} /></span>
          {item.label && <small>{item.label}</small>}
        </button>
      ))}
    </nav>
  );
}

function ScheduleModal({
  title,
  submitLabel,
  compact = false,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  compact?: boolean;
  onClose: () => void;
  onSubmit: (payload: ScheduleFormPayload) => Promise<void>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const titleValue = String(formData.get("title") ?? "").trim();
    const colorValue = String(formData.get("color") ?? scheduleColorChips[0].value);

    if (!titleValue) {
      return;
    }

    void onSubmit({
      title: titleValue,
      date: today.dateKey,
      color: colorValue,
    });
  }

  return (
    <ModalShell>
      <form onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
        </div>
        <label className="field-label">제목*</label>
        <input
          className="field-input"
          name="title"
          defaultValue=""
          placeholder="일정 제목"
          maxLength={30}
          required
        />
        <div className="date-field-grid">
          <FieldBox label={`시작일(${today.weekday})`} value={today.dateKey} />
          <FieldBox label={`종료일(${today.weekday})`} value={today.dateKey} />
        </div>
        {!compact && (
          <>
            <p className="field-label">반복 요일*</p>
            <div className="weekday-pills">
              {weekdays.map((day) => (
                <button type="button" key={day} className={day === "화" ? "active" : ""}>{day}</button>
              ))}
            </div>
          </>
        )}
        <div className="toggle-row">
          <div>
            <strong>시간 설정*</strong>
            <small>하루 종일 일정으로 등록돼요.</small>
          </div>
          <Image
            aria-hidden
            className="toggle-asset"
            src="/assets/calendar_popup_svg_assets/07_all_day_toggle_off.svg"
            alt=""
            width={90}
            height={48}
          />
        </div>
        <p className="field-label">색상*</p>
        <div className="color-dots">
          {scheduleColorChips.map((chip, index) => (
            <ColorChip
              key={chip.value}
              value={chip.value}
              asset={chip.asset}
              defaultChecked={index === 0}
            />
          ))}
        </div>
        <button className="primary-action full" type="submit">
          {submitLabel}
        </button>
      </form>
    </ModalShell>
  );
}

function EditorModal({
  kind,
  title,
  manual = false,
  summary,
  onClose,
  onSave,
}: {
  kind: "memo" | "todo";
  title: string;
  manual?: boolean;
  summary?: AiSummary | null;
  onClose: () => void;
  onSave: (payload: EditorSavePayload) => Promise<void>;
}) {
  const initialMemo = manual ? null : summary?.memo;
  const initialTodos = manual ? [""] : summary?.todos.length ? summary.todos : [""];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (kind === "memo") {
      const titleValue = String(formData.get("title") ?? "").trim();
      const bodyValue = String(formData.get("body") ?? "").trim();

      if (!bodyValue) {
        return;
      }

      void onSave({
        kind: "memo",
        date: today.dateKey,
        title: titleValue || bodyValue.slice(0, 10),
        body: bodyValue,
      });
      return;
    }

    const todos = formData
      .getAll("todo")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (todos.length === 0) {
      return;
    }

    void onSave({
      kind: "todo",
      date: today.dateKey,
      todos,
    });
  }

  return (
    <ModalShell>
      <form onSubmit={handleSubmit}>
        <div className="edit-topbar">
          <button type="button" onClick={onClose}>취소</button>
          <strong>{title}</strong>
          <button type="submit">저장</button>
        </div>
        <button type="button" className="date-chip">{today.dateLabel}</button>
        {kind === "memo" ? (
          <div className="editor-body">
            <input
              name="title"
              defaultValue={initialMemo?.title ?? ""}
              placeholder="제목"
            />
            <textarea
              name="body"
              defaultValue={initialMemo?.body ?? ""}
              placeholder="내용을 입력하세요."
              rows={8}
              required
            />
          </div>
        ) : (
          <div className="todo-editor">
            {initialTodos.map((todo, index) => (
              <div key={`${todo}-${index}`}>
                <Icon name="checkbox" size={24} />
                <input name="todo" defaultValue={todo} placeholder="할 일을 입력하세요." />
                <button type="button" aria-label="할 일 삭제"><Icon name="trash" /></button>
              </div>
            ))}
            <button type="button" className="ghost-add-button">+ 할 일 추가</button>
          </div>
        )}
      </form>
    </ModalShell>
  );
}

function ConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <SimpleModal
      icon="!"
      title="작성을 취소하시겠습니까?"
      description="변경한 내용은 저장되지 않아요."
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
      src="/logo.svg"
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
