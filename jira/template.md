# Jira 工單模板

填寫後交給 AI 即可自動建立或更新 Jira 工單。

---

## 建立工單

```
issueType: Task
projectKey: P26
summary: [admin] 功能描述
components: WEB
epicLink: [優化] Web
startDate: 2026-03-03
endDate: 2026-03-03
priority: Medium
assignee: bobchen
implementer: bobchen
description:
*需求(填寫執行需求、規格書、figma連結)*
-內容

*變更項目(選填，例如：客戶、PM等)*
-內容

*影響版本**(選填，定版後填寫)*
-內容

*備註**(選填，無在上方規格內請填寫此備註)*
-內容

*實作時間*
||天數 / 日期||項目||
| | |
| | |
| | |

```

## 更新工單(填寫需要變更的欄位即可)

```
issueKey: P26-255
summary: [admin] 測試 mcp 建立工作單是否正常
epicLink: [優化] Web
components: WEB
priority: High
description:
*需求(填寫執行需求、規格書、figma連結)*
-內容

*變更項目(選填，例如：客戶、PM等)*
-內容

*影響版本**(選填，定版後填寫)*
-內容

*備註**(選填，無在上方規格內請填寫此備註)*
-內容

*實作時間*
||天數 / 日期||項目||
| | |
| | |
| | |
```

---

## 欄位對照表

| 模板欄位    | MCP 參數    | Jira 欄位                              | 必填(建立) | 說明                                   |
| ----------- | ----------- | -------------------------------------- | ---------- | -------------------------------------- |
| issueType   | issueType   | Issue Type                             | Y          | Task、Bug、Story                       |
| projectKey  | projectKey  | Project                                | Y          | 專案代碼，例如 P26                     |
| summary     | summary     | Summary                                | Y          | 工單標題                               |
| components  | components  | Component/s                            | -          | 元件名稱，例如 WEB                     |
| epicLink    | epicLink    | 史诗链接 (customfield_10101)           | -          | Epic 的 Issue Key 或名稱               |
| startDate   | startDate   | Start Date [Gantt] (customfield_10108) | -          | 格式 YYYY-MM-DD                        |
| endDate     | endDate     | End Date [Gantt] (customfield_10109)   | -          | 格式 YYYY-MM-DD                        |
| priority    | priority    | Priority                               | -          | Highest / High / Medium / Low / Lowest |
| assignee    | assignee    | Assignee                               | -          | Jira 帳號名稱                          |
| implementer | implementer | Implementer (customfield_10111)        | -          | 實作者 Jira 帳號名稱                   |
| labels      | labels      | Labels                                 | -          | 標籤，逗號分隔                         |
| description | description | Description                            | -          | 詳細描述                               |
| issueKey    | issueKey    | -                                      | 更新時必填 | 填入則為更新模式                       |
