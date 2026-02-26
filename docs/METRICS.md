# Prometheus Metrics

Borg-UI exposes Prometheus metrics at the `/metrics` endpoint for monitoring and alerting.

## Endpoint
````markdown
# Prometheus 指标

Borg-UI 在 `/metrics` 路径暴露 Prometheus 指标，用于监控与告警。

## 端点

```
GET http://your-borg-ui:8081/metrics
```

**注意：** `/metrics` 端点不需要认证，以便 Prometheus 抓取。

## Prometheus 配置示例

将下列配置加入 `prometheus.yml`：

```yaml
scrape_configs:
  - job_name: 'borg-ui'
    static_configs:
      - targets: ['borg-ui:8081']
    scrape_interval: 60s
```

## Docker Compose 示例

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  borg-ui:
    image: ghcr.io/borgui/borg-ui:latest
    # ... your borg-ui config

volumes:
  prometheus-data:
```

## 可用指标

### 仓库指标 (Repository Metrics)

- `borg_repository_info` - 仓库信息（标签：repository, path, type, mode）
- `borg_repository_size_bytes` - 仓库总大小（字节）
- `borg_repository_archive_count` - 仓库中归档数量
- `borg_repository_last_backup_timestamp` - 最后一次备份的 Unix 时间戳
- `borg_repository_last_check_timestamp` - 最后一次检查的 Unix 时间戳
- `borg_repository_last_compact_timestamp` - 最后一次 compact 的 Unix 时间戳

### 备份任务指标 (Backup Job Metrics)

- `borg_backup_jobs_total` - 备份任务总数（标签：repository, status）
- `borg_backup_orphaned_jobs_total` - 针对被删除/重命名仓库的孤立备份任务（标签：repository_path, status）
- `borg_backup_last_job_success` - 最近一次备份是否成功（1=成功，0=失败）
- `borg_backup_last_duration_seconds` - 最近一次备份耗时（秒）
- `borg_backup_last_original_size_bytes` - 最近一次备份原始大小（字节）
- `borg_backup_last_deduplicated_size_bytes` - 最近一次备份去重后大小（字节）

### 恢复任务指标 (Restore Job Metrics)

- `borg_restore_jobs_total` - 恢复任务总数（标签：status）

### 检查任务指标 (Check Job Metrics)

- `borg_check_jobs_total` - 检查任务总数（标签：repository, status）
- `borg_check_last_duration_seconds` - 最近一次检查耗时（秒）

### Compact 任务指标 (Compact Job Metrics)

- `borg_compact_jobs_total` - compact 任务总数（标签：repository, status）
- `borg_compact_last_duration_seconds` - 最近一次 compact 耗时（秒）

### Prune 任务指标 (Prune Job Metrics)

- `borg_prune_jobs_total` - prune 任务总数（标签：repository, status）

### 系统指标 (System Metrics)

- `borg_ui_repositories_total` - 仓库总数
- `borg_ui_scheduled_jobs_total` - 定时任务总数
- `borg_ui_scheduled_jobs_enabled` - 已启用的定时任务数量
- `borg_ui_active_jobs` - 当前运行的任务数（标签：type）

## 示例查询

### 检查最近一次备份是否成功
```promql
borg_backup_last_job_success{repository="my-repo"} == 0
```

### 距离上次备份时间
```promql
time() - borg_repository_last_backup_timestamp{repository="my-repo"}
```

### 备份耗时趋势
```promql
rate(borg_backup_last_duration_seconds{repository="my-repo"}[1h])
```

### 仓库大小增长
```promql
delta(borg_repository_size_bytes{repository="my-repo"}[24h])
```

### 最近 24 小时失败的备份
```promql
sum(increase(borg_backup_jobs_total{status="failed"}[24h])) by (repository)
```

## 告警示例

### 备份失败告警
```yaml
groups:
  - name: borg_backup_alerts
    rules:
      - alert: BackupFailed
        expr: borg_backup_last_job_success == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Backup failed for {{ $labels.repository }}"
          description: "Last backup job failed for repository {{ $labels.repository }}"

      - alert: BackupOld
        expr: (time() - borg_repository_last_backup_timestamp) > 86400
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "No backup in 24h for {{ $labels.repository }}"
          description: "Repository {{ $labels.repository }} has not been backed up in over 24 hours"

      - alert: BackupSlow
        expr: borg_backup_last_duration_seconds > 3600
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow backup for {{ $labels.repository }}"
          description: "Backup took {{ $value }}s (>1h) for repository {{ $labels.repository }}"
```

## Grafana 仪表盘

可使用现有的 Borg Backup Status 仪表盘作为起点：
https://grafana.com/grafana/dashboards/14516-borg-backup-status

或根据上述指标创建自定义面板。

### 仪表盘示例面板

**仓库大小随时间变化：**
```promql
borg_repository_size_bytes
```

**备份成功率：**
```promql
sum(borg_backup_jobs_total{status="completed"}) by (repository) /
sum(borg_backup_jobs_total) by (repository)
```

**当前活动任务：**
```promql
borg_ui_active_jobs
```

**备份耗时热力图：**
```promql
borg_backup_last_duration_seconds
```

## 故障排查

### 指标端点返回空
- 确认 borg-ui 是否正在运行
- 验证端点： `curl http://borg-ui:8081/metrics`
- 查看 borg-ui 日志以排查错误

### Prometheus 无法抓取
- 验证 Prometheus 与 borg-ui 的网络连通性
- 检查 Prometheus targets 页面： `http://prometheus:9090/targets`
- 确认 borg-ui 端口是否可访问

### 缺失指标
- 指标仅针对已有数据生成
- 至少运行一次备份/检查/compact 后会生成相关指标
- 仓库指标需先创建并同步仓库

````
