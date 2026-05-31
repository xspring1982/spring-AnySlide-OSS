"use client";

// 2026-05-17 GDPR Cookie 同意:Context Provider
//
// 状态机:
//   undecided  -> 用户从未做过选择(显示 banner) | localStorage 无记录
//   accepted   -> 同意 analytics(或 marketing),GA 可加载
//   rejected   -> 仅必需,GA 不加载
//
// 三种事件来源都能改 consent:
//   1. 本 tab 的 banner 按钮 -> setConsent() -> localStorage + 同源 BroadcastChannel
//   2. 同 origin 另一个 tab -> storage 事件
//   3. 同 tab 内其他组件(比如 Cookie Policy 页的"重新选择"按钮)-> CustomEvent
//
// 设计取舍:
// - 不引入第三方库(react-cookie-consent / cookieconsent-org),60 行能自己写,跟设计系统一致
// - 用 localStorage 不用 cookie:cookie 自身就是要被管理的对象,用 localStorage 更干净
// - SSR 安全:首次 render 时 hasDecided=false 且 choice=DEFAULT_DENIED,避免 hydration 错位

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  COOKIE_POLICY_VERSION,
  DEFAULT_DENIED,
  DEFAULT_GRANTED,
  GEO_COOKIE_NAME,
  REOPEN_REQUEST_KEY,
  type ConsentChoice,
  type ConsentRecord,
  type GeoZone,
} from "./types";

interface ConsentContextValue {
  /** 当前同意状态(从 localStorage 读出,SSR 初值是 DEFAULT_DENIED;
   *  ROW 用户首屏会被自动 grant 成 DEFAULT_GRANTED) */
  consent: ConsentChoice;
  /** 用户是否已经显式做过选择(false 时 banner *可能* 显示 — 还要看 geo) */
  hasDecided: boolean;
  /** 是否已经完成 hydration(避免 SSR / 首屏闪烁) */
  hydrated: boolean;
  /** 当前用户的 geo 区域(EU/ROW) — 来自 proxy.ts 写的 cookie */
  geo: GeoZone;
  /** Banner 是否应该显示 —— 综合 hasDecided + geo + 用户是否点过"重新选择" */
  shouldShowBanner: boolean;
  /** 同意全部(banner "接受全部"按钮) */
  acceptAll: () => void;
  /** 仅必需(banner "仅必需"按钮) */
  rejectAll: () => void;
  /** 自定义(customize modal "保存"按钮) */
  saveCustom: (choice: Omit<ConsentChoice, "necessary">) => void;
  /** 清除选择,重新弹 banner(footer / cookie page "重新选择"链接)
   *  ROW 用户也能借此真正撤回(打 sessionStorage flag 跳过 auto-grant) */
  reopen: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readFromStorage(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    // 防御:坏数据 / 协议升级触发重选
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.policyVersion !== COOKIE_POLICY_VERSION ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(record: ConsentRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 隐私模式 / 配额满,无声忽略 — UI 还能继续工作
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// 2026-05-18 Geo gate 工具:从 document.cookie 读 proxy.ts 写的 as_geo
function readGeoCookie(): GeoZone {
  if (typeof document === "undefined") return "EU"; // SSR 安全默认
  const match = document.cookie.match(/(?:^|;\s*)as_geo=(EU|ROW)/);
  return (match?.[1] as GeoZone) ?? "EU"; // 读不到时按 EU 保守处理
}

// 2026-05-18 sessionStorage flag:跟踪用户是否在当前 tab 显式点过"重新选择"
function readReopenFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(REOPEN_REQUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function writeReopenFlag(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(REOPEN_REQUEST_KEY, "1");
    } else {
      window.sessionStorage.removeItem(REOPEN_REQUEST_KEY);
    }
  } catch {
    // ignore
  }
}
// 引用 GEO_COOKIE_NAME 防止 lint unused(常量主要由 proxy.ts 使用)
void GEO_COOKIE_NAME;

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // 2026-05-18 Geo gate:proxy.ts 写的 as_geo cookie 决定 banner 是否弹
  const [geo, setGeo] = useState<GeoZone>("EU"); // SSR / 首屏前默认 EU(保守)
  // sessionStorage flag:用户点过"重新选择"才设 true,让 ROW 也能撤回
  const [reopenRequested, setReopenRequested] = useState(false);

  // 首次 mount:从 localStorage / cookie / sessionStorage 一次性 hydrate
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecord(readFromStorage());
    setGeo(readGeoCookie());
    setReopenRequested(readReopenFlag());
    setHydrated(true);
  }, []);

  // 监听 storage 事件(同 origin 另一个 tab 改了 consent)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CONSENT_STORAGE_KEY) return;
      setRecord(readFromStorage());
      setReopenRequested(readReopenFlag());
    };
    const onCustom = () => {
      setRecord(readFromStorage());
      setReopenRequested(readReopenFlag());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CONSENT_CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CONSENT_CHANGE_EVENT, onCustom);
    };
  }, []);

  const broadcast = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT));
  }, []);

  const persist = useCallback(
    (choice: ConsentChoice) => {
      const next: ConsentRecord = {
        ...choice,
        decidedAt: new Date().toISOString(),
        policyVersion: COOKIE_POLICY_VERSION,
      };
      writeToStorage(next);
      setRecord(next);
      // 用户做出选择 = reopen 流程结束,清 flag(避免下次刷新还按 reopen 处理)
      writeReopenFlag(false);
      setReopenRequested(false);
      broadcast();
    },
    [broadcast]
  );

  const acceptAll = useCallback(() => persist(DEFAULT_GRANTED), [persist]);
  const rejectAll = useCallback(() => persist(DEFAULT_DENIED), [persist]);
  const saveCustom = useCallback(
    (choice: Omit<ConsentChoice, "necessary">) =>
      persist({ necessary: true, ...choice }),
    [persist]
  );
  const reopen = useCallback(() => {
    clearStorage();
    // 打 sessionStorage flag:让 ROW 用户的 banner 这次必须弹,不被 auto-grant 吞掉
    writeReopenFlag(true);
    setRecord(null);
    setReopenRequested(true);
    broadcast();
  }, [broadcast]);

  const value = useMemo<ConsentContextValue>(() => {
    // 已显式决定 → 用 record 的值
    if (record) {
      return {
        consent: {
          necessary: true,
          analytics: record.analytics,
          marketing: record.marketing,
        },
        hasDecided: true,
        hydrated,
        geo,
        shouldShowBanner: false,
        acceptAll,
        rejectAll,
        saveCustom,
        reopen,
      };
    }
    // 未决定 + ROW + 未点过 reopen → 自动 granted(内存层,不写 storage,
    // 这样用户跨 tab / 跨刷新仍会按当前 geo 重新评估,不污染"用户已决定"语义)
    const autoGrant = geo === "ROW" && !reopenRequested;
    return {
      consent: autoGrant ? DEFAULT_GRANTED : DEFAULT_DENIED,
      hasDecided: false,
      hydrated,
      geo,
      // Banner 弹的条件:hydrate 完 + 未决定 + (EU 区域 或 用户显式 reopen)
      shouldShowBanner: hydrated && (geo === "EU" || reopenRequested),
      acceptAll,
      rejectAll,
      saveCustom,
      reopen,
    };
  }, [record, hydrated, geo, reopenRequested, acceptAll, rejectAll, saveCustom, reopen]);

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used inside <ConsentProvider>");
  }
  return ctx;
}

/** 便捷 hook:仅判断 analytics 是否同意(GoogleAnalytics 组件用) */
export function useAnalyticsConsent(): boolean {
  const { consent, hydrated } = useConsent();
  return hydrated && consent.analytics;
}
