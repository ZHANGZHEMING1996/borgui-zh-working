# 作业系统架构

## 概览

Borg-UI 使用异步作业（job）系统来执行耗时的 Borg 操作。所有作业遵循一致模式：在数据库中创建作业记录 → 在后台执行 → 跟踪进度 → 更新状态。

## 作业类型

### 1. BackupJob（备份作业）

用途：执行 `borg create`，将源目录备份到仓库。

数据库模型：`backup_jobs` 表
- 跟踪：进度、速度、文件数量、压缩统计
- 关联：`scheduled_jobs`（若由调度触发）

服务实现：`backup_service.py` → `BackupService.execute_backup()`

API 端点示例：
- `POST /api/backup/run` - 启动手动备份
- `GET /api/backup/jobs/{job_id}` - 获取作业状态
- `GET /api/backup/logs/{job_id}` - 流式查看日志

执行流程（概要）：
```python
# 触发方式：
# 1. 手动：用户点击 “Backup Now”
# 2. 调度：Cron 触发

# 处理步骤：
# 1. 在数据库创建 BackupJob（状态：pending）
# 2. asyncio.create_task(execute_backup)
# 3. 运行：borg create --progress --json-lines
# 4. 解析 stdout 中的进度信息（文件、大小、速度）
# 5. 每 1-2 秒更新作业状态
# 6. 标记为 completed 或 failed
# 7. （可选）若配置则执行 prune/compact
# 8. 发送通知
```

进度字段：`progress_percent`、`current_file`、`nfiles`、`original_size`、`compressed_size`、`deduplicated_size`、`backup_speed`（MB/s）。

耗时：取决于数据量，可能为分钟至数小时。

通知：开始、成功、失败。

---

### 2. RestoreJob（恢复作业）

用途：从仓库中提取归档到文件系统。

数据库模型：`restore_jobs` 表
- 跟踪：进度、文件数、当前处理文件
- 存储：仓库、归档、目标路径

服务实现：`restore_service.py` → `RestoreService.execute_restore()`

API 端点示例：
- `POST /api/archives/{archive_id}/restore` - 启动恢复
- `GET /api/restore/jobs/{job_id}` - 获取恢复作业状态

执行流程：
```python
# 触发方式：手动 - 用户在 UI 选择归档并点击 “Restore”

# 处理步骤：
# 1. 在数据库创建 RestoreJob（状态：pending）
# 2. asyncio.create_task(execute_restore)
# 3. 运行：borg extract --progress --list
# 4. 解析 stdout 的进度信息
# 5. 更新作业的文件计数与当前文件
# 6. 标记为 completed/failed
# 7. 发送通知
```

进度字段：`progress_percent`（已恢复文件 / 总文件）、`current_file`、`nfiles`。

耗时：分钟到数小时不等。

通知：成功、失败。

---

### 3. CheckJob（校验作业）

用途：使用 `borg check` 验证仓库完整性。

数据库模型：`check_jobs` 表
- 跟踪：进度、已检查的 segment
- 关联：`repositories` 表
- 支持：通过 `max_duration` 做部分校验

服务实现：`check_service.py` → `CheckService.execute_check()`

API 端点示例：
- `POST /api/repositories/{repo_id}/check` - 启动校验
- `GET /api/repositories/check-jobs/{job_id}` - 获取作业状态
- `GET /api/repositories/{repo_id}/check-jobs` - 列表校验历史

执行流程：
```python
# 触发方式：
# 1. 手动：在仓库界面点击 “Check”
# 2. 调度：周期性触发

# 处理步骤：
# 1. 在数据库创建 CheckJob（状态：pending）
# 2. asyncio.create_task(execute_check)
# 3. 运行：borg check --progress --log-json（可选：--repository-only, --max-duration N）
# 4. 解析 stderr（borg 将进度输出到 stderr）
# 5. 更新作业的进度消息
# 6. 标记为 completed/failed
# 7. 更新 repository.last_check 时间戳
# 8. 发送通知
```

进度字段：`progress`（百分比）、`progress_message`（例如 “Checking segments 45%”）、`max_duration`（用于部分校验）。

耗时：从几秒到数小时（完整校验可能非常耗时）。

通知：成功、失败（当调度校验实现时）。

---

### 4. CompactJob（压缩/回收作业）

用途：使用 `borg compact` 回收仓库未使用空间。

数据库模型：`compact_jobs` 表
- 跟踪：进度、已回收的 segment
- 关联：`repositories` 表

服务实现：`compact_service.py` → `CompactService.execute_compact()`

API 端点示例：
- `POST /api/repositories/{repo_id}/compact` - 启动 compact
- `GET /api/repositories/compact-jobs/{job_id}` - 获取作业状态
- `GET /api/repositories/{repo_id}/compact-jobs` - 列出 compact 历史

执行流程：
```python
# 触发方式：
# 1. 手动：管理员在 UI 点击 “Compact”
# 2. 自动：prune 完成后（若配置 run_compact_after=true）

# 处理步骤：
# 1. 在数据库创建 CompactJob（状态：pending）
# 2. asyncio.create_task(execute_compact)
# 3. 运行：borg compact --progress --log-json
# 4. 解析 stderr 的进度信息
# 5. 更新作业进度
# 6. 标记为 completed/failed
# 7. 更新 repository.last_compact 时间戳
```

进度字段：`progress`、`progress_message`（例如 “Compacting segments 30%”）。

耗时：分钟到数小时。

通知：当前未默认发送（可扩展）。

---

### 5. ScheduledJob（调度定义）

用途：定义基于 cron 的备份调度与可选维护任务。

数据库模型：`scheduled_jobs` 表
- 不是执行用的作业记录，而是调度的配置定义
- 在触发时创建 `BackupJob`

服务实现：`backup_service.py` 中的 cron 调度组件

API 端点示例：
- `GET /api/scheduled-jobs` - 列出所有调度
- `POST /api/scheduled-jobs` - 创建调度
- `PUT /api/scheduled-jobs/{id}` - 更新调度
- `DELETE /api/scheduled-jobs/{id}` - 删除调度

执行流程（调度器）：
```python
# 调度器处理：
# 1. Cron 评估所有已启用的 ScheduledJob 记录
# 2. 当 cron_expression 命中当前时间：
#    - 创建 BackupJob（带 scheduled_job_id）
#    - 执行备份
#    - 若 run_prune_after：执行 prune
#    - 若 run_compact_after：执行 compact
# 3. 更新 last_run 并计算 next_run
```

配置项示例：`cron_expression`、`repository`、`archive_name_template`、`run_prune_after`、`run_compact_after`、保留策略等。

特别说明：ScheduledJob 是唯一不直接代表执行的作业类型，它仅为调度定义。

---

### 6. PackageInstallJob（安装包作业）

用途：通过 apt 安装系统软件包（例如 borg、git、docker 等）。

数据库模型：`package_install_jobs` 表
- 跟踪：包名、安装状态、日志

服务实现：`package_service.py` → `PackageService.install_package()`

API 端点示例：
- `POST /api/system/packages/install` - 请求安装包
- `GET /api/system/packages/jobs/{job_id}` - 查询安装状态

执行流程示例：
```python
# 触发方式：手动 - 在 Packages 页面点击 “Install”

# 处理步骤：
# 1. 在数据库创建 PackageInstallJob（状态：pending）
# 2. asyncio.create_task(install_package)
# 3. 执行：sudo apt-get update && sudo apt-get install -y PACKAGE
# 4. 将输出流写入日志
# 5. 标记为 completed/failed
# 6. 更新数据库中的包状态
```

耗时：秒到数分钟。

---

## 作业生命周期

```text
┌──────────┐
│ Created  │ ← 在数据库插入作业记录
└────┬─────┘
    │
    ▼
┌──────────┐
│ pending  │ ← 等待被调度器或服务拾取
└────┬─────┘
    │
    ▼
┌──────────┐
│ running  │ ← 服务开始执行 borg 命令，通常每 1-2 秒更新一次进度
└────┬─────┘
    │
    ├─────→ ┌────────────┐
    │       │ completed  │ ← 成功（退出码 0）
    │       └────────────┘
    │
    ├─────→ ┌──────────┐
    │       │  failed  │ ← 出错或抛出异常
    │       └──────────┘
    │
    └─────→ ┌────────────┐
          │ cancelled  │ ← 用户取消（仅 RestoreJob 支持）
          └────────────┘
```

## 常见模式

### 所有作业服务共有的要点

1. 数据库会话管理
```python
db = SessionLocal()  # 背景任务使用独立会话
try:
   # ... 执行业务逻辑 ...
finally:
   db.close()
```

2. 状态转换示例
```python
job.status = "running"
job.started_at = datetime.utcnow()
db.commit()
# 执行任务...
job.status = "completed"
job.completed_at = datetime.utcnow()
db.commit()
```

3. 环境变量与进程环境准备
```python
env = os.environ.copy()
if repository.passphrase:
   env['BORG_PASSPHRASE'] = repository.passphrase
env['BORG_RSH'] = 'ssh -o StrictHostKeyChecking=no ...'
```

4. 进程管理
```python
process = await asyncio.create_subprocess_exec(
   *cmd,
   stdout=asyncio.subprocess.PIPE,
   stderr=asyncio.subprocess.PIPE,
   env=env
)
# 保存 PID 以便检测孤儿进程
job.process_pid = process.pid
```

5. 进度解析
- Borg 将 JSON 行输出到 stdout/stderr
- 服务解析这些行并更新 `job.progress_*` 字段
- 不同命令的输出格式不同，需要对应解析器

6. 错误处理
```python
except Exception as e:
   job.status = "failed"
   job.error_message = str(e)
   job.completed_at = datetime.utcnow()
   db.commit()
   logger.error("Job failed", job_id=job.id, error=str(e))
```

## 进度跟踪

### 实时更新

作业通常每 1-2 秒更新一次数据库中的进度：
- 前端默认每 2 秒轮询 `GET /api/.../jobs/{id}`
- 可考虑使用 SSE 或 WebSocket 以减低轮询负担

### 进度类型

百分比型：
- CheckJob：已检查 segment / 总 segment
- CompactJob：已回收 segment / 总 segment
- RestoreJob：已恢复文件 / 总文件

吞吐量型：
- BackupJob：已处理字节数、速度（MB/s）、预计剩余时间

状态型：
- PackageInstallJob：显示 apt 输出日志

## 日志存储

- **实时流式日志**：作业执行期间写入 `/data/logs/{job_id}.log`
- **完成后持久化**：将完整日志保存到 `job.logs` 字段或其它存储
- **保留策略**：可配置（默认保留最近 100 个作业）

## 通知配置

通过 `system_settings` 表进行配置，示例：

```python
notify_on_backup_start = False
notify_on_backup_success = False
notify_on_backup_failure = True
notify_on_restore_success = False
notify_on_restore_failure = True
notify_on_schedule_failure = True
# notify_on_check_success = False  # 计划添加
# notify_on_check_failure = True   # 计划添加
```

通知通道：邮件（SMTP）、Slack webhook、Discord webhook、Ntfy.sh、Apprise（支持 90+ 服务）等。

## 添加新作业类型

### 步骤示例：

1. 在 `app/database/models.py` 添加数据库模型
```python
class MyNewJob(Base):
   __tablename__ = "my_new_jobs"

   id = Column(Integer, primary_key=True)
       repository_id = Column(Integer, ForeignKey("repositories.id"))
       status = Column(String, default="pending")
       started_at = Column(DateTime, nullable=True)
       completed_at = Column(DateTime, nullable=True)
       progress = Column(Integer, default=0)
       error_message = Column(Text, nullable=True)
       logs = Column(Text, nullable=True)
       # ... custom fields ...
       created_at = Column(DateTime, default=utc_now)
   ```

2. **Create Migration** (`app/database/migrations/NNN_add_my_new_job.py`)
   ```python
   def upgrade(connection):
       connection.execute(text("""
           CREATE TABLE my_new_jobs (
               id INTEGER PRIMARY KEY,
               repository_id INTEGER,
               status TEXT,
               ...
           )
       """))
   ```

3. **Create Service** (`app/services/my_new_service.py`)
   ```python
   class MyNewService:
       async def execute_my_operation(self, job_id: int):
           db = SessionLocal()
           try:
               job = db.query(MyNewJob).filter(MyNewJob.id == job_id).first()
               job.status = "running"

               # Execute borg command
               process = await asyncio.create_subprocess_exec(...)

               # Track progress
               # ...

               job.status = "completed"
           except Exception as e:
               job.status = "failed"
               job.error_message = str(e)
           finally:
               db.close()
   ```

4. **Create API Endpoint** (`app/api/repositories.py` or new file)
   ```python
   @router.post("/{repo_id}/my-operation")
   async def start_my_operation(repo_id: int):
       job = MyNewJob(repository_id=repo_id, status="pending")
       db.add(job)
       db.commit()

       asyncio.create_task(my_new_service.execute_my_operation(job.id))

       return {"job_id": job.id, "status": "pending"}
   ```

5. **Add Frontend UI** (Optional)
   - Button to trigger operation
   - Status display
   - Progress indicator

6. **Add Notifications** (Optional)
   - Add settings to SystemSettings model
   - Call notification_service on completion

### Example: Scheduled Checks (Current Task)

Will follow this pattern:
1. ✅ CheckJob model already exists
2. ✅ check_service.py already exists
3. ✅ API endpoints already exist
4. ⚠️ Add: Interval-based scheduler
5. ⚠️ Add: Notification settings
6. ⚠️ Add: Schedule UI in Schedule tab

## Performance Considerations

### Concurrency

- Multiple jobs can run simultaneously
- Each job runs in separate asyncio task
- Database uses SQLite with WAL mode (concurrent reads)
- Borg supports parallel operations to different repos

### Resource Limits

- No hard limit on concurrent jobs
- System limited by: CPU, RAM, I/O, network
- Consider: Rate limiting for package installs
- Consider: Queue system for many simultaneous backups

### Orphan Detection

Problem: If container restarts, running jobs become orphaned

Solution:
- Store `process_pid` and `process_start_time`
- On startup: Check if PIDs still exist
- Mark stale jobs as "failed" with "Container restarted"

Implementation: In `BackupService.__init__()`, `CheckService.__init__()`, etc.

## Testing

### Unit Tests

Test individual components:
- Job model creation
- Service command building
- Progress parsing logic

### Integration Tests

Test full workflow:
- Create job → Execute → Verify completion
- Test with real borg commands
- Test error scenarios

### Manual Testing

- Create jobs via UI
- Monitor progress
- Check logs
- Verify notifications

## Troubleshooting

### Job Stuck in "pending"

**Cause:** Service not running or exception during startup

**Fix:**
1. Check container logs
2. Verify asyncio.create_task() was called
3. Check for exceptions in service

### Job Stuck in "running"

**Cause:** Borg process hung or orphaned

**Fix:**
1. Check process: `ps aux | grep borg`
2. Kill manually: `kill <pid>`
3. Update job status in database

### No Progress Updates

**Cause:** Progress parsing broken or borg not outputting progress

**Fix:**
1. Check logs in `/data/logs/{job_id}.log`
2. Verify borg command includes `--progress`
3. Check stderr parsing logic

### High Memory Usage

**Cause:** Large log accumulation in database

**Fix:**
1. Implement log rotation
2. Store logs in files, not database
3. Clean up old job records

## Future Enhancements

- [ ] WebSocket for real-time progress (eliminate polling)
- [ ] Job queue with priority
- [ ] Retry logic for failed jobs
- [ ] Job templates
- [ ] Webhook support (call external API on job completion)
- [ ] Resource limits per job type
- [ ] Job chains (backup → check → compact)
- [ ] Distributed job execution (multiple workers)

---

## Summary

Borg-UI's job system provides a consistent, asynchronous execution framework for all borg operations. Each job type follows the same lifecycle (pending → running → completed/failed) with real-time progress tracking and notification support. The system is extensible - adding new job types requires implementing a service class and creating database models, following established patterns.
