import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const GTM_ID = "GTM-TBJ5RDZK";
const SITE_URL = "https://pm6-final-team-3.vercel.app";
const SITE_TITLE = "하루요정 - AI 다이어리로 캘린더·메모·to do 한번에";
const SITE_DESCRIPTION =
  "바쁜 하루, 기록은 해야 하는데 작성은 부담스럽다면? AI 요정 하루와 함께 해보세요! 몇마디의 대화로 캘린더·메모·to do를 자동 정리해서 등록해줘요. 하루 단 3분으로 내 삶을 정리하기, 지금 무료로 시작할 수 있어요.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.jpg",
        width: 1024,
        height: 537,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "하루 요정",
  description: SITE_DESCRIPTION,
  url: `${SITE_URL}/`,
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <Script id="gtm" strategy="beforeInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
