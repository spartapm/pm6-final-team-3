"use client";

import { useMemo, useState } from "react";

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

type Todo = {
  id: number;
  text: string;
  done: boolean;
};

type Schedule = {
  id: number;
  title: string;
  date: string;
  time: string;
  color: string;
};

type Memo = {
  id: number;
  date: string;
  title: string;
  body: string;
};

type Message = {
  id: number;
  from: "user" | "ai";
  text: string;
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

const initialTodos: Todo[] = [
  { id: 1, text: "운동복 챙겨가기", done: true },
  { id: 2, text: "보고서 초안 작성", done: false },
  { id: 3, text: "치과 예약 확인", done: false },
  { id: 4, text: "하루 마무리 기록하기", done: false },
];

const initialSchedules: Schedule[] = [
  {
    id: 1,
    title: "스터디 줌 미팅",
    date: today.dateKey,
    time: "오늘 21:00",
    color: "#AFA0FF",
  },
  {
    id: 2,
    title: "치과 예약",
    date: today.dateKey,
    time: "내일 15:00",
    color: "#FFD195",
  },
  {
    id: 3,
    title: "스터디 모임",
    date: "2026-06-29",
    time: "19:00",
    color: "#AFA0FF",
  },
];

const initialMemos: Memo[] = [
  {
    id: 1,
    date: "2026.06.30",
    title: "바쁘지만 알차던 하루",
    body: "오전에는 면접 준비로 정신이 없었지만, 오후에는 스터디 준비를 마치고 마음이 조금 놓였다. 내일은 치과 예약을 먼저 확인하고 보고서 초안을 끝내야겠다.",
  },
  {
    id: 2,
    date: "2026.06.29",
    title: "작은 루틴을 지킨 날",
    body: "오늘은 운동복을 미리 챙겨두고 해야 할 일을 짧게 정리했다. 오래 쓰지는 못했지만 짧게라도 기록하니 하루가 덜 흘러간 느낌이었다.",
  },
];

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
  id: 99,
  title: "치과 예약",
  date: today.dateKey,
  time: "내일 15:00",
  color: "#FFD195",
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
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedDate, setSelectedDate] = useState(29);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const completedCount = todos.filter((todo) => todo.done).length;
  const selectedDateKey = `2026-06-${String(selectedDate).padStart(2, "0")}`;
  const selectedSchedules = schedules.filter(
    (schedule) => schedule.date === selectedDateKey,
  );
  const selectedWeekday = getJune2026Weekday(selectedDate);

  const calendarCells = useMemo(() => {
    return monthDays.map((day, index) => ({
      id: `${day}-${index}`,
      day,
      muted: index === 0 || index > 30,
      today: day === today.day && index === 30,
      selected: day === selectedDate && !((day === today.day && index !== 30) || index === 0),
      hasSchedule: [14, 21, 29, 30].includes(day),
    }));
  }, [selectedDate]);

  function toggleTodo(id: number) {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    );
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

  function saveSummary() {
    const baseId = Date.now();
    setMemos((current) => [
      {
        id: baseId,
        date: "2026.06.30",
        title: summaryMemo.title,
        body: summaryMemo.body,
      },
      ...current,
    ]);
    setTodos((current) => [
      ...summaryTodos.map((text, index) => ({
        id: baseId + index + 1,
        text,
        done: false,
      })),
      ...current,
    ]);
    setSchedules((current) => [
      { ...summarySchedule, id: baseId + 10 },
      ...current,
    ]);
    setModal("saved");
  }

  function closeModal() {
    setModal(null);
  }

  return (
    <main>
      <section className="screen-shell">
        <div className="screen-scroll">
          {activeTab === "home" && (
            <HomeScreen
              todos={todos}
              schedules={schedules}
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
              completedCount={completedCount}
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
              onLogin={() => setIsLoggedIn(true)}
              onLogout={() => setIsLoggedIn(false)}
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
          onSubmit={() => {
            setSchedules((current) => [
              {
                id: Date.now(),
                title: "스터디 준비",
                date: today.dateKey,
                time: "종일",
                color: "#AFA0FF",
              },
              ...current,
            ]);
            closeModal();
          }}
        />
      )}

      {modal === "scheduleEdit" && (
        <ScheduleModal
          title="일정 수정"
          submitLabel="저장"
          compact
          onClose={() => setModal("cancel")}
          onSubmit={closeModal}
        />
      )}

      {modal === "memoEdit" && (
        <EditorModal
          kind="memo"
          title="메모"
          onClose={() => setModal("cancel")}
          onSave={closeModal}
        />
      )}

      {modal === "todoEdit" && (
        <EditorModal
          kind="todo"
          title="할 일"
          onClose={() => setModal("cancel")}
          onSave={closeModal}
        />
      )}

      {modal === "manualMemo" && (
        <EditorModal
          kind="memo"
          title="메모 작성"
          manual
          onClose={() => setModal("cancel")}
          onSave={() => {
            setMemos((current) => [
              {
                id: Date.now(),
                date: "2026.06.30",
                title: "오늘의 짧은 기록",
                body: "직접 남긴 메모가 여기에 저장돼요.",
              },
              ...current,
            ]);
            closeModal();
          }}
        />
      )}

      {modal === "manualTodo" && (
        <EditorModal
          kind="todo"
          title="할 일 작성"
          manual
          onClose={() => setModal("cancel")}
          onSave={() => {
            setTodos((current) => [
              ...current,
              { id: Date.now(), text: "직접 추가한 할 일", done: false },
            ]);
            closeModal();
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
  onToggleTodo: (id: number) => void;
  onAddTodo: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="home-header">
        <div>
          <h1>안녕하세요, 지원님</h1>
          <p>{today.dateLabel}</p>
        </div>
        <span className="streak-badge">🔥 5일째</span>
      </header>

      <button className="ai-entry-card" onClick={onChat}>
        <span className="fairy-thumb"><FairyIcon /></span>
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
            {message.from === "ai" && <span className="ai-avatar"><FairyIcon compact /></span>}
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
  onToggleTodo: (id: number) => void;
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
          <div className="profile-orb fairy"><FairyIcon compact /></div>
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
  onToggle: (id: number) => void;
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
  onSubmit: () => void;
}) {
  return (
    <ModalShell>
      <div className="modal-header">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
      </div>
      <label className="field-label">제목*</label>
      <input className="field-input" defaultValue={compact ? "치과 예약" : ""} placeholder="일정 제목" maxLength={30} />
      <div className="date-field-grid">
        <FieldBox label="시작일(화)" value="2026.06.30" />
        <FieldBox label="종료일(화)" value="2026.06.30" />
      </div>
      {!compact && (
        <>
          <p className="field-label">반복 요일*</p>
          <div className="weekday-pills">
            {weekdays.map((day) => (
              <button key={day} className={day === "화" ? "active" : ""}>{day}</button>
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
        {["#AFA0FF", "#FFD195", "#9EE6CF", "#FF9EB5"].map((color) => (
          <button key={color} style={{ backgroundColor: color }} />
        ))}
      </div>
      <button className="primary-action full" onClick={onSubmit}>
        {submitLabel}
      </button>
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
  onSave: () => void;
}) {
  return (
    <ModalShell>
      <div className="edit-topbar">
        <button onClick={onClose}>취소</button>
        <strong>{title}</strong>
        <button onClick={onSave}>저장</button>
      </div>
      <button className="date-chip">2026.06.30 화요일</button>
      {kind === "memo" ? (
        <div className="editor-body">
          <input defaultValue={manual ? "" : summaryMemo.title} placeholder="제목" />
          <textarea defaultValue={manual ? "" : summaryMemo.body} placeholder="내용을 입력하세요." rows={8} />
        </div>
      ) : (
        <div className="todo-editor">
          {(manual ? [""] : summaryTodos).map((todo, index) => (
            <div key={`${todo}-${index}`}>
              <span />
              <input defaultValue={todo} placeholder="할 일을 입력하세요." />
              <button aria-label="할 일 삭제"><Icon name="trash" /></button>
            </div>
          ))}
          <button className="ghost-add-button">+ 할 일 추가</button>
        </div>
      )}
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
        <div><FairyIcon /></div>
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
  const [, month, day] = date.split(".");
  return `2026년 ${Number(month)}월 ${Number(day)}일`;
}

function FairyIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "fairy-icon compact" : "fairy-icon"}
      viewBox="0 0 80 80"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="fairyGlow" cx="50%" cy="48%" r="55%">
          <stop offset="0%" stopColor="#FFF7D8" />
          <stop offset="46%" stopColor="#BFB5FF" />
          <stop offset="100%" stopColor="#7E68FF" />
        </radialGradient>
        <linearGradient id="fairyWing" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFF7FF" />
          <stop offset="45%" stopColor="#B8A8FF" />
          <stop offset="100%" stopColor="#6E5EFF" />
        </linearGradient>
      </defs>
      <path
        d="M38 39C26 15 11 12 10 28c-.8 13 13 17 25 15C23 50 17 62 28 66c12 4 16-13 14-24 7 11 20 22 27 12 8-12-9-19-24-18 13-7 20-20 10-26-10-7-17 11-17 29Z"
        fill="url(#fairyWing)"
        opacity="0.96"
      />
      <path
        d="M37 38c-8-13-17-17-21-10-4 8 8 12 19 12-11 3-16 12-9 16 8 4 12-7 12-16 4 8 14 17 19 10 5-8-7-12-17-11 9-5 13-15 6-18-7-3-10 8-9 17Z"
        fill="url(#fairyGlow)"
        opacity="0.9"
      />
      <circle cx="41" cy="40" r="5" fill="#FFFBEA" />
      <path
        d="M23 53c-6 4-10 8-13 14M56 25c6-6 10-9 16-12M55 55l10 10"
        stroke="#FFF1B3"
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.8"
      />
      <circle cx="18" cy="57" r="2.2" fill="#FFF1B3" />
      <circle cx="61" cy="20" r="2" fill="#FFF1B3" />
      <circle cx="66" cy="62" r="1.8" fill="#FFF1B3" />
    </svg>
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
