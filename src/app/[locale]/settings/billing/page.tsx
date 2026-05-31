// SPEC §5.4 + §6.3.7 — 余额 / 流水页
//
// 简版:
//   - 顶部:当前余额 + 套餐 + 重置时间(Free)/ 月度赠送(Pro)
//   - 中部:30 条流水(reason / delta / 时间 / 关联 task)
//   - 充值入口:M4 Stripe 接通

import { BillingPage } from "@/components/billing/BillingPage";

export default function Page() {
  return <BillingPage />;
}
