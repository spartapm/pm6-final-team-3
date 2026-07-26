# 하루 요정 SEO 적용 스펙

- 대상 사이트: https://pm6-final-team-3.vercel.app/ (Next.js, App Router)
- 페이지 구성: 단일 페이지 (라우팅 없음, `/` 하나)
- 첨부 파일: `og-image.jpg` (1200x630), `favicon.png` (1024x1024)

아래 내용 그대로 코드에 반영해주시면 됩니다. AI 코딩 툴에 이 파일 전체를 붙여넣고 "이 스펙대로 Next.js 프로젝트에 SEO 설정 적용해줘"라고 요청하셔도 됩니다.

---

## 1. 이미지 파일 배치

이 폴더의 두 이미지를 프로젝트 `public/` 폴더에 그대로 복사:

- `og-image.jpg` → `public/og-image.jpg`
- `favicon.png` → `public/favicon.png`

## 2. `app/layout.tsx` (또는 최상위 레이아웃)의 `metadata` 수정

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '하루요정 - AI 다이어리로 캘린더·메모·to do 한번에',
  description:
    '바쁜 하루, 기록은 해야 하는데 작성은 부담스럽다면? AI 요정 하루와 함께 해보세요! 몇마디의 대화로 캘린더·메모·to do를 자동 정리해서 등록해줘요. 하루 단 3분으로 내 삶을 정리하기, 지금 무료로 시작할 수 있어요.',
  metadataBase: new URL('https://pm6-final-team-3.vercel.app'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    title: '하루요정 - AI 다이어리로 캘린더·메모·to do 한번에',
    description:
      '바쁜 하루, 기록은 해야 하는데 작성은 부담스럽다면? AI 요정 하루와 함께 해보세요! 몇마디의 대화로 캘린더·메모·to do를 자동 정리해서 등록해줘요. 하루 단 3분으로 내 삶을 정리하기, 지금 무료로 시작할 수 있어요.',
    url: 'https://pm6-final-team-3.vercel.app/',
    locale: 'ko_KR',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '하루요정 - AI 다이어리로 캘린더·메모·to do 한번에',
    description:
      '바쁜 하루, 기록은 해야 하는데 작성은 부담스럽다면? AI 요정 하루와 함께 해보세요! 몇마디의 대화로 캘린더·메모·to do를 자동 정리해서 등록해줘요. 하루 단 3분으로 내 삶을 정리하기, 지금 무료로 시작할 수 있어요.',
    images: ['/og-image.jpg'],
  },
};
```

> 기존 `title`/`description`이 이미 있다면 위 값으로 덮어써주세요. `metadataBase`의 도메인은 실제 커스텀 도메인이 따로 있다면 그 주소로 바꿔주세요.

## 3. 구조화 데이터 (JSON-LD)

`app/layout.tsx`의 `<body>` 안, 최상단에 추가:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: '하루 요정',
              description:
                '바쁜 하루, 기록은 해야 하는데 작성은 부담스럽다면? AI 요정 하루와 함께 해보세요! 몇마디의 대화로 캘린더·메모·to do를 자동 정리해서 등록해줘요. 하루 단 3분으로 내 삶을 정리하기, 지금 무료로 시작할 수 있어요.',
              url: 'https://pm6-final-team-3.vercel.app/',
              applicationCategory: 'LifestyleApplication',
              operatingSystem: 'Web',
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
```

## 4. `public/robots.txt` 신규 생성

```
User-agent: *
Allow: /

Sitemap: https://pm6-final-team-3.vercel.app/sitemap.xml
```

## 5. `app/sitemap.ts` 신규 생성 (Next.js 자동 sitemap)

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://pm6-final-team-3.vercel.app/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
```

## 6. (중요) 초기 HTML에 실제 설명 텍스트 추가 — 색인 품질 개선

**현재 문제**: 실제 배포된 페이지의 원본 HTML을 확인해보면 `<main></main>` — 본문이 완전히 비어있습니다. 전체 UI가 클라이언트 컴포넌트로만 구성돼 있어서, 구글봇이 처음 방문했을 때 읽을 수 있는 텍스트가 meta description 한 줄 외엔 없습니다. JS 실행 후 2차 렌더링을 구글이 나중에 하긴 하지만, 시간이 오래 걸리고 색인 품질도 떨어집니다.

**해결 방법**: 채팅/기록 앱 자체(`'use client'`)는 그대로 두되, 그 위에 **서버 컴포넌트로 렌더링되는 소개 섹션**을 하나 추가해서 초기 HTML에 실제 텍스트가 포함되도록 합니다. (OG 이미지에 쓰인 카피를 그대로 재사용하면 톤이 일관됩니다.)

예시 (`app/page.tsx` 상단에 추가, 서버 컴포넌트로 유지):

```tsx
function IntroSection() {
  return (
    <section aria-label="하루 요정 소개">
      <h1>하루 요정 — AI와 대화로 완성되는 나만의 다이어리</h1>
      <p>대화만으로 하루를 기록하고, 메모·일정·할 일을 자동으로 정리해주는 AI 다이어리</p>
      <h2>모든 기록을 하나로</h2>
      <p>캘린더·투두·메모를 한 곳에서 — 캘린더 일정 관리, 투두리스트 관리, 메모 작성 및 보관</p>
      <h2>AI가 알아서 정리해줘요</h2>
      <p>대화로 말하면, AI가 분석해서 일정·할 일·메모로 자동 분류합니다.</p>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <IntroSection />
      <ChatApp /> {/* 기존 클라이언트 컴포넌트 앱 */}
    </>
  );
}
```

- `IntroSection`은 `'use client'` 없이 서버 컴포넌트로 유지해야 초기 HTML에 텍스트가 그대로 포함됩니다.
- 디자인상 화면에 노출하고 싶지 않다면 시각적으로는 숨기되(`sr-only` 클래스 등) DOM에는 남겨두는 방식도 가능하지만, 가능하면 실제로 보이는 소개 영역으로 넣는 걸 권장합니다 (구글이 숨김 텍스트를 낮게 평가하는 경향이 있음).

## 7. 적용 후 확인 체크리스트

- [ ] 브라우저 탭에 새 파비콘(H 로고) 표시되는지
- [ ] 카카오톡/슬랙 등에 링크 공유 시 `og-image.jpg`가 미리보기로 뜨는지
- [ ] `https://pm6-final-team-3.vercel.app/robots.txt` 접속 시 정상 응답
- [ ] `https://pm6-final-team-3.vercel.app/sitemap.xml` 접속 시 정상 응답
- [ ] `curl https://pm6-final-team-3.vercel.app/ | grep main` 했을 때 `<main>` 안에 실제 텍스트가 보이는지 (비어있으면 6번 미반영)
- [ ] 배포 후 Google Search Console에 sitemap 제출
