---
layout: default
title: Notifications
nav_order: 5
description: "Configure alerts via email, Slack, Discord, and 100+ services"
---

# Notifications Setup

Get real-time alerts for backup failures, restore completions, and scheduled job issues via 100+ notification services.

---

## Supported Services

Borg Web UI uses [Apprise](https://github.com/caronc/apprise) for notifications, which supports:

- **Email** (Gmail, Outlook, Yahoo, custom SMTP)
- **Messaging** (Slack, Discord, Telegram, Microsoft Teams, Matrix)
- **Push Notifications** (Pushover, Pushbullet, ntfy)
- **SMS** (Twilio, AWS SNS, Nexmo)
- **Custom Webhooks** (JSON, XML)
- **And 100+ more services**

Full list: [Apprise Supported Notifications](https://github.com/caronc/apprise/wiki)

---

## Quick Start

1. Navigate to **Settings** > **Notifications** tab
2. Click **Add Service**
3. Enter service details:
   - **Name**: Friendly identifier (e.g., "Gmail Alerts", "Slack - DevOps")
   - **Service URL**: Apprise URL format for your service
   - **Title Prefix**: Optional prefix for notification titles (e.g., "[Production]")
   - **Event Triggers**: Select which events should trigger notifications
4. Click **Test** to verify the configuration
5. Click **Add** to save

---

## Service URL Examples


# 通知设置

通过 Borg Web UI，您可以使用 100+ 通知服务接收实时告警，例如备份失败、恢复完成或定时任务异常。

---

## 支持的服务

Borg Web UI 使用 [Apprise](https://github.com/caronc/apprise) 提供通知支持，涵盖：

- **邮件**（Gmail、Outlook、Yahoo、自定义 SMTP）
- **即时消息**（Slack、Discord、Telegram、Microsoft Teams、Matrix）
- **推送通知**（Pushover、Pushbullet、ntfy）
- **短信**（Twilio、AWS SNS、Nexmo）
- **自定义 Webhook**（JSON、XML）
- **以及 100+ 其他服务**

完整列表见： [Apprise Supported Notifications](https://github.com/caronc/apprise/wiki)

---

## 快速入门

1. 打开 **Settings → Notifications** 标签页
2. 点击 **Add Service** 添加新服务
3. 填写服务信息：
   - **Name**：友好名称（例如 “Gmail Alerts”、“Slack - DevOps”）
   - **Service URL**：Apprise 支持的服务 URL 格式
   - **Title Prefix**：通知标题前缀（可选，例如 “[Production]”）
   - **Event Triggers**：选择触发通知的事件类型
4. 点击 **Test** 测试配置是否可用
5. 点击 **Add** 保存配置

---

## 服务 URL 示例

以下为常见服务的示例格式与说明。

### Telegram Bot / 群组示例

**URL 格式：**
```
tgram://bot_token/chat_id
```

**示例：**
```
tgram://123456789:ABCdefGHIjklMNOpqrsTUVwxyz/987654321
```

### Microsoft Teams

**前提：** 需要创建 Incoming Webhook（参阅 Microsoft 文档）

**URL 格式：**
```
msteams://TokenA/TokenB/TokenC/
```

### Pushover

**URL 格式：**
```
pover://user_key@app_token
```

**示例：**
```
pover://uQiRzpo4DXghDmr9QzzfQu27cmVRsG@azGDORePK8gMaC0QOYAMyEEuzJnyUi
```

### ntfy

**URL 格式：**
```
ntfy://topic_name
```

**示例：**
```
ntfy://my-backup-alerts
```

### 自定义 Webhook（JSON）

向自定义端点发送结构化通知以便自动化或集成。

**URL 格式：**
```
jsons://hostname/path/to/endpoint    # HTTPS
json://hostname/path/to/endpoint     # HTTP
```

**示例：**
```
jsons://webhook.site/abc-123-def-456
jsons://myserver.com/api/webhooks/backup-alerts
json://localhost:8080/notifications
```

**常见错误：**
```
json://https://webhook.site/abc-123   ← 错误（重复协议）
https://webhook.site/abc-123          ← Apprise 不接受原始 https:// URL
```

**正确用法：**
```
jsons://webhook.site/abc-123          ← 使用 jsons:// 表示 HTTPS
```

**示例消息体：**
```json
{
  "version": "1.0",
  "title": "✅ Backup Successful",
  "message": "Archive: backup-2026-01-30\n...",
  "type": "success"
}
```

有关 JSON 字段映射与自动化的更多信息，请参阅相应的“通知增强”章节。

---

## 通知事件

可为每个服务配置触发通知的事件类型。

### 备份事件

- **备份成功（Backup Success）** — 当手动或定时备份成功完成时发送。
  - 包含：归档名、仓库、统计信息、完成时间
  - 建议：频繁备份时可关闭，避免通知泛滥

- **备份失败（Backup Failure）** — 备份失败时发送。
  - 包含：仓库名、错误详情、作业 ID
  - 建议：关键仓库始终开启此类通知

### 恢复事件

- **恢复成功（Restore Success）** — 恢复完成时发送，包含归档与目标路径

- **恢复失败（Restore Failure）** — 恢复失败时发送，包含错误详情

### 调度事件

- **调度失败（Schedule Failure）** — 定时任务执行失败时发送，包含调度名称与错误详情
  - 建议：开启此类通知以便及时发现错过的备份

---

## 通知消息格式

以下为常见的通知示例，以便在不同服务中显示友好的信息。

### 成功通知示例

**标题：** `[Production] ✅ Backup Successful`（若设置了标题前缀）

**正文：**
```
Archive: manual-backup-2025-11-23T18:28:30
Repository: /local/backups/important-data

Statistics:
  • Original size: 3.94 GB
  • Compressed size: 3.94 GB
  • Deduplicated size: 245.82 MB

✓ Completed at 2025-11-23 18:28:35 UTC
```

### 失败通知示例

**标题：** `[Production] ❌ Backup Failed`

**正文：**
```
Archive: manual-backup-2025-11-23T18:28:30
Repository: /local/backups/important-data

Error:
  • borg exit code: 2
  • message: Repository not found

✓ Failed at 2025-11-23 18:28:35 UTC
```

    backup_data = json.loads(message)

    print(f"Event: {backup_data['event_type']}")
    print(f"Repository: {backup_data['repository_name']}")
    print(f"Archive: {backup_data['archive_name']}")

    if 'stats' in backup_data:
        original_gb = backup_data['stats']['original_size'] / (1024**3)
        print(f"Size: {original_gb:.2f} GB")

    return backup_data

# Example usage
webhook_data = {
    "title": "✅ Backup Successful - Daily Backup",
    "message": '{"event_type":"backup_success","timestamp":"2026-01-30T12:00:00","repository_name":"my-repo","archive_name":"backup-2026-01-30","stats":{"original_size":1073741824}}',
    "type": "success"
}

backup_data = handle_json_webhook(webhook_data)
```

**Node.js Example:**
```javascript
// For JSON webhooks (json:// or jsons://)
function handleJsonWebhook(webhookPayload) {
    const message = webhookPayload.message || '';

    // Simple JSON parse - no regex needed!
    const backupData = JSON.parse(message);

    console.log(`Event: ${backupData.event_type}`);
    console.log(`Repository: ${backupData.repository_name}`);
    console.log(`Archive: ${backupData.archive_name}`);

    if (backupData.stats) {
        const originalGB = backupData.stats.original_size / (1024**3);
        console.log(`Size: ${originalGB.toFixed(2)} GB`);
    }

    return backupData;
}

// Example usage
const webhookData = {
    title: "✅ Backup Successful - Daily Backup",
    message: '{"event_type":"backup_success","timestamp":"2026-01-30T12:00:00","repository_name":"my-repo","archive_name":"backup-2026-01-30","stats":{"original_size":1073741824}}',
    type: "success"
};

const backupData = handleJsonWebhook(webhookData);
```

**Bash/jq Example:**
```bash
#!/bin/bash
# Parse JSON webhook POST request (for json:// or jsons:// URLs)

# Assuming webhook payload is in $1
# For JSON webhooks, message field contains pure JSON - no extraction needed!
EVENT_TYPE=$(echo "$1" | jq -r '.message | fromjson | .event_type')
REPO=$(echo "$1" | jq -r '.message | fromjson | .repository_name')
ARCHIVE=$(echo "$1" | jq -r '.message | fromjson | .archive_name')
ORIGINAL_SIZE=$(echo "$1" | jq -r '.message | fromjson | .stats.original_size')

echo "Event: $EVENT_TYPE"
echo "Repository: $REPO"
echo "Archive: $ARCHIVE"
echo "Size: $(($ORIGINAL_SIZE / 1024 / 1024 / 1024)) GB"

# Or parse message once and reuse:
BACKUP_DATA=$(echo "$1" | jq -r '.message | fromjson')
echo "Full data: $BACKUP_DATA"
```

#### Service-Specific JSON Formatting

**For JSON Webhooks** (`json://` or `jsons://`):
- The `message` field contains pure JSON string (compact, no markdown)
- Simple to parse: `JSON.parse(payload.message)` in JavaScript, `json.loads(payload['message'])` in Python
- Optimized for automation and monitoring tools

**For Other Services** (Email, Slack, Discord, etc.):
- The `message` field contains formatted notification body with embedded JSON in markdown code blocks
- JSON appears as collapsible `<details>` in email, or code blocks in chat
- Human-readable with pretty-printed JSON (indented)
- Automation tools need regex extraction (see examples for `https://` webhooks below)

#### Extracting JSON from Non-JSON Webhooks

If you're using regular webhooks (`https://`, `form://`, etc.) instead of JSON webhooks, the JSON is embedded in markdown:

**Python Example (for https:// webhooks):**
```python
import re
import json

def extract_json_from_markdown(webhook_payload):
    """Extract JSON from markdown code block in message."""
    message = webhook_payload.get('message', '')

    # Find JSON code block in markdown
    match = re.search(r'```json\n(.*?)\n```', message, re.DOTALL)
    if match:
        return json.loads(match[1])
    return None

backup_data = extract_json_from_markdown(webhook_payload)
```

**Why Two Formats?**

1. **JSON Webhooks** - Optimized for automation (compact JSON, easy parsing)
2. **Other Services** - Optimized for humans (formatted notifications with pretty-printed JSON)

#### Testing JSON Webhooks

**Quick Test Setup:**

1. Go to [webhook.site](https://webhook.site)
2. Copy your unique URL (e.g., `https://webhook.site/abc-123`)
3. In Borg UI → Settings → Notifications → Add Service:
   ```
   Name: JSON Test
   URL: jsons://webhook.site/abc-123
   ✅ Enable notifications
   ✅ Include job/schedule name in title
   ✅ Include JSON data in message body
   ✅ Notify on: Backup Success
   ```
4. Click **Test** or run a backup
5. Check webhook.site to see the full payload

**What You'll See:**
```json
{
  "version": "1.0",
  "title": "🚀 Backup Started - My Backup",
  "message": "**Archive:** backup-2026-01-30...\n\n**📊 JSON Data (for automation)**\n```json\n{\"event_type\": \"backup_start\", ...}\n```",
  "type": "info"
}
```

#### Use Cases

**1. Prometheus/Grafana Monitoring:**
Extract metrics from backup stats:
{% raw %}
```python
stats = backup_data.get('stats', {})
prometheus_metrics = f"""
backup_original_size_bytes{{repo="{repo}"}} {stats['original_size']}
backup_compressed_size_bytes{{repo="{repo}"}} {stats['compressed_size']}
backup_deduplicated_size_bytes{{repo="{repo}"}} {stats['deduplicated_size']}
"""
```
{% endraw %}

**2. Log Aggregation (ELK, Splunk):**
Forward structured events to centralized logging:
```python
import logging
logger.info("Backup completed", extra=backup_data)
```

**3. Alerting Rules:**
Implement custom alert logic:
```python
if backup_data['event_type'] == 'backup_failure':
    if 'lock' in backup_data['error_message'].lower():
        send_page_to_oncall("Backup locked - manual intervention needed")
```

**4. Backup Reporting:**
Generate daily/weekly backup reports:
```python
daily_backups.append({
    'time': backup_data['completed_at'],
    'repo': backup_data['repository_name'],
    'size_gb': backup_data['stats']['original_size'] / (1024**3)
})
```

---

## Best Practices

1. **Test Before Relying** - Always send a test notification before depending on alerts

2. **Enable Failure Notifications** - At minimum, enable backup and schedule failure notifications

3. **Disable Success for Frequent Backups** - If you backup hourly, success notifications create noise

4. **Use Multiple Services** - Configure backup notifications to email AND Slack for redundancy

5. **Set Title Prefixes** - Distinguish notifications from different systems

6. **Monitor "Last Used"** - Check the "Last Used" timestamp periodically to ensure notifications are working

7. **Secure Service URLs** - Notification URLs contain credentials. Keep them secure.

8. **Test After Updates** - Re-test notifications after updating Borg Web UI

---

## Security Considerations

- **Service URLs contain credentials** - Store them securely, don't share publicly
- **Database encryption** - Service URLs are stored in the database; secure the `/data` volume
- **Access controls** - Only admins can configure notifications
- **HTTPS in production** - Use HTTPS/reverse proxy to protect the web interface
- **Webhook authentication** - Use authenticated webhooks when possible (e.g., Discord, Slack)

---

## Advanced Configuration

### Multiple Notification Services

You can add multiple notification services for different purposes:

**Example setup:**
1. **Gmail** - Critical alerts only (backup failures, schedule failures)
2. **Slack** - All events for team visibility
3. **Pushover** - Mobile notifications for urgent issues

### Per-Repository Notifications

Currently, notifications are global for all repositories. To achieve per-repository notifications:

1. Create multiple notification services with descriptive names
2. Use title prefixes to identify the source
3. Manually enable/disable services based on needs

**Future enhancement:** Per-repository notification configuration is planned.

---

## Need Help?

- **Full Apprise Documentation**: [Apprise Wiki](https://github.com/caronc/apprise/wiki)
- **Service-Specific Guides**: [Apprise Notifications](https://github.com/caronc/apprise/wiki#notification-services)
- **GitHub Issues**: [Report problems](https://github.com/karanhudia/borg-ui/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/karanhudia/borg-ui/discussions)
