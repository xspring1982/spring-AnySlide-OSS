import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

/**
 * 把 LLM 输出当作"文字草稿",只抽取叶子文本写回原 section。
 * 原 section 的标签、class、inline style、data 属性和 DOM 层级全部保留,
 * 避免模型偷偷改 CSS / 容器尺寸 / 装饰结构导致网页生成结果跑版。
 */
export function mergeTextIntoOriginalSection(
  originalSection: string,
  candidateSection: string,
): string {
  const $original = cheerio.load(originalSection, { xml: false }, false);
  const $candidate = cheerio.load(candidateSection, { xml: false }, false);
  const originalRoot = firstElement($original.root().children().toArray());
  const candidateRoot = firstElement($candidate.root().children().toArray());
  if (!originalRoot || !candidateRoot) {
    throw new Error("section rewrite merge failed: missing root element");
  }

  const originalLeaves = collectTextLeaves($original, originalRoot);
  const candidateLeaves = collectTextLeaves($candidate, candidateRoot);
  if (originalLeaves.length === 0 || candidateLeaves.length === 0) {
    throw new Error("section rewrite merge failed: no text leaves");
  }

  const count = Math.min(originalLeaves.length, candidateLeaves.length);
  for (let i = 0; i < count; i++) {
    const text = $candidate(candidateLeaves[i]).text().trim();
    if (text) $original(originalLeaves[i]).text(text);
  }

  return $original.html(originalRoot) || originalSection;
}

function collectTextLeaves(
  $: cheerio.CheerioAPI,
  root: AnyNode,
): AnyNode[] {
  const $root = $(root);
  const nodes = [root, ...$root.find("*").toArray()];
  return nodes.filter((node) => {
    if (node.type !== "tag") return false;
    const tagName = "tagName" in node ? String(node.tagName).toLowerCase() : "";
    if (tagName === "script" || tagName === "style") return false;
    const $node = $(node);
    if ($node.children().length > 0) return false;
    return $node.text().trim().length > 0;
  });
}

function firstElement(nodes: AnyNode[]): AnyNode | null {
  return nodes.find((node) => node.type === "tag") ?? null;
}
