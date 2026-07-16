import { NextResponse } from "next/server";

type ClientMessage = {
  from: "user" | "ai";
  text: string;
};

type ChatRequest =
  | {
      mode: "chat";
      messages: ClientMessage[];
    }
  | {
      mode: "summary";
      messages: ClientMessage[];
      today: string;
    };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const messages = sanitizeMessages(body.messages);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "대화 내용이 비어 있어요." },
        { status: 400 },
      );
    }

    if (body.mode === "summary") {
      const summary = await requestSummary(messages, body.today);
      return NextResponse.json({ summary });
    }

    const reply = await requestChatReply(messages);
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

function sanitizeMessages(messages: ClientMessage[]) {
  return messages
    .filter(
      (message) =>
        (message.from === "user" || message.from === "ai") &&
        typeof message.text === "string" &&
        message.text.trim(),
    )
    .slice(-12)
    .map((message) => ({
      role: message.from === "user" ? "user" : "assistant",
      content: message.text.trim(),
    }));
}

async function requestChatReply(
  messages: Array<{ role: string; content: string }>,
) {
  const data = await callOpenAI([
    {
      role: "system",
      content:
        "너는 '하루 요정'이라는 한국어 기록 도우미야. 사용자의 하루 이야기를 다정하게 듣고, 메모/할 일/일정으로 정리할 수 있는 단서를 짧게 되물어봐. 답변은 2~3문장으로 간결하게 해.",
    },
    ...messages,
  ]);

  return data.choices?.[0]?.message?.content?.trim() ??
    "좋아요. 계속 이야기해주시면 메모와 할 일로 정리해드릴게요.";
}

async function requestSummary(
  messages: Array<{ role: string; content: string }>,
  today: string,
) {
  const data = await callOpenAI([
    {
      role: "system",
      content: [
        "너는 하루 기록을 JSON으로 정리하는 도우미야. 반드시 JSON만 출력해.",
        '형식: {"memo":{"title":"","body":""},"todos":[""],"schedules":[{"title":"","date":"YYYY-MM-DD","startTime":"HH:mm"|null,"endTime":"HH:mm"|null,"isAllDay":true,"color":"#AFA0FF"}]}',
        "규칙:",
        "1) todos는 짧고 행동 중심의 명사구로 작성해. 예: '치과 가기', '정형외과 예약', '보고서 제출'.",
        "2) todos에 '오늘/내일/모레', '해야 해/가야 해/가야함' 같은 문장형·날짜 표현을 넣지 마.",
        "3) 날짜/시간 정보는 schedules에만 넣어. 시간이 없으면 startTime/endTime은 JSON null로 두고 isAllDay=true.",
        "4) 절대 문자열 \"null\"을 넣지 마. 값이 없으면 JSON null을 사용해.",
        "5) 서로 다른 일정은 별도 schedules 항목으로 분리해. 날짜가 불명확하면 오늘 날짜를 사용해.",
      ].join(" "),
    },
    {
      role: "user",
      content: `오늘 날짜는 ${today}야. 아래 대화를 메모, To-do, 일정 제안으로 정리해줘.`,
    },
    ...messages,
  ]);
  const content = data.choices?.[0]?.message?.content?.trim() ?? "{}";

  return normalizeSummary(JSON.parse(stripCodeFence(content)), today);
}

async function callOpenAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았어요.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "OpenAI 요청에 실패했어요.");
  }

  return response.json();
}

function stripCodeFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeOptionalTime(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return null;
  }
  return trimmed;
}

function normalizeTodoText(text: string) {
  return text
    .trim()
    .replace(/^(오늘|내일|모레|글피)\s*/, "")
    .replace(/(에\s*)?(가야\s*해|가야함|해야\s*해|해야함|해야돼|해야 돼)$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSummary(value: unknown, today: string) {
  const summary = value as {
    memo?: { title?: unknown; body?: unknown };
    todos?: unknown;
    schedule?: {
      title?: unknown;
      date?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      isAllDay?: unknown;
      color?: unknown;
    } | null;
    schedules?: Array<{
      title?: unknown;
      date?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      isAllDay?: unknown;
      color?: unknown;
    }>;
  };
  const todos = Array.isArray(summary.todos)
    ? summary.todos
        .filter(
          (todo): todo is string =>
            typeof todo === "string" && todo.trim().length > 0,
        )
        .map(normalizeTodoText)
        .filter(Boolean)
    : [];

  const rawSchedules = Array.isArray(summary.schedules)
    ? summary.schedules
    : summary.schedule
      ? [summary.schedule]
      : [];

  const schedules = rawSchedules
    .filter((item) => item && typeof item.title === "string" && item.title.trim())
    .map((item) => {
      const startTime = normalizeOptionalTime(item.startTime);
      const endTime = normalizeOptionalTime(item.endTime);
      return {
        title: String(item.title).trim(),
        date:
          typeof item.date === "string" && item.date && item.date !== "null"
            ? item.date
            : today,
        startTime,
        endTime,
        isAllDay:
          typeof item.isAllDay === "boolean" ? item.isAllDay : !startTime,
        color:
          typeof item.color === "string" && item.color && item.color !== "null"
            ? item.color
            : "#AFA0FF",
        accepted: true as boolean | null,
      };
    });

  return {
    memo: {
      title:
        typeof summary.memo?.title === "string" && summary.memo.title
          ? summary.memo.title
          : "오늘의 기록",
      body:
        typeof summary.memo?.body === "string" && summary.memo.body
          ? summary.memo.body
          : "대화를 바탕으로 기록을 정리했어요.",
    },
    todos,
    schedules,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "일시적인 오류가 발생했어요.";
}
