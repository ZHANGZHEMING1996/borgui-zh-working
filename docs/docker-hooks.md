# 在备份钩子中管理 Docker 容器

本指南介绍如何在备份的 pre/post 钩子中使用 Docker 管理容器，以便在备份包含数据库或其他有状态应用时保持一致性。

## Table of Contents

- [Why Stop Containers During Backup?](#why-stop-containers-during-backup)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Security Considerations](#security-considerations)
- [Example Scripts](#example-scripts)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 为什么在备份时停止容器？

某些应用在备份前需要停止以保证数据一致性：

- **数据库**（PostgreSQL、MySQL、MongoDB）：防止正在进行的事务导致数据不一致
- **键值存储**（Redis）：保证快照一致性
- **基于文件的数据库**（SQLite）：避免文件被锁定
- **有状态服务**：在备份期间确保干净的状态

替代方案包括使用数据库自身的导出工具（如 `pg_dump`、`mysqldump`）、启用 WAL 归档或调用应用提供的备份 API。但对多数场景而言，停止容器是最简单且可靠的做法。
## 快速开始

### 1. 启用 Docker Socket

编辑 `docker-compose.yml`，确保挂载了 Docker socket：

```yaml
volumes:
    - borg_data:/data:rw
    - borg_cache:/home/borg/.cache/borg:rw
    - ${LOCAL_STORAGE_PATH:-/}:/local:rw
    # 若需在钩子中控制容器，请启用下行挂载：
    - /var/run/docker.sock:/var/run/docker.sock:rw
```

### 2. 重启 Borg UI

```bash
docker-compose down
docker-compose up -d
```

### 3. 配置 pre/post 备份脚本

在 UI 中：
1. 打开 **Repositories**
2. 编辑仓库
3. 展开 **Advanced Settings**
4. 添加你的 pre/post 脚本

## 环境变量（传给钩子脚本）

Borg UI 会在执行 pre/post 钩子时传入上下文环境变量，便于脚本根据备份状态或仓库信息采取不同操作。

### 可用变量

| 变量 | 描述 | 可用时机 |
|------|------|----------|
| `BORG_UI_BACKUP_STATUS` | 备份结果：`success`、`failure` 或 `warning` | 仅 post-backup |
| `BORG_UI_REPOSITORY_NAME` | 仓库名称 | pre & post |
| `BORG_UI_REPOSITORY_PATH` | 仓库路径 | pre & post |
| `BORG_UI_REPOSITORY_ID` | 仓库 ID | pre & post |
| `BORG_UI_HOOK_TYPE` | 钩子类型：`pre-backup` 或 `post-backup` | pre & post |
| `BORG_UI_JOB_ID` | 备份作业 ID | pre & post |

### 示例：根据备份结果执行不同动作（post-backup）

```bash
#!/bin/bash

echo "Backup completed with status: ${BORG_UI_BACKUP_STATUS}"
echo "Repository: ${BORG_UI_REPOSITORY_NAME}"

case "${BORG_UI_BACKUP_STATUS}" in
    success)
        echo "✓ Backup successful!"
        # 发送成功通知
        curl -X POST "https://your-webhook.com/notify" \
            -d "message=Backup of ${BORG_UI_REPOSITORY_NAME} completed successfully"
        ;;
    failure)
        echo "✗ Backup failed!"
        # 发送告警
        curl -X POST "https://your-webhook.com/alert" \
            -d "message=ALERT: Backup of ${BORG_UI_REPOSITORY_NAME} failed!"
        ;;
    warning)
        echo "⚠ Backup completed with warnings"
        # 记录或通知警告
        curl -X POST "https://your-webhook.com/notify" \
            -d "message=Backup of ${BORG_UI_REPOSITORY_NAME} completed with warnings"
        ;;
esac
```

### 示例：仅在备份成功时重启容器

```bash
#!/bin/bash
set -e

CONTAINER_NAME="postgres-db"

if [ "${BORG_UI_BACKUP_STATUS}" = "success" ]; then
        echo "[$(date)] Backup succeeded, restarting ${CONTAINER_NAME}..."
        docker start "${CONTAINER_NAME}"
        echo "[$(date)] ${CONTAINER_NAME} restarted"
else
        echo "[$(date)] Backup status: ${BORG_UI_BACKUP_STATUS}"
        echo "[$(date)] Keeping ${CONTAINER_NAME} stopped for investigation"
        exit 0
fi
```

### 示例：带上下文的日志记录

```bash
#!/bin/bash

LOG_FILE="/var/log/borg-hooks.log"

echo "[$(date)] Hook: ${BORG_UI_HOOK_TYPE}" >> "${LOG_FILE}"
echo "[$(date)] Repository: ${BORG_UI_REPOSITORY_NAME} (ID: ${BORG_UI_REPOSITORY_ID})" >> "${LOG_FILE}"
echo "[$(date)] Job ID: ${BORG_UI_JOB_ID}" >> "${LOG_FILE}"

if [ "${BORG_UI_HOOK_TYPE}" = "post-backup" ]; then
        echo "[$(date)] Status: ${BORG_UI_BACKUP_STATUS}" >> "${LOG_FILE}"
fi
```

## 安全注意

⚠️ **重要**：挂载 `/var/run/docker.sock` 将使容器对 Docker 守护进程拥有完全访问权限，这在主机上等同于 root 权限。

### 安全最佳实践

1. 尽量使用只读挂载：如仅需查看容器信息，则使用 `:ro` 挂载
     ```yaml
     - /var/run/docker.sock:/var/run/docker.sock:ro
     ```

2. 限定容器名称：仅停止/启动特定容器，避免使用 `docker stop $(docker ps -q)` 之类的全量命令

3. 验证脚本：在投产前充分测试脚本逻辑

4. 监控日志：检查备份与钩子日志，确认钩子执行正确

5. 使用 Docker contexts：可在一定程度上限制操作范围

6. 网络隔离：若可能，请将 Borg UI 放在隔离网络中运行

### 不挂载 Docker Socket 的替代方案

若不希望挂载 docker.sock，可考虑：
- 使用数据库自身的备份工具（如 `pg_dump`、`mysqldump`）
- 使用应用提供的 API 触发备份或导出
- 使用 systemd 服务在宿主机上停止/启动容器
- 在宿主机上使用 `docker-compose` 与 cron 调度停止/启动

## 示例脚本

以下示例展示常见的 pre/post 钩子用法。

### 基本：停止/启动单个容器

**Pre-backup 脚本：**
```bash
#!/bin/bash
set -e

# 注意：可在 UI 的 Packages 中安装 docker.io

echo "Stopping postgres-db container..."
docker stop postgres-db

echo "Container stopped successfully"
```

**Post-backup 脚本：**
```bash
#!/bin/bash
set -e

echo "Starting postgres-db container..."
docker start postgres-db

echo "Container started successfully"
```

### 高级：带错误处理的多容器停止

**Pre-backup 脚本：**
```bash
#!/bin/bash
set -e

# 定义要停止的容器
CONTAINERS=("postgres-db" "redis-cache" "mysql-db")

echo "Stopping containers for backup..."
for container in "${CONTAINERS[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
                echo "Stopping ${container}..."
                docker stop -t 30 "${container}"
                echo "✓ ${container} stopped"
        else
                echo "⚠ ${container} not running, skipping"
        fi
done

sleep 5

echo "All containers stopped successfully"
```

**Post-backup 脚本：**
```bash
#!/bin/bash
set -e

CONTAINERS=("postgres-db" "redis-cache" "mysql-db")

echo "Starting containers after backup..."
for container in "${CONTAINERS[@]}"; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
                echo "Starting ${container}..."
                docker start "${container}"

                for i in {1..30}; do
                        if docker inspect --format='{{.State.Status}}' "${container}" | grep -q "running"; then
                                echo "✓ ${container} started"
                                break
                        fi
                        sleep 1
                done
        else
                echo "⚠ ${container} does not exist, skipping"
        fi
done

echo "All containers started successfully"
```

### 数据库特定示例：PostgreSQL checkpoint

**Pre-backup 脚本：**
```bash
#!/bin/bash
set -e

echo "Triggering PostgreSQL checkpoint..."
docker exec postgres-db psql -U postgres -c "CHECKPOINT;"

echo "Stopping postgres-db..."
docker stop postgres-db

echo "PostgreSQL ready for backup"
```

### 带通知的场景

**Pre-backup 脚本：**
```bash
#!/bin/bash
set -e

echo "📢 Starting backup preparation..."

CONTAINERS=("postgres-db" "redis-cache")
for container in "${CONTAINERS[@]}"; do
        docker stop -t 30 "${container}" || echo "⚠ Failed to stop ${container}"
done

echo "✓ Containers stopped, backup will proceed"
```

**Post-backup 脚本：**
```bash
#!/bin/bash
set -e

CONTAINERS=("postgres-db" "redis-cache")
for container in "${CONTAINERS[@]}"; do
        docker start "${container}" || echo "⚠ Failed to start ${container}"
done

echo "✓ Containers restarted after backup"
```

### Docker Compose 集成示例

**Pre-backup 脚本：**
```bash
#!/bin/bash
set -e

echo "Stopping Docker Compose stack..."
cd /path/to/your/compose/directory
docker-compose stop

echo "Stack stopped for backup"
```

**Post-backup 脚本：**
```bash
#!/bin/bash
set -e

echo "Starting Docker Compose stack..."
cd /path/to/your/compose/directory
docker-compose start

echo "Stack restarted after backup"
```

## 故障排查

### 找不到 docker 命令

错误示例：
```
bash: docker: command not found
```

解决办法：容器中未安装 Docker CLI，可通过 UI 安装：

1. 打开 **Settings → Packages**
2. 安装 **docker.io** 包
3. 等待安装完成，之后脚本中将可使用 `docker` 命令

该操作为一次性配置，会在容器重启后保持。

### 权限被拒绝（Permission Denied）

错误示例：
```
permission denied while trying to connect to the Docker daemon socket
```

解决方法：

1. 检查是否正确挂载 docker.sock：
```yaml
volumes:
    - /var/run/docker.sock:/var/run/docker.sock:rw
```

2. 重启 Borg UI 容器：
```bash
docker-compose restart
```

### 容器无法停止

错误示例：
```
Container still running after stop command
```

解决方法：增加优雅停止超时时间：
```bash
docker stop -t 60 container-name  # 等待 60 秒再强制杀掉
```

### 钩子超时

错误示例：
```
Pre-backup hook timed out
```

**Solution:** Hooks have a default timeout (usually 300 seconds). Either:
1. Optimize your script to run faster
2. Reduce the number of containers you stop/start
3. Contact maintainer to increase timeout if needed

### Container Doesn't Restart After Backup

**Problem:** Backup completes but containers stay stopped

**Solution:** Check post-backup script logs in the backup job details. Common issues:
- Script has errors (use `set -e` to catch them)
- Wrong container names
- Containers were removed instead of stopped

**Safety tip:** Always test your post-backup script manually:
```bash
docker exec -it borg-web-ui bash
# Run your post-backup script
bash /path/to/post-backup-script.sh
```

## Best Practices

### 1. Test Scripts Before Production

Always test your scripts manually before enabling them:

```bash
# Enter the container
docker exec -it borg-web-ui bash

# Test pre-backup script
bash -c 'your-pre-backup-script-here'

# Verify containers stopped
docker ps

# Test post-backup script
bash -c 'your-post-backup-script-here'

# Verify containers started
docker ps
```

### 2. Use Graceful Stop Timeouts

Give containers time to shut down gracefully:

```bash
docker stop -t 30 container-name  # 30 second grace period
```

### 3. Log Everything

Add logging to track execution:

```bash
echo "[$(date)] Stopping container: postgres-db"
docker stop postgres-db
echo "[$(date)] Container stopped successfully"
```

### 4. Handle Errors Gracefully

Don't fail the backup if a container is already stopped:

```bash
if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
    docker stop "${container}"
else
    echo "Container ${container} not running, skipping"
fi
```

### 5. Verify Container Health After Restart

```bash
# Start container
docker start postgres-db

# Wait for health check
for i in {1..30}; do
    if docker inspect --format='{{.State.Health.Status}}' postgres-db | grep -q "healthy"; then
        echo "Container healthy"
        break
    fi
    sleep 2
done
```

### 6. Use Container Labels

Tag containers that should be stopped for backups:

```yaml
# In your container's docker-compose.yml
labels:
  - "backup.stop=true"
```

Then in your script:
```bash
# Stop all containers with backup.stop label
docker ps --filter "label=backup.stop=true" --format "{{.Names}}" | \
    xargs -r docker stop -t 30
```

### 7. Consider Downtime Windows

Schedule backups during low-usage periods to minimize impact:
- Use cron schedules in Borg UI (e.g., 2 AM daily)
- Stop containers only for critical backups
- Use database dump tools for hot backups

### 8. Monitor Backup Logs

Always check the backup logs after enabling hooks:
1. Go to **Dashboard** → **Backup Jobs**
2. Click on a completed job
3. Scroll to **Hook Execution** section
4. Verify pre/post scripts executed successfully

## Example: Complete PostgreSQL Backup Setup

This is a production-ready example for backing up a PostgreSQL container:

**Pre-backup script:**
```bash
#!/bin/bash
set -e

# Configuration
CONTAINER_NAME="postgres-db"
STOP_TIMEOUT=30

# Note: Install docker.io package from Settings → Packages if not already installed

echo "[$(date)] Starting pre-backup hook for ${CONTAINER_NAME}"

# Check if container exists and is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    # Trigger PostgreSQL checkpoint for clean shutdown
    echo "[$(date)] Triggering PostgreSQL checkpoint..."
    docker exec "${CONTAINER_NAME}" psql -U postgres -c "CHECKPOINT;" || echo "Warning: Checkpoint failed"

    # Stop container gracefully
    echo "[$(date)] Stopping ${CONTAINER_NAME} (${STOP_TIMEOUT}s timeout)..."
    docker stop -t ${STOP_TIMEOUT} "${CONTAINER_NAME}"

    echo "[$(date)] ${CONTAINER_NAME} stopped successfully"
else
    echo "[$(date)] ${CONTAINER_NAME} not running, backup will proceed anyway"
fi

echo "[$(date)] Pre-backup hook completed"
```

**Post-backup script:**
```bash
#!/bin/bash
set -e

# Configuration
CONTAINER_NAME="postgres-db"
HEALTH_CHECK_TIMEOUT=60

echo "[$(date)] Starting post-backup hook for ${CONTAINER_NAME}"

# Check if container exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    # Start container
    echo "[$(date)] Starting ${CONTAINER_NAME}..."
    docker start "${CONTAINER_NAME}"

    # Wait for container to be running
    echo "[$(date)] Waiting for ${CONTAINER_NAME} to be ready..."
    for i in $(seq 1 ${HEALTH_CHECK_TIMEOUT}); do
        if docker inspect --format='{{.State.Status}}' "${CONTAINER_NAME}" | grep -q "running"; then
            echo "[$(date)] ${CONTAINER_NAME} is running"

            # Wait for PostgreSQL to accept connections
            sleep 5
            if docker exec "${CONTAINER_NAME}" pg_isready -U postgres > /dev/null 2>&1; then
                echo "[$(date)] ${CONTAINER_NAME} is ready to accept connections"
                break
            fi
        fi
        sleep 1
    done

    echo "[$(date)] ${CONTAINER_NAME} started successfully"
else
    echo "[$(date)] Warning: ${CONTAINER_NAME} does not exist"
fi

echo "[$(date)] Post-backup hook completed"
```

## Related Documentation

- [Pre/Post Backup Scripts](./backup-hooks.md) - General hook documentation
- [Installation Guide](../docs/installation.md) - Setting up Borg UI
- [Repository Configuration](./repositories.md) - Configuring repositories

## Support

If you encounter issues with Docker hooks:
1. Check the backup job logs in the UI
2. Test your scripts manually in the container
3. Review the [troubleshooting section](#troubleshooting)
4. Open an issue on [GitHub](https://github.com/karanhudia/borg-ui/issues) with:
   - Your docker-compose.yml (sanitized)
   - Your pre/post backup scripts
   - Relevant log output
