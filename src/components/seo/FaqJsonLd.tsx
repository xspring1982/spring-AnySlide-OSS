// 首页 FAQPage JSON-LD(LLM 引用源 / 潜在 Google rich snippet)
//
// 文案来源:docs/todo.md §1。积分数字以 src/lib/credits.ts 为准
// (SIGNUP_BONUS_AMOUNT=60 / FREE_DAILY_RESET_AMOUNT=10,每日重置到 10)。
// 答案为完整问句的独立回答,不含 "see above" 之类的指代。

import { JsonLd } from "./JsonLd";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is AnySlide free?",
    a: "Yes. You get 60 free credits at signup, and your balance refreshes to 10 credits daily. Free credits cover roughly 5 to 10 slide decks depending on length. No credit card required.",
  },
  {
    q: "Does AnySlide accurately support Chinese, Japanese, and Korean text?",
    a: "Yes. AnySlide uses OpenAI's gpt-image-2 model, which renders CJK characters accurately, unlike most AI slide tools (Gamma, Tome, Beautiful.ai) that often produce garbled text.",
  },
  {
    q: "Can I export my slides to PowerPoint (PPTX)?",
    a: "Yes. AnySlide supports both HTML web slides that are inline-editable in the browser, and native PPTX downloads generated via pptxgenjs.",
  },
  {
    q: "How long does it take to generate a deck?",
    a: "Typically about 30 seconds for HTML decks, and 60 to 90 seconds for AI-image PPTX decks that use the gpt-image-2 path.",
  },
  {
    q: "Can I edit slides after generation?",
    a: "HTML decks are inline-editable directly in the browser. AI-image PPTX decks are full-image renders, so their text is not editable, but you can regenerate any individual slide.",
  },
  {
    q: "What is gpt-image-2 and how does AnySlide use it?",
    a: "gpt-image-2 is OpenAI's image generation model, known for rendering CJK text natively and accurately. AnySlide uses it to render each slide as a full image for the AI-image PPTX path.",
  },
  {
    q: "Are there templates I can start from?",
    a: "Yes. AnySlide offers 38 templates across 8 niches: Career, Finance, Reading, Beauty, Health, Culture, Travel, and Knowledge.",
  },
  {
    q: "How is AnySlide different from Gamma, Tome, and Beautiful.ai?",
    a: "Three differences: native CJK rendering, a dual engine (HTML editable plus PPTX downloadable), and 60 free credits with a daily refresh and no credit card required.",
  },
];

export function FaqJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
  );
}
