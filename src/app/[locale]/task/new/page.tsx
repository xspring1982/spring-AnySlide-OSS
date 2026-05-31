// /task/new — 任务页的"空状态"(没有具体 task 数据)
//
// 跟 /task/[id] 视觉一致(三列:sidebar / chat / canvas),区别:
//   - chat 列起手是欢迎气泡 + 创建任务输入区
//   - canvas 是空 dot grid + "空画布"提示
//   - 提交后 POST /api/tasks → router.push(/task/[新 id]) 进入有内容版本

import { NewTaskWorkspace } from "@/components/task/NewTaskWorkspace";

export const dynamic = "force-dynamic";

export default function NewTaskPage() {
  return <NewTaskWorkspace />;
}
