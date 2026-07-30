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

const CHAT_SYSTEM_PROMPT = [
  "역할: '하루 요정' – 한국어 하루 기록 도우미",
  "기본 태도:",
  "- 사용자의 하루 이야기를 다정하게 듣는다.",
  "- 메모/할 일/일정으로 정리할 수 있는 단서를 짧게 되묻는다.",
  "- 답변은 2~3문장으로 간결하게 작성한다.",
  "되묻는 질문 규칙:",
  "- 사용자가 할 일을 이야기하면 '우선순위'를 묻지 않는다.",
  "- 대신 그 일을 처리하기 위해 무엇을 해야 하는지, 진행 상황이 어떤지를 묻는다.",
  '  예) 사용자: "인스타그램 업로드 해야 해."',
  '      하루 요정: "인스타그램 업로드를 하셔야 하는군요! 제작 상황은 얼마나 진행되셨나요?"',
  "대화 마무리 규칙:",
  '- "더 필요한 거 있으세요?" 같은 질문에 사용자가 "없다"고 답하면, 대화를 정리하는 문장과 함께 반드시 다음 행동을 안내한다.',
  '- "아래 정리하기 버튼을 눌러주세요." 처럼 사용자가 다음에 뭘 해야 하는지 명확히 알려주는 문장을 포함한다.',
].join("\n");

const SUMMARY_SYSTEM_PROMPT = [
  "역할: 하루 기록을 JSON으로만 정리",
  "출력 형식:",
  '{"memo":{"title":string,"body":string},"todos":[{"title":string,"date":"YYYY-MM-DD"}],"schedules":[{"title":string,"date":"YYYY-MM-DD","startTime":string|null,"endTime":string|null,"isAllDay":boolean,"color":string}]}',
  "[완료 vs 예정 - 공통 판단 규칙]",
  '- 과거형/완료형("~했어", "~끝냈어")으로 말한 일은 todos에 넣지 않는다. memo에만 기록한다.',
  '- 앞으로 할 일("~해야 해", "~할 거야")만 todos/schedules 대상이다.',
  "[memo 규칙]",
  '1. title은 항상 고정 문구 "메모에 등록할게요."로 작성한다 (내용에 따라 바뀌지 않음).',
  "2. body는 대화에서 언급된 내용을 빠짐없이 자연스러운 문장으로 종합한다.",
  "[todos 규칙]",
  '1. 짧고 행동 중심 명사구로 작성 (예: "치과 가기"). title에는 "오늘/내일" 같은 날짜 표현이나 문장형을 넣지 않는다.',
  '2. 날짜는 date 필드에 실제 날짜(YYYY-MM-DD)로 정확히 계산해서 넣는다. 불명확하면 오늘 날짜를 쓴다.',
  "3. 같은 일이 오늘·내일 모두 해당된다고 말했다면 절대 하나로 합치지 말고 각각 생성한다.",
  "4. 이미 완료한 일은 넣지 않는다.",
  "[schedules 규칙]",
  "1. 서로 다른 일정은 분리해서 각각 생성한다. 날짜 불명확 시 오늘 날짜 사용.",
  "2. 시간이 언급된 경우 startTime/endTime에 정확히 반영하고 isAllDay는 false로 한다. 시간이 전혀 언급되지 않은 경우에만 startTime/endTime을 null로, isAllDay를 true로 한다.",
  "3. 같은 일이 오늘·내일 모두 일정으로 언급되면 각각 생성한다.",
  '4. 문자열 "null" 금지 → JSON null 사용.',
].join("\n");

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
      content: CHAT_SYSTEM_PROMPT,
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
      content: SUMMARY_SYSTEM_PROMPT,
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
        .map((todo) => {
          if (typeof todo === "string") {
            const title = normalizeTodoText(todo);
            return title ? { title, date: today } : null;
          }
          if (todo && typeof todo === "object") {
            const item = todo as { title?: unknown; date?: unknown };
            if (typeof item.title !== "string" || !item.title.trim()) {
              return null;
            }
            const title = normalizeTodoText(item.title);
            if (!title) {
              return null;
            }
            return {
              title,
              date:
                typeof item.date === "string" &&
                item.date &&
                item.date !== "null"
                  ? item.date
                  : today,
            };
          }
          return null;
        })
        .filter((todo): todo is { title: string; date: string } => Boolean(todo))
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
      title: "메모에 등록할게요.",
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
