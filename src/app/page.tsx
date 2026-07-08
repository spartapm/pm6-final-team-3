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
  type AppMemo,
  type AppProfile,
  type AppSchedule,
  type AppTodo,
} from "@/lib/haru-store";
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
  | "signup"
  | "signupDone"
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
type IconName =
  | "home"
  | "calendar"
  | "message"
  | "record"
  | "user"
  | "send"
  | "plus"
  | "check"
  | "close"
  | "chevron"
  | "trash"
  | "kakao"
  | "alert";

const today = {
  dateKey: "2026-06-30",
  day: 30,
  dateLabel: "6월 30일 화요일",
  shortDate: "6.30",
  weekday: "화",
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const monthDays = [31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4];

const initialMessages: Message[] = [
  {
    id: 1,
    from: "ai",
    text: "안녕하세요, 저는 AI요정 하루예요. 오늘 있었던 일과 내일 해야 할 일을 편하게 말해주세요.",
  },
  {
    id: 2,
    from: "user",
    text: "오늘 스터디 준비했고 내일 치과 예약 확인해야 해. 보고서 초안도 써야 하고 조금 피곤했어.",
  },
  {
    id: 3,
    from: "ai",
    text: "좋아요. 오늘의 감정과 내일 할 일, 일정 후보를 나눠서 정리해둘게요.",
  },
];

const summaryMemo = {
  title: "바쁘지만 알차던 하루",
  body: "오전엔 해야 할 일이 많아 피곤했지만, 스터디 준비를 마치며 성취감을 느꼈어요. 내일은 치과 예약 확인과 보고서 초안을 먼저 처리하면 마음이 한결 가벼워질 거예요.",
};

const summaryTodos = ["보고서 초안 작성", "치과 예약 확인", "운동복 챙기기"];
const summarySchedule: Schedule = {
  id: "summary-schedule",
  title: "치과 예약",
  date: today.dateKey,
  time: "내일 15:00",
  color: "#FFD195",
  isAllDay: false,
};

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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedDate, setSelectedDate] = useState(29);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);

  const todaysTodos = todos.filter((todo) => todo.date === today.dateKey);
  const todaysSchedules = schedules.filter(
    (schedule) => schedule.date === today.dateKey,
  );
  const completedCount = todaysTodos.filter((todo) => todo.done).length;
  const totalCompletedCount = todos.filter((todo) => todo.done).length;
  const selectedDateKey = `2026-06-${String(selectedDate).padStart(2, "0")}`;
  const selectedSchedules = schedules.filter(
    (schedule) => schedule.date === selectedDateKey,
  );
  const selectedWeekday = getJune2026Weekday(selectedDate);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function applySession(nextSession: Session | null) {
    setSession(nextSession);
    setIsLoggedIn(Boolean(nextSession));
    setAppError(null);

    if (!nextSession) {
      setProfile(null);
      setMemos([]);
      setTodos([]);
      setSchedules([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);

    try {
      const data = await loadAppData(nextSession.user.id);
      setProfile(data.profile);
      setMemos(data.memos);
      setTodos(data.todos);
      setSchedules(data.schedules);
    } catch (error) {
      setAppError(getErrorMessage(error));
    } finally {
      setIsLoadingData(false);
    }
  }

  const calendarCells = useMemo(() => {
    const scheduledDays = new Set(
      schedules
        .map((schedule) => Number(schedule.date.split("-")[2]))
        .filter((day) => Number.isFinite(day)),
    );

    return monthDays.map((day, index) => ({
      id: `${day}-${index}`,
      day,
      muted: index === 0 || index > 30,
      today: day === today.day && index === 30,
      selected: day === selectedDate && !((day === today.day && index !== 30) || index === 0),
      hasSchedule: scheduledDays.has(day),
    }));
  }, [schedules, selectedDate]);

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

  function sendMessage() {
    const text = messageDraft.trim();
    if (!text) {
      return;
    }

    setMessages((current) => [
      ...current,
      { id: Date.now(), from: "user", text },
      {
        id: Date.now() + 1,
        from: "ai",
        text: "좋아요. 메모와 체크리스트, 일정 후보로 정리할 수 있는 내용이에요.",
      },
    ]);
    setMessageDraft("");
  }

  async function saveSummary() {
    const userId = requireUserId();
    if (!userId) {
      return;
    }

    try {
      const [memo, createdTodos, schedule] = await Promise.all([
        createMemo({
          userId,
          date: today.dateKey,
          title: summaryMemo.title,
          body: summaryMemo.body,
          source: "ai",
        }),
        Promise.all(
          summaryTodos.map((text) =>
            createTodo({
              userId,
              date: today.dateKey,
              text,
              source: "ai",
            }),
          ),
        ),
        createSchedule({
          userId,
          date: today.dateKey,
          title: summarySchedule.title,
          startTime: "15:00",
          endTime: "16:00",
          isAllDay: false,
          color: summarySchedule.color,
          source: "ai",
        }),
      ]);

      await createChatSummary({
        userId,
        conversation: messages,
        memoTitle: summaryMemo.title,
        memoBody: summaryMemo.body,
        todos: summaryTodos,
        scheduleSuggestions: [summarySchedule],
      });

      setMemos((current) => [memo, ...current]);
      setTodos((current) => [...createdTodos, ...current]);
      setSchedules((current) => [schedule, ...current]);
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
        scopes: "profile_nickname profile_image",
        queryParams: {
          scope: "profile_nickname profile_image",
        },
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  }

  return (
    <main>
      <section className="screen-shell">
        <div className="screen-scroll">
          {activeTab === "home" && (
            <HomeScreen
              userName={profile?.nickname ?? "지원"}
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
              draft={messageDraft}
              chatDone={chatDone}
              onDraft={setMessageDraft}
              onSend={sendMessage}
              onFinish={() => setChatDone(true)}
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
              isLoggedIn={isLoggedIn}
              onSignup={() => setModal("signup")}
              onLogin={signInWithKakao}
              onLogout={signOut}
            />
          )}
        </div>
        <BottomNav activeTab={activeTab} onTab={setActiveTab} />
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
          onClose={() => setModal("cancel")}
          onSave={async () => closeModal()}
        />
      )}

      {modal === "todoEdit" && (
        <EditorModal
          kind="todo"
          title="할 일"
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

      {modal === "signup" && (
        <SignupModal
          onClose={() => setModal("cancel")}
          onSubmit={() => setModal("signupDone")}
        />
      )}

      {modal === "signupDone" && (
        <SimpleModal
          icon="✓"
          title="가입 완료"
          description="하루 요정 시작 준비가 끝났어요."
          actionLabel="확인"
          onAction={() => {
            setIsLoggedIn(true);
            closeModal();
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
        <span className="streak-badge">🔥 5일째</span>
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
          <h2>6월</h2>
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
        <TodoList todos={todos} onToggle={onToggleTodo} />
        <button className="ghost-add-button" onClick={onAddTodo}>
          + 할 일 추가
        </button>
      </section>
    </div>
  );
}

function CalendarScreen({
  calendarCells,
  schedules,
  selectedDate,
  selectedWeekday,
  onSelectDate,
  onCreate,
  onEdit,
}: {
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
          <Icon name="chevron" />
        </button>
        <h1>2026년 6월</h1>
        <button className="nav-arrow" aria-label="다음 월">
          <Icon name="chevron" />
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
              {cell.hasSchedule && <i />}
            </button>
          ))}
        </div>
      </section>

      <section className="schedule-list-section">
        <p className="section-eyebrow">
          6월 {selectedDate}일 {selectedWeekday}요일 · 일정 {schedules.length}개
        </p>
        {schedules.length > 0 ? (
          schedules.map((schedule) => (
            <button key={schedule.id} className="schedule-card" onClick={onEdit}>
              <span style={{ backgroundColor: schedule.color }} />
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
  draft,
  chatDone,
  onDraft,
  onSend,
  onFinish,
  onSave,
  onEditMemo,
  onEditTodo,
  onEditSchedule,
}: {
  messages: Message[];
  draft: string;
  chatDone: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
  onFinish: () => void;
  onSave: () => void;
  onEditMemo: () => void;
  onEditTodo: () => void;
  onEditSchedule: () => void;
}) {
  if (chatDone) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1>오늘의 기록이 완성됐어요 ✨</h1>
          <p>AI가 대화를 바탕으로 작성했어요. 확인하고 저장해주세요.</p>
        </header>

        <ResultCard title={summaryMemo.title} onEdit={onEditMemo}>
          <p>{summaryMemo.body}</p>
        </ResultCard>

        <ResultCard title="to-do list" onEdit={onEditTodo}>
          <ul className="readonly-todos">
            {summaryTodos.map((todo) => (
              <li key={todo}>
                <span />
                {todo}
              </li>
            ))}
          </ul>
        </ResultCard>

        <ResultCard title="일정 등록 제안" onEdit={onEditSchedule}>
          <div className="suggestion-card">
            <strong>{summarySchedule.title}</strong>
            <small>6/30(화) 오후 3:00</small>
            <p>이 일정을 캘린더에 등록할까요?</p>
            <div>
              <button>무시</button>
              <button className="primary">등록</button>
            </div>
          </div>
        </ResultCard>

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

        <div className="extract-card">
          <span>📆 일정 · 치과 6/30 15:00</span>
          <span>✅ 할 일 · 보고서 초안</span>
        </div>
      </section>

      <button className="finish-chat-button" onClick={onFinish}>
        대화 마치고 정리하기
      </button>

      <div className="chat-input-bar">
        <input
          value={draft}
          placeholder="답장을 입력하세요"
          onChange={(event) => onDraft(event.target.value)}
        />
        <button disabled={!draft.trim()} onClick={onSend} aria-label="메시지 전송">
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
                    <Icon name="chevron" />
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
            <h2>6월 30일 할 일</h2>
            <span>{completedCount}/{todos.length} 완료</span>
          </div>
          <TodoList todos={todos} onToggle={onToggleTodo} />
          <button className="floating-plus" onClick={onTodoWrite} aria-label="할 일 작성">
            <Icon name="plus" />
          </button>
        </section>
      )}
    </div>
  );
}

function MyScreen({
  isLoggedIn,
  onSignup,
  onLogin,
  onLogout,
}: {
  isLoggedIn: boolean;
  onSignup: () => void;
  onLogin: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>마이</h1>
      </header>

      {isLoggedIn ? (
        <section className="my-card">
          <div className="profile-orb fairy"><LogoMark compact /></div>
          <h2>지원님 안녕하세요.</h2>
          <p>오늘도 하루 요정과 함께해요.</p>
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
      ) : (
        <section className="my-card">
          <div className="profile-orb"><Icon name="user" /></div>
          <h2>로그인하고 기록을 지켜요</h2>
          <p>여러 기기에서 동기화하고 안전하게 백업해요</p>
          <button className="kakao-action" onClick={onLogin}>
            <Icon name="kakao" />
            카카오로 시작하기
          </button>
          <button className="secondary-action" onClick={onSignup}>
            회원가입
          </button>
        </section>
      )}
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
          {cell.hasSchedule && <i />}
        </span>
      ))}
    </div>
  );
}

function ScheduleLine({ schedule }: { schedule: Schedule }) {
  return (
    <div className="schedule-line">
      <span style={{ backgroundColor: schedule.color }} />
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
}: {
  todos: Todo[];
  onToggle: (id: string) => void;
}) {
  if (todos.length === 0) {
    return <EmptyState text="등록된 일정이 없습니다" />;
  }

  return (
    <div className="todo-list">
      {todos.map((todo) => (
        <button key={todo.id} className="todo-row" onClick={() => onToggle(todo.id)}>
          <span className={todo.done ? "checked" : ""}>{todo.done ? "✓" : ""}</span>
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
        <button onClick={onEdit}>✎ 수정</button>
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
    const colorValue = String(formData.get("color") ?? "#AFA0FF");

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
          defaultValue={compact ? "치과 예약" : ""}
          placeholder="일정 제목"
          maxLength={30}
          required
        />
        <div className="date-field-grid">
          <FieldBox label="시작일(화)" value={today.dateKey} />
          <FieldBox label="종료일(화)" value={today.dateKey} />
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
          <span><i /></span>
        </div>
        <p className="field-label">색상*</p>
        <div className="color-dots">
          {["#AFA0FF", "#FFD195", "#9EE6CF", "#FF9EB5"].map((color, index) => (
            <label key={color} style={{ backgroundColor: color }}>
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={index === 0}
              />
            </label>
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
  onClose,
  onSave,
}: {
  kind: "memo" | "todo";
  title: string;
  manual?: boolean;
  onClose: () => void;
  onSave: (payload: EditorSavePayload) => Promise<void>;
}) {
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
              defaultValue={manual ? "" : summaryMemo.title}
              placeholder="제목"
            />
            <textarea
              name="body"
              defaultValue={manual ? "" : summaryMemo.body}
              placeholder="내용을 입력하세요."
              rows={8}
              required
            />
          </div>
        ) : (
          <div className="todo-editor">
            {(manual ? [""] : summaryTodos).map((todo, index) => (
              <div key={`${todo}-${index}`}>
                <span />
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

function SignupModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell>
      <div className="edit-topbar">
        <button className="back-button" onClick={onClose} aria-label="뒤로가기">
          <Icon name="chevron" />
        </button>
        <strong>회원가입</strong>
        <span />
      </div>
      <div className="signup-hero">
        <div><LogoMark /></div>
        <h2>하루 요정 시작하기</h2>
        <p>닉네임과 비밀번호로 계정을 만들어요</p>
      </div>
      <input className="field-input" placeholder="사용할 아이디" />
      <p className="field-error">이미 사용 중인 아이디예요.</p>
      <input className="field-input" placeholder="사용할 닉네임" />
      <input className="field-input error" placeholder="비밀번호 입력" type="password" maxLength={4} />
      <p className="field-error">비밀번호는 숫자 4자리만 가능해요.</p>
      <button className="primary-action full" onClick={onSubmit}>
        가입하기
      </button>
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

function getJune2026Weekday(day: number) {
  if (day === 29) {
    return "일";
  }

  if (day === 30) {
    return "화";
  }

  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return labels[(day - 1) % 7];
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
  const [, month, day] = date.split(separator);
  return `2026년 ${Number(month)}월 ${Number(day)}일`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "일시적인 오류가 발생했어요. 다시 시도해주세요.";
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

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.35,
  };

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "home" && (
        <>
          <path {...common} d="m3.5 11 8.5-7.2L20.5 11" />
          <path {...common} d="M6.5 10.5v8.2h11v-8.2" />
          <path {...common} d="M10 18.5v-5h4v5" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect {...common} x="4" y="5.5" width="16" height="14" rx="3" />
          <path {...common} d="M8 3.8v3.4M16 3.8v3.4M4.5 10h15" />
          <path {...common} d="M8 13h.1M12 13h.1M16 13h.1M8 16h.1M12 16h.1" />
        </>
      )}
      {name === "message" && (
        <>
          <path {...common} d="M5 18.4V8.8c0-2.7 2-4.6 4.7-4.6h4.6c2.8 0 4.7 1.9 4.7 4.6v3.4c0 2.7-1.9 4.6-4.7 4.6h-4.1L5 20.2v-1.8Z" />
          <path {...common} d="M9 10.2h.1M12 10.2h.1M15 10.2h.1" />
        </>
      )}
      {name === "record" && (
        <>
          <path {...common} d="M7 3.8h7l3 3v13.4H7z" />
          <path {...common} d="M14 3.8v3.4h3.3M9.5 11h5M9.5 14.5h5M9.5 18h3.4" />
        </>
      )}
      {name === "user" && (
        <>
          <circle {...common} cx="12" cy="8" r="3.3" />
          <path {...common} d="M5.5 20c.7-3.3 3.1-5 6.5-5s5.8 1.7 6.5 5" />
        </>
      )}
      {name === "send" && (
        <>
          <path {...common} d="m5 12 13-7-4.6 14-2.7-5.7L5 12Z" />
          <path {...common} d="m11 13 7-8" />
        </>
      )}
      {name === "plus" && (
        <>
          <path {...common} d="M12 5v14M5 12h14" />
        </>
      )}
      {name === "check" && (
        <>
          <path {...common} d="m5 12.5 4.2 4.2L19 6.8" />
        </>
      )}
      {name === "close" && (
        <>
          <path {...common} d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </>
      )}
      {name === "chevron" && (
        <>
          <path {...common} d="m9 5 7 7-7 7" />
        </>
      )}
      {name === "trash" && (
        <>
          <path {...common} d="M5 7h14M10 11v5M14 11v5" />
          <path {...common} d="M8 7l.7 12h6.6L16 7M9.5 7l.7-2h3.6l.7 2" />
        </>
      )}
      {name === "kakao" && (
        <path
          d="M12 5C7.6 5 4 7.8 4 11.3c0 2.2 1.5 4.2 3.8 5.3l-.6 2.2c-.1.4.3.7.6.4l2.7-1.7c.5.1 1 .1 1.5.1 4.4 0 8-2.8 8-6.3S16.4 5 12 5Z"
          fill="currentColor"
        />
      )}
      {name === "alert" && (
        <>
          <path {...common} d="M12 8v5" />
          <path {...common} d="M12 17h.1" />
          <path {...common} d="M10.3 4.5 3.4 17.2c-.7 1.3.2 2.8 1.7 2.8h13.8c1.5 0 2.4-1.5 1.7-2.8L13.7 4.5c-.7-1.3-2.7-1.3-3.4 0Z" />
        </>
      )}
    </svg>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}
