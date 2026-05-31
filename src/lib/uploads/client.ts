// 客户端上传封装 — 给前端 3 个组件复用
// (PromptComposer / NewTaskWorkspace / TaskChatColumn)

export interface UploadedFile {
  kind: "doc" | "image";
  url: string;
  storageKey: string;
  name: string;
  size: number;
  mime: string | null;
  parsedText?: string;
  truncated?: boolean;
  rawLength?: number;
  maxParsedChars?: number;
}

export interface UploadError {
  /** i18n key,直接传给 t() */
  i18nKey: "uploadFailed" | "fileTooLarge" | "fileTypeNotSupported";
  /** 给 i18n 占位用(如 fileTooLarge 的 {limit}) */
  i18nValues?: Record<string, string | number>;
  /** 后端原始文案(英文调试用,前端可不展示) */
  raw?: string;
}

/** POST /api/uploads,上传单文件 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/uploads", { method: "POST", body: fd });
  } catch (err) {
    throw {
      i18nKey: "uploadFailed",
      raw: err instanceof Error ? err.message : "network error",
    } satisfies UploadError;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      limitMB?: number;
    };
    if (body.error === "fileTooLarge") {
      throw {
        i18nKey: "fileTooLarge",
        i18nValues: { limit: body.limitMB ?? 20 },
        raw: `HTTP ${res.status}`,
      } satisfies UploadError;
    }
    if (body.error === "fileTypeNotSupported") {
      throw {
        i18nKey: "fileTypeNotSupported",
        raw: `HTTP ${res.status}`,
      } satisfies UploadError;
    }
    throw {
      i18nKey: "uploadFailed",
      raw: body.error ?? `HTTP ${res.status}`,
    } satisfies UploadError;
  }
  return (await res.json()) as UploadedFile;
}

/** 文档上传后塞进 textarea 的文本(LLM 直接读) */
export function buildDocInsertion(file: UploadedFile): string {
  if (file.kind === "doc" && file.parsedText) {
    const tip = file.truncated
      ? `\n\n[已上传文档:${file.name}(${file.rawLength} 字,已截取前 ${file.parsedText.length} 字)]\n`
      : `\n\n[已上传文档:${file.name}]\n`;
    return tip + file.parsedText;
  }
  return `\n\n[已上传:${file.name}]\n`;
}

/** 提交时把图片附件 URL 拼到 prompt 末尾(让 agent 能引用参考图) */
export function buildImageReferences(images: UploadedFile[]): string {
  if (images.length === 0) return "";
  const lines = images.map((img) => `参考图 ${img.name}: ${img.url}`);
  return `\n\n${lines.join("\n")}`;
}

/** 文档 picker 接受的 accept 属性(注:旧版 .doc 二进制格式不支持,仅支持 .docx) */
export const ACCEPT_DOC = ".pdf,.txt,.md,.markdown,.docx";
/** 图片 picker 接受的 accept 属性 */
export const ACCEPT_IMAGE = "image/*";
/** 通用(文档+图片) */
export const ACCEPT_ANY = `${ACCEPT_DOC},${ACCEPT_IMAGE}`;
