"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type OnboardingScreenProps = {
  onComplete: () => void;
};

const SLIDES = [
  {
    id: "chat",
    badge: "AI 채팅",
    icon: "logo" as const,
    title: ["말하듯 대화하면", "하루가 저절로 정리돼요"],
    description: [
      "오늘 있었던 일과 감정, 내일 할 일을",
      "편하게 이야기하기만 하면 돼요.",
    ],
    graphic: "chat" as const,
    cta: "다음 →",
  },
  {
    id: "summary",
    badge: "자동 정리",
    icon: "logo" as const,
    title: ["대화가 끝나면", "알아서 정리해드려요"],
    description: [
      "메모·할 일·일정을 AI가 만들어",
      "한 번에 확인하고 저장할 수 있어요.",
    ],
    graphic: "summary" as const,
    cta: "다음 →",
  },
  {
    id: "manual",
    badge: null,
    icon: "pencil" as const,
    title: ["직접 기록도 자유롭게"],
    description: [
      "AI 없이도 메모와 체크리스트를 바로 적을 수 있어요.",
      "나만의 기록을 차곡차곡 쌓아보세요.",
    ],
    graphic: null,
    cta: "시작하기",
  },
] as const;

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const activeRef = useRef(false);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    setDragOffset(0);
  }, [index]);

  function goNext() {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((current) => Math.min(current + 1, SLIDES.length - 1));
  }

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(next, SLIDES.length - 1)));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    activeRef.current = true;
    setIsDragging(true);
    startXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeRef.current) {
      return;
    }
    setDragOffset(event.clientX - startXRef.current);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeRef.current) {
      return;
    }
    activeRef.current = false;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);

    const delta = event.clientX - startXRef.current;
    if (delta < -56 && index < SLIDES.length - 1) {
      setIndex((current) => current + 1);
    } else if (delta > 56 && index > 0) {
      setIndex((current) => current - 1);
    }
    setDragOffset(0);
  }

  return (
    <section className="onboarding-shell">
      <div className="onboarding-glow" aria-hidden />
      <div className="onboarding-stars" aria-hidden />

      <header className="onboarding-top">
        <button type="button" className="onboarding-skip" onClick={onComplete}>
          건너뛰기
        </button>
      </header>

      <div
        className="onboarding-track-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={`onboarding-track${isDragging ? " dragging" : ""}`}
          style={{
            transform: `translateX(calc(${-index * 100}% + ${dragOffset}px))`,
          }}
        >
          {SLIDES.map((item) => (
            <article
              key={item.id}
              className={`onboarding-slide${item.graphic ? "" : " centered"}`}
            >
              <div className="onboarding-hero">
                {item.icon === "logo" ? (
                  <Image
                    src="/logo.png"
                    alt=""
                    width={88}
                    height={88}
                    className="onboarding-logo"
                    priority
                  />
                ) : (
                  <div className="onboarding-icon-frame pencil">
                    <span className="onboarding-pencil-emoji" aria-hidden>
                      ✏️
                    </span>
                  </div>
                )}

                {item.badge ? (
                  <span className="onboarding-badge">{item.badge}</span>
                ) : null}

                <h1>
                  {item.title.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h1>
                <p>
                  {item.description.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </div>

              {item.graphic === "chat" ? <ChatPreview /> : null}
              {item.graphic === "summary" ? <SummaryPreview /> : null}
            </article>
          ))}
        </div>
      </div>

      <footer className="onboarding-footer">
        <div className="onboarding-dots" role="tablist" aria-label="온보딩 단계">
          {SLIDES.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              className={itemIndex === index ? "active" : ""}
              onClick={() => goTo(itemIndex)}
              aria-label={`${itemIndex + 1}번째 안내`}
            />
          ))}
        </div>

        <button type="button" className="onboarding-cta" onClick={goNext}>
          {slide.cta}
        </button>
      </footer>
    </section>
  );
}

function ChatPreview() {
  return (
    <div className="onboarding-preview chat-preview-card">
      <div className="preview-bubble user">
        오늘 밤에 운동 갔다가 내일 7시에 서울역에서 기차 타야 돼.
      </div>

      <div className="preview-ai-block">
        <span className="preview-ai-avatar">
          <Image src="/logo.png" alt="" width={28} height={28} />
        </span>
        <div className="preview-bubble ai">
          고생 많았어요! 내일 일정을 이렇게 정리했어요 ✨
        </div>
      </div>

      <div className="preview-schedule-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/onboarding/train.svg"
          alt=""
          width={36}
          height={36}
          className="preview-schedule-icon"
        />
        <div>
          <strong>서울역 기차 탑승</strong>
          <small>내일 오전 7:00 · 서울역</small>
        </div>
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="onboarding-preview summary-preview">
      <div className="preview-memo-card">
        <div className="preview-memo-title">
          <span aria-hidden>😌</span>
          <strong>바쁘지만 알찬 하루</strong>
        </div>
        <p>
          오전엔 면접 준비로 분주했지만 차분히 해냈다. 오후엔 카페에서 한숨
          돌렸다.
        </p>
      </div>

      <div className="preview-split">
        <div className="preview-todo-card">
          <h3>내일 할 일</h3>
          <ul>
            <li>
              <span className="preview-check" />
              보고서 마무리
            </li>
            <li>
              <span className="preview-check" />
              치과 예약 확인
            </li>
          </ul>
        </div>
        <div className="preview-event-card">
          <h3>일정</h3>
          <div className="preview-event-row">
            <span className="preview-event-emoji" aria-hidden>
              🦷
            </span>
            <div className="preview-event-copy">
              <strong>치과 예약</strong>
              <small>6/30 오후 3:00</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
