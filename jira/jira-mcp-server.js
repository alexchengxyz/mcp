#!/usr/bin/env node
/**
 * Jira MCP Server（自訂版）
 * 支援 Jira Data Center Basic Auth（Email + Password）
 *
 * 環境變數（從 jira/.env 讀取）：
 *   JIRA_URL      - Jira 伺服器網址，例如 http://jira.starcloudsoft.com.tw
 *   JIRA_USERNAME - 登入 Email
 *   JIRA_PASSWORD - 登入密碼
 *
 * 使用方式：
 *   1. 複製 jira/.env.example 為 jira/.env 並填寫認證資訊
 *   2. 在各專案的 MCP 設定中指向此 server：
 *      node /path/to/mcp/jira/jira-mcp-server.js
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ── 自動載入 .env（優先讀取同目錄的 .env，支援含 $ 的密碼） ────────────────────
function loadEnv() {
  // 讀取本 server 同層的 .env（即 mcp/jira/.env）
  const envPath = path.resolve(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    process.stderr.write(`⚠️  找不到 .env 設定檔：${envPath}\n`);
    process.stderr.write(
      `   請複製 .env.example 為 .env 並填入 Jira 認證資訊\n`,
    );
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ── 設定 ──────────────────────────────────────────────
const JIRA_URL = (process.env.JIRA_URL || "").replace(/\/$/, "");
const JIRA_USERNAME = process.env.JIRA_USERNAME || "";
const JIRA_PASSWORD = process.env.JIRA_PASSWORD || "";

if (!JIRA_URL || !JIRA_USERNAME || !JIRA_PASSWORD) {
  process.stderr.write(
    "❌ 缺少必要環境變數：JIRA_URL、JIRA_USERNAME、JIRA_PASSWORD\n",
  );
  process.exit(1);
}

const AUTH_HEADER =
  "Basic " +
  Buffer.from(`${JIRA_USERNAME}:${JIRA_PASSWORD}`).toString("base64");

// ── HTTP 工具 ─────────────────────────────────────────
function jiraRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const urlStr = `${JIRA_URL}${path}`;
    const url = new URL(urlStr);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: AUTH_HEADER,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // 允許自簽憑證（內網 Jira 常見）
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `Jira API 錯誤 ${res.statusCode}: ${parsed.errorMessages?.join(", ") || parsed.message || data}`,
              ),
            );
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── MCP Server ────────────────────────────────────────
const server = new Server(
  { name: "jira-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ── 工具定義 ──────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "jira_get_projects",
      description: "列出所有 Jira 專案",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "jira_create_issue",
      description: "在 Jira 建立新工作單（Issue）",
      inputSchema: {
        type: "object",
        required: ["projectKey", "summary", "issueType"],
        properties: {
          projectKey: { type: "string", description: "專案代碼，例如 P26" },
          summary: { type: "string", description: "工作單標題" },
          issueType: {
            type: "string",
            description: "Issue 類型，例如 Task、Bug、Story",
            default: "Task",
          },
          description: { type: "string", description: "詳細描述" },
          priority: {
            type: "string",
            description: "優先級：Highest、High、Medium、Low、Lowest",
            default: "Medium",
          },
          assignee: { type: "string", description: "指派給（Jira 帳號名稱）" },
          labels: {
            type: "array",
            items: { type: "string" },
            description: "標籤列表",
          },
          startDate: {
            type: "string",
            description:
              "開始日期（格式：YYYY-MM-DD），對應 Start Date [Gantt]",
          },
          endDate: {
            type: "string",
            description: "結束日期（格式：YYYY-MM-DD），對應 End Date [Gantt]",
          },
          components: {
            type: "array",
            items: { type: "string" },
            description: 'Component 列表，例如 ["Frontend", "Backend"]',
          },
          epicLink: {
            type: "string",
            description:
              "史诗链接（Epic Link），填入 Epic 的 Issue Key，例如 P26-10",
          },
          implementer: {
            type: "string",
            description: "Implementer（實作者 Jira 帳號名稱）",
          },
        },
      },
    },
    {
      name: "jira_get_issue",
      description: "取得 Jira 工作單詳細資訊",
      inputSchema: {
        type: "object",
        required: ["issueKey"],
        properties: {
          issueKey: { type: "string", description: "Issue Key，例如 P26-123" },
        },
      },
    },
    {
      name: "jira_update_issue",
      description: "更新 Jira 工作單欄位",
      inputSchema: {
        type: "object",
        required: ["issueKey"],
        properties: {
          issueKey: { type: "string", description: "Issue Key，例如 P26-123" },
          summary: { type: "string", description: "新標題" },
          description: { type: "string", description: "新描述" },
          priority: { type: "string", description: "新優先級" },
          assignee: { type: "string", description: "新指派人" },
          labels: { type: "array", items: { type: "string" } },
          components: {
            type: "array",
            items: { type: "string" },
            description: 'Component 列表，例如 ["Frontend", "Backend"]',
          },
          epicLink: {
            type: "string",
            description:
              "史诗链接（Epic Link），填入 Epic 的 Issue Key，例如 P26-10",
          },
          implementer: {
            type: "string",
            description: "Implementer（實作者 Jira 帳號名稱）",
          },
        },
      },
    },
    {
      name: "jira_search_issues",
      description: "用 JQL 搜尋 Jira Issues",
      inputSchema: {
        type: "object",
        required: ["jql"],
        properties: {
          jql: {
            type: "string",
            description:
              'JQL 查詢語句，例如 "project = P26 AND assignee = currentUser() AND status != Done ORDER BY created DESC"',
          },
          maxResults: {
            type: "number",
            description: "最多回傳筆數（預設 20，最多 50）",
            default: 20,
          },
        },
      },
    },
    {
      name: "jira_transition_issue",
      description: "更改 Jira 工作單狀態（例如：開始、完成、關閉）",
      inputSchema: {
        type: "object",
        required: ["issueKey", "transitionName"],
        properties: {
          issueKey: { type: "string", description: "Issue Key" },
          transitionName: {
            type: "string",
            description: "目標狀態名稱，例如：In Progress、Done、Closed",
          },
        },
      },
    },
    {
      name: "jira_add_comment",
      description: "對 Jira 工作單新增留言",
      inputSchema: {
        type: "object",
        required: ["issueKey", "comment"],
        properties: {
          issueKey: { type: "string", description: "Issue Key" },
          comment: { type: "string", description: "留言內容" },
        },
      },
    },
    {
      name: "jira_get_my_issues",
      description: "取得目前登入者的未完成工作單",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: {
            type: "string",
            description: "限定專案（可選），例如 P26",
          },
          maxResults: { type: "number", default: 20 },
        },
      },
    },
    {
      name: "jira_list_fields",
      description: "列出 Jira 所有欄位（用於查詢 custom field ID）",
      inputSchema: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "篩選關鍵字（比對欄位名稱），例如「史诗」、「Epic」",
          },
        },
      },
    },
  ],
}));

// ── 工具執行 ──────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {
      // ── 列出所有專案 ──
      case "jira_get_projects": {
        const projects = await jiraRequest("GET", "/rest/api/2/project");
        const list = projects
          .map((p) => `• [${p.key}] ${p.name} (${p.projectTypeKey})`)
          .join("\n");
        return {
          content: [
            { type: "text", text: `共 ${projects.length} 個專案：\n\n${list}` },
          ],
        };
      }

      // ── 建立工作單 ──
      case "jira_create_issue": {
        const body = {
          fields: {
            project: { key: args.projectKey },
            summary: args.summary,
            issuetype: { name: args.issueType || "Task" },
            ...(args.description && {
              description: args.description,
            }),
            ...(args.priority && {
              priority: { name: args.priority },
            }),
            ...(args.assignee && {
              assignee: { name: args.assignee },
            }),
            ...(args.labels?.length && { labels: args.labels }),
            ...(args.startDate && {
              customfield_10108: `${args.startDate}T00:00:00.000+0800`,
            }),
            ...(args.endDate && {
              customfield_10109: `${args.endDate}T23:59:00.000+0800`,
            }),
            ...(args.components?.length && {
              components: args.components.map((c) => ({ name: c })),
            }),
            ...(args.epicLink && {
              customfield_10101: args.epicLink,
            }),
            ...(args.implementer && {
              customfield_10111: { name: args.implementer },
            }),
          },
        };
        const result = await jiraRequest("POST", "/rest/api/2/issue", body);
        return {
          content: [
            {
              type: "text",
              text: `✅ 工作單已建立！\n\nKey：${result.key}\nURL：${JIRA_URL}/browse/${result.key}`,
            },
          ],
        };
      }

      // ── 取得工作單 ──
      case "jira_get_issue": {
        const issue = await jiraRequest(
          "GET",
          `/rest/api/2/issue/${args.issueKey}?fields=summary,status,priority,assignee,description,labels,created,updated,comment`,
        );
        const f = issue.fields;
        const comments =
          f.comment?.comments
            ?.slice(-3)
            .map((c) => `  [${c.author.displayName}] ${c.body}`)
            .join("\n") || "  （無留言）";

        const text = [
          `📋 ${issue.key}：${f.summary}`,
          `狀態：${f.status?.name}  優先級：${f.priority?.name}`,
          `指派：${f.assignee?.displayName || "未指派"}`,
          `標籤：${f.labels?.join(", ") || "無"}`,
          `描述：${f.description || "（無）"}`,
          `最近留言：\n${comments}`,
          `URL：${JIRA_URL}/browse/${issue.key}`,
        ].join("\n");

        return { content: [{ type: "text", text }] };
      }

      // ── 更新工作單 ──
      case "jira_update_issue": {
        const fields = {};
        if (args.summary) fields.summary = args.summary;
        if (args.description) fields.description = args.description;
        if (args.priority) fields.priority = { name: args.priority };
        if (args.assignee) fields.assignee = { name: args.assignee };
        if (args.labels) fields.labels = args.labels;
        if (args.components?.length)
          fields.components = args.components.map((c) => ({ name: c }));
        if (args.epicLink) fields.customfield_10101 = args.epicLink;
        if (args.implementer)
          fields.customfield_10111 = { name: args.implementer };

        await jiraRequest("PUT", `/rest/api/2/issue/${args.issueKey}`, {
          fields,
        });
        return {
          content: [
            {
              type: "text",
              text: `✅ ${args.issueKey} 已更新！\nURL：${JIRA_URL}/browse/${args.issueKey}`,
            },
          ],
        };
      }

      // ── JQL 搜尋 ──
      case "jira_search_issues": {
        const maxResults = Math.min(args.maxResults || 20, 50);
        const result = await jiraRequest(
          "GET",
          `/rest/api/2/search?jql=${encodeURIComponent(args.jql)}&maxResults=${maxResults}&fields=summary,status,priority,assignee,labels`,
        );
        if (!result.issues?.length) {
          return { content: [{ type: "text", text: "找不到符合的工作單。" }] };
        }
        const list = result.issues
          .map((i) => {
            const f = i.fields;
            return `• [${i.key}] ${f.summary}\n  狀態：${f.status?.name}  指派：${f.assignee?.displayName || "未指派"}  優先級：${f.priority?.name}`;
          })
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `共找到 ${result.total} 筆（顯示前 ${result.issues.length} 筆）：\n\n${list}`,
            },
          ],
        };
      }

      // ── 更改狀態 ──
      case "jira_transition_issue": {
        const transitions = await jiraRequest(
          "GET",
          `/rest/api/2/issue/${args.issueKey}/transitions`,
        );
        const target = transitions.transitions?.find((t) =>
          t.name.toLowerCase().includes(args.transitionName.toLowerCase()),
        );
        if (!target) {
          const available = transitions.transitions
            ?.map((t) => t.name)
            .join("、");
          return {
            content: [
              {
                type: "text",
                text: `❌ 找不到狀態「${args.transitionName}」\n可用狀態：${available}`,
              },
            ],
          };
        }
        await jiraRequest(
          "POST",
          `/rest/api/2/issue/${args.issueKey}/transitions`,
          { transition: { id: target.id } },
        );
        return {
          content: [
            {
              type: "text",
              text: `✅ ${args.issueKey} 狀態已更新為「${target.name}」`,
            },
          ],
        };
      }

      // ── 新增留言 ──
      case "jira_add_comment": {
        await jiraRequest(
          "POST",
          `/rest/api/2/issue/${args.issueKey}/comment`,
          { body: args.comment },
        );
        return {
          content: [
            {
              type: "text",
              text: `✅ 留言已新增至 ${args.issueKey}`,
            },
          ],
        };
      }

      // ── 我的工作單 ──
      case "jira_get_my_issues": {
        const maxResults = args.maxResults || 20;
        const projectFilter = args.projectKey
          ? ` AND project = ${args.projectKey}`
          : "";
        const jql = `assignee = currentUser()${projectFilter} AND status != Done ORDER BY updated DESC`;
        const result = await jiraRequest(
          "GET",
          `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,priority,labels`,
        );
        if (!result.issues?.length) {
          return {
            content: [
              { type: "text", text: "目前沒有指派給你的未完成工作單。" },
            ],
          };
        }
        const list = result.issues
          .map(
            (i) =>
              `• [${i.key}] ${i.fields.summary}\n  狀態：${i.fields.status?.name}  優先級：${i.fields.priority?.name}`,
          )
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `你的工作單（共 ${result.total} 筆，顯示 ${result.issues.length} 筆）：\n\n${list}`,
            },
          ],
        };
      }

      // ── 列出欄位 ──
      case "jira_list_fields": {
        const fields = await jiraRequest("GET", "/rest/api/2/field");
        const keyword = (args.keyword || "").toLowerCase();
        const filtered = keyword
          ? fields.filter(
              (f) =>
                f.name.toLowerCase().includes(keyword) ||
                f.id.toLowerCase().includes(keyword),
            )
          : fields.filter((f) => f.custom);
        const list = filtered
          .map((f) => `• ${f.id} → ${f.name}${f.custom ? " (custom)" : ""}`)
          .join("\n");
        return {
          content: [
            {
              type: "text",
              text: `共 ${filtered.length} 個欄位：\n\n${list}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `❌ 未知工具：${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `❌ 執行失敗：${err.message}` }],
      isError: true,
    };
  }
});

// ── 啟動 ──────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("✅ Jira MCP Server 已啟動（Basic Auth）\n");
}

main().catch((err) => {
  process.stderr.write(`❌ 啟動失敗：${err.message}\n`);
  process.exit(1);
});
