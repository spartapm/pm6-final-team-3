import { supabase } from "@/lib/supabase/client";

export type AppProfile = {
  nickname: string;
  avatarUrl: string | null;
};

export type AppMemo = {
  id: string;
  date: string;
  title: string;
  body: string;
};

export type AppTodo = {
  id: string;
  date: string;
  text: string;
  done: boolean;
};

export type AppSchedule = {
  id: string;
  date: string;
  title: string;
  time: string;
  color: string;
  isAllDay: boolean;
};

export type AppData = {
  profile: AppProfile | null;
  memos: AppMemo[];
  todos: AppTodo[];
  schedules: AppSchedule[];
};

export async function upsertProfile(input: {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  provider?: string | null;
}) {
  const { error } = await supabase.from("profiles").upsert({
    user_id: input.userId,
    nickname: input.nickname,
    avatar_url: input.avatarUrl ?? null,
    provider: input.provider ?? "kakao",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

type MemoRow = {
  id: string;
  memo_date: string;
  title: string;
  body: string;
};

type TodoRow = {
  id: string;
  todo_date: string;
  text: string;
  completed: boolean;
};

type ScheduleRow = {
  id: string;
  schedule_date: string;
  title: string;
  start_time: string | null;
  is_all_day: boolean;
  color: string;
};

export async function loadAppData(userId: string): Promise<AppData> {
  const [profileResult, memosResult, todosResult, schedulesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("memos")
        .select("id, memo_date, title, body")
        .eq("user_id", userId)
        .order("memo_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("todos")
        .select("id, todo_date, text, completed")
        .eq("user_id", userId)
        .order("todo_date", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("schedules")
        .select("id, schedule_date, title, start_time, is_all_day, color")
        .eq("user_id", userId)
        .order("schedule_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false }),
    ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (memosResult.error) {
    throw memosResult.error;
  }
  if (todosResult.error) {
    throw todosResult.error;
  }
  if (schedulesResult.error) {
    throw schedulesResult.error;
  }

  return {
    profile: profileResult.data
      ? {
          nickname: profileResult.data.nickname,
          avatarUrl: profileResult.data.avatar_url,
        }
      : null,
    memos: ((memosResult.data ?? []) as MemoRow[]).map((memo) => ({
      id: memo.id,
      date: memo.memo_date,
      title: memo.title,
      body: memo.body,
    })),
    todos: ((todosResult.data ?? []) as TodoRow[]).map((todo) => ({
      id: todo.id,
      date: todo.todo_date,
      text: todo.text,
      done: todo.completed,
    })),
    schedules: ((schedulesResult.data ?? []) as ScheduleRow[]).map(
      (schedule) => ({
        id: schedule.id,
        date: schedule.schedule_date,
        title: schedule.title,
        time: schedule.is_all_day
          ? "종일"
          : formatTime(schedule.start_time ?? ""),
        color: schedule.color,
        isAllDay: schedule.is_all_day,
      }),
    ),
  };
}

export async function createMemo(input: {
  userId: string;
  date: string;
  title: string;
  body: string;
  source?: "manual" | "ai";
}) {
  const { data, error } = await supabase
    .from("memos")
    .insert({
      user_id: input.userId,
      memo_date: input.date,
      title: input.title,
      body: input.body,
      source: input.source ?? "manual",
    })
    .select("id, memo_date, title, body")
    .single();

  if (error) {
    throw error;
  }

  const memo = data as MemoRow;
  return {
    id: memo.id,
    date: memo.memo_date,
    title: memo.title,
    body: memo.body,
  };
}

export async function createTodo(input: {
  userId: string;
  date: string;
  text: string;
  source?: "manual" | "ai";
}) {
  const { data, error } = await supabase
    .from("todos")
    .insert({
      user_id: input.userId,
      todo_date: input.date,
      text: input.text,
      source: input.source ?? "manual",
    })
    .select("id, todo_date, text, completed")
    .single();

  if (error) {
    throw error;
  }

  const todo = data as TodoRow;
  return {
    id: todo.id,
    date: todo.todo_date,
    text: todo.text,
    done: todo.completed,
  };
}

export async function updateTodoCompleted(input: {
  id: string;
  completed: boolean;
}) {
  const { error } = await supabase
    .from("todos")
    .update({ completed: input.completed })
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function updateTodo(input: {
  id: string;
  text: string;
  date: string;
}) {
  const { data, error } = await supabase
    .from("todos")
    .update({
      text: input.text,
      todo_date: input.date,
    })
    .eq("id", input.id)
    .select("id, todo_date, text, completed")
    .single();

  if (error) {
    throw error;
  }

  const todo = data as TodoRow;
  return {
    id: todo.id,
    date: todo.todo_date,
    text: todo.text,
    done: todo.completed,
  };
}

export async function updateMemo(input: {
  id: string;
  date: string;
  title: string;
  body: string;
}) {
  const { data, error } = await supabase
    .from("memos")
    .update({
      memo_date: input.date,
      title: input.title,
      body: input.body,
    })
    .eq("id", input.id)
    .select("id, memo_date, title, body")
    .single();

  if (error) {
    throw error;
  }

  const memo = data as MemoRow;
  return {
    id: memo.id,
    date: memo.memo_date,
    title: memo.title,
    body: memo.body,
  };
}

export async function deleteMemo(id: string) {
  const { error } = await supabase.from("memos").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteTodo(id: string) {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function updateSchedule(input: {
  id: string;
  date: string;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay?: boolean;
  color?: string;
  repeatDays?: string[];
}) {
  const { data, error } = await supabase
    .from("schedules")
    .update({
      schedule_date: input.date,
      title: input.title,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      is_all_day: input.isAllDay ?? true,
      color: input.color ?? "#AFA0FF",
      repeat_days: input.repeatDays ?? [],
    })
    .eq("id", input.id)
    .select("id, schedule_date, title, start_time, is_all_day, color")
    .single();

  if (error) {
    throw error;
  }

  const schedule = data as ScheduleRow;
  return {
    id: schedule.id,
    date: schedule.schedule_date,
    title: schedule.title,
    time: schedule.is_all_day ? "종일" : formatTime(schedule.start_time ?? ""),
    color: schedule.color,
    isAllDay: schedule.is_all_day,
  };
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function createSchedule(input: {
  userId: string;
  date: string;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay?: boolean;
  color?: string;
  repeatDays?: string[];
  source?: "manual" | "ai";
}) {
  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: input.userId,
      schedule_date: input.date,
      title: input.title,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      is_all_day: input.isAllDay ?? true,
      color: input.color ?? "#AFA0FF",
      repeat_days: input.repeatDays ?? [],
      source: input.source ?? "manual",
    })
    .select("id, schedule_date, title, start_time, is_all_day, color")
    .single();

  if (error) {
    throw error;
  }

  const schedule = data as ScheduleRow;
  return {
    id: schedule.id,
    date: schedule.schedule_date,
    title: schedule.title,
    time: schedule.is_all_day ? "종일" : formatTime(schedule.start_time ?? ""),
    color: schedule.color,
    isAllDay: schedule.is_all_day,
  };
}

export async function createChatSummary(input: {
  userId: string;
  conversation: unknown[];
  memoTitle: string;
  memoBody: string;
  todos: string[];
  scheduleSuggestions: unknown[];
}) {
  const { error } = await supabase.from("chat_summaries").insert({
    user_id: input.userId,
    conversation: input.conversation,
    memo_title: input.memoTitle,
    memo_body: input.memoBody,
    todos: input.todos,
    schedule_suggestions: input.scheduleSuggestions,
  });

  if (error) {
    throw error;
  }
}

function formatTime(value: string) {
  if (!value) {
    return "시간 미정";
  }

  return value.slice(0, 5);
}
