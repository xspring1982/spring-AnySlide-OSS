// 通用 JSON-LD 注入组件(SEO 结构化数据)
// 输出 <script type="application/ld+json">,Server Component。

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
