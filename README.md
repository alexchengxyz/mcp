# MCP Servers（共用）

跨專案共用的 MCP Server 集合。

## 目錄結構

```
mcp/
├── jira/
│   ├── jira-mcp-server.js   # Jira MCP Server 本體
│   ├── .env                  # 認證設定（不追蹤 git）
│   ├── .env.example          # 認證設定範本
│   └── template.md           # Jira 工單填寫模板
├── package.json
└── README.md
```

## 初始設定

```bash
# 1. 安裝依賴
npm install

# 2. 建立 Jira 認證設定
cp jira/.env.example jira/.env
# 編輯 jira/.env 填入實際的 JIRA_URL、JIRA_USERNAME、JIRA_PASSWORD
```

## 在各專案中啟用 Jira MCP

> **前置條件**：請先完成上方「初始設定」步驟，確認 `jira/.env` 已正確填寫。

---

### 🌐 全域設定（一次設定，全部專案適用）

全域設定後，所有專案無需個別設定即可使用 Jira MCP。

#### Antigravity（Gemini）— 全域

編輯 `~/.gemini/antigravity/mcp_config.json`：

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/Users/Bobchen/Desktop/dev/mcp/jira/jira-mcp-server.js"]
    }
  }
}
```

#### Claude Code — 全域

編輯 `~/.claude/mcp_settings.json`（若不存在則新建）：

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/Users/Bobchen/Desktop/dev/mcp/jira/jira-mcp-server.js"]
    }
  }
}
```

設定完成後重啟對應工具，即可在所有專案中使用 Jira 工具。

---

### 📁 專案層級設定（僅套用於特定專案）

若只想在特定專案啟用，在該專案根目錄新建對應設定檔。

#### Claude Code — 專案

編輯專案根目錄下的 `.claude/mcp_settings.json`：

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/Users/Bobchen/Desktop/dev/mcp/jira/jira-mcp-server.js"]
    }
  }
}
```

#### Antigravity（Gemini）— 專案

編輯專案根目錄下的 `.agent/mcp_settings.json`：

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/Users/Bobchen/Desktop/dev/mcp/jira/jira-mcp-server.js"]
    }
  }
}
```

---

### 驗證是否成功啟用

啟動 AI 工具後，在對話中輸入以下指令確認 MCP 正常運作：

```
請列出所有 Jira 專案（使用 jira_get_projects 工具）
```

若回傳專案清單，代表 MCP 已成功連線。若出現錯誤，請確認：

1. `jira/.env` 中的 `JIRA_URL`、`JIRA_USERNAME`、`JIRA_PASSWORD` 是否正確
2. MCP Server 路徑 `/Users/Bobchen/Desktop/dev/mcp/jira/jira-mcp-server.js` 是否存在
3. 是否已在 `mcp/` 目錄下執行過 `npm install`

## 可用 MCP 工具

| 工具名稱                | 說明                 |
| ----------------------- | -------------------- |
| `jira_get_projects`     | 列出所有 Jira 專案   |
| `jira_create_issue`     | 建立新工作單         |
| `jira_get_issue`        | 取得工作單詳細資訊   |
| `jira_update_issue`     | 更新工作單欄位       |
| `jira_search_issues`    | JQL 搜尋工作單       |
| `jira_transition_issue` | 更改工作單狀態       |
| `jira_add_comment`      | 新增留言             |
| `jira_get_my_issues`    | 取得我的未完成工作單 |
| `jira_list_fields`      | 列出所有 Jira 欄位   |

## 新增工單

參考 `jira/template.md` 填寫後交給 AI 執行。
