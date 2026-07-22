import type {
  AppChatMessage,
  AppChatSummary,
  AppMemo,
  AppSchedule,
  AppTodo,
} from "@/lib/haru-store";

export const GUEST_USER_ID = "guest-local";
const GUEST_STORAGE_KEY = "haru-guest-data-v1";

export type GuestData = {
  memos: AppMemo[];
  todos: AppTodo[];
  schedules: AppSchedule[];
  chatSummaries: AppChatSummary[];
};

function emptyGuestData(): GuestData {
  return { memos: [], todos: [], schedules: [], chatSummaries: [] };
}

export function isGuestUser(userId: string | null | undefined) {
  return userId === GUEST_USER_ID;
}

export function loadGuestData(): GuestData {
  if (typeof window === "undefined") {
    return emptyGuestData();
  }

  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) {
      return emptyGuestData();
    }
    const parsed = JSON.parse(raw) as Partial<GuestData>;
    return {
      memos: Array.isArray(parsed.memos) ? parsed.memos : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      chatSummaries: Array.isArray(parsed.chatSummaries)
        ? parsed.chatSummaries
        : [],
    };
  } catch {
    return emptyGuestData();
  }
}

export function saveGuestData(data: GuestData) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
}

function createId() {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function guestCreateMemo(input: {
  date: string;
  title: string;
  body: string;
}) {
  const data = loadGuestData();
  const memo: AppMemo = {
    id: createId(),
    date: input.date,
    title: input.title,
    body: input.body,
  };
  data.memos = [memo, ...data.memos];
  saveGuestData(data);
  return memo;
}

export function guestUpdateMemo(input: {
  id: string;
  date: string;
  title: string;
  body: string;
}) {
  const data = loadGuestData();
  data.memos = data.memos.map((memo) =>
    memo.id === input.id
      ? {
          ...memo,
          date: input.date,
          title: input.title,
          body: input.body,
        }
      : memo,
  );
  saveGuestData(data);
  return data.memos.find((memo) => memo.id === input.id)!;
}

export function guestDeleteMemo(id: string) {
  const data = loadGuestData();
  data.memos = data.memos.filter((memo) => memo.id !== id);
  saveGuestData(data);
}

export function guestCreateTodo(input: { date: string; text: string }) {
  const data = loadGuestData();
  const todo: AppTodo = {
    id: createId(),
    date: input.date,
    text: input.text,
    done: false,
  };
  data.todos = [...data.todos, todo];
  saveGuestData(data);
  return todo;
}

export function guestUpdateTodo(input: {
  id: string;
  text?: string;
  date?: string;
  done?: boolean;
}) {
  const data = loadGuestData();
  data.todos = data.todos.map((todo) =>
    todo.id === input.id
      ? {
          ...todo,
          text: input.text ?? todo.text,
          date: input.date ?? todo.date,
          done: input.done ?? todo.done,
        }
      : todo,
  );
  saveGuestData(data);
  return data.todos.find((todo) => todo.id === input.id)!;
}

export function guestDeleteTodo(id: string) {
  const data = loadGuestData();
  data.todos = data.todos.filter((todo) => todo.id !== id);
  saveGuestData(data);
}

export function guestCreateSchedule(input: {
  date: string;
  title: string;
  startTime?: string | null;
  isAllDay?: boolean;
  color?: string;
}) {
  const data = loadGuestData();
  const isAllDay = input.isAllDay ?? true;
  const schedule: AppSchedule = {
    id: createId(),
    date: input.date,
    title: input.title,
    time: isAllDay ? "종일" : (input.startTime ?? "시간 미정"),
    color: input.color ?? "#AFA0FF",
    isAllDay,
  };
  data.schedules = [schedule, ...data.schedules];
  saveGuestData(data);
  return schedule;
}

export function guestUpdateSchedule(input: {
  id: string;
  date: string;
  title: string;
  startTime?: string | null;
  isAllDay?: boolean;
  color?: string;
}) {
  const data = loadGuestData();
  const isAllDay = input.isAllDay ?? true;
  data.schedules = data.schedules.map((schedule) =>
    schedule.id === input.id
      ? {
          ...schedule,
          date: input.date,
          title: input.title,
          time: isAllDay ? "종일" : (input.startTime ?? "시간 미정"),
          color: input.color ?? schedule.color,
          isAllDay,
        }
      : schedule,
  );
  saveGuestData(data);
  return data.schedules.find((schedule) => schedule.id === input.id)!;
}

export function guestDeleteSchedule(id: string) {
  const data = loadGuestData();
  data.schedules = data.schedules.filter((schedule) => schedule.id !== id);
  saveGuestData(data);
}

export function guestCreateChatSummary(input: {
  conversation: AppChatMessage[];
  memoTitle: string;
  memoBody: string;
  todos: string[];
}) {
  const data = loadGuestData();
  const summary: AppChatSummary = {
    id: createId(),
    createdAt: new Date().toISOString(),
    conversation: input.conversation,
    memoTitle: input.memoTitle,
    memoBody: input.memoBody,
    todos: input.todos,
  };
  data.chatSummaries = [summary, ...data.chatSummaries];
  saveGuestData(data);
  return summary;
}
