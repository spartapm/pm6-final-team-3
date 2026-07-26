import { HaruFairyApp } from "@/components/HaruFairyApp";

function IntroSection() {
  return (
    <section className="seo-intro" aria-label="하루 요정 소개">
      <h1>하루 요정 — AI와 대화로 완성되는 나만의 다이어리</h1>
      <p>
        대화만으로 하루를 기록하고, 메모·일정·할 일을 자동으로 정리해주는 AI
        다이어리
      </p>
      <h2>모든 기록을 하나로</h2>
      <p>
        캘린더·투두·메모를 한 곳에서 — 캘린더 일정 관리, 투두리스트 관리, 메모
        작성 및 보관
      </p>
      <h2>AI가 알아서 정리해줘요</h2>
      <p>
        대화로 말하면, AI가 분석해서 일정·할 일·메모로 자동 분류합니다. 예를
        들어 &quot;내일 10시에 미팅 있고, 보고서 검토도 마무리해야 해.&quot;라고
        말하면 일정·할 일·메모로 나눠 정리해 줘요.
      </p>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <IntroSection />
      <HaruFairyApp />
    </>
  );
}
