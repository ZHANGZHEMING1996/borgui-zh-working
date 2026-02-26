---
layout: default
title: Configuration
nav_order: 3
description: "Environment variables, volumes, and settings"
---
 
# 配置指南

根据你的环境自定义 Borg Web UI。

---

## 自动配置的设置

以下项会在首次运行时自动配置 —— 无需手动设置：

| 设置 | 自动配置 |
|------|----------|
| **SECRET_KEY** | 随机生成（32 字节），并持久化到 `/data/.secret_key` |
| **DATABASE_URL** | 使用 SQLite，路径为 `/data/borg.db`（包含加密的 SSH 密钥） |
| **JOB_LOGS** | 存储在 `/data/logs/`（如 backup_job_*.log、check_job_*.log、compact_job_*.log） |
| **SSH_KEYS_DIR** | `/data/ssh_keys`（用于 SSH 操作期间的临时文件） |

**注意：** 应用日志（FastAPI、uvicorn）会输出到 Docker 日志（stdout/stderr），可使用 `docker logs borg-web-ui` 查看。

---

## 环境变量

### 端口配置

```yaml
environment:
  - PORT=8082  # 默认：8081
```

访问地址：`http://localhost:8082`

### 用户/组 ID

为避免权限问题，请将容器使用的 UID/GID 与宿主机用户匹配：

```yaml
environment:
  - PUID=1000  # 你的用户 ID
  - PGID=1000  # 你的组 ID
```

获取你的 ID：
```bash
id -u  # 用户 ID
id -g  # 组 ID
```

**常见 ID：**
- Linux/Raspberry Pi: `1000:1000`
- Unraid: `99:100`
- macOS: `501:20`

**注意：** 当 `PUID=0`（以 root 运行）时，SSH 密钥会自动从 `/root/.ssh` 建立到 `/home/borg/.ssh` 的符号链接。

### 日志级别

```yaml
environment:
  - LOG_LEVEL=DEBUG  # 默认：INFO
  # 可选值：DEBUG、INFO、WARNING、ERROR
```

### 初始管理员密码

可在首次运行时通过环境变量设置管理员初始密码：

```yaml
environment:
  - INITIAL_ADMIN_PASSWORD=your-secure-password
```

**注意：** 如果不设置，默认密码为 `admin123`，首次登录时会提示你修改密码。

### 反向代理 / `BASE_PATH`

{: .new }
> **在某版本中新增**：支持通过 `BASE_PATH` 在子路径下部署

如果要在反向代理的子路径中运行 Borg Web UI：

```yaml
environment:
  - BASE_PATH=/borg  # 在 example.com/borg/ 下访问
```

**重要说明：**
- 修改此项后需重建镜像：`docker-compose up -d --build`
- 必须以 `/` 开头且不能以 `/` 结尾
- 默认为 `/`（根路径）

示例：
- `/borg` → 在 `example.com/borg/` 访问
- `/backup-ui` → 在 `example.com/backup-ui/` 访问
- `/` → 在 `example.com/` 访问（默认）

有关 Nginx、Traefik、Caddy、Apache 的完整反向代理配置示例，请参见 `reverse-proxy.md`。

### 文件浏览器挂载点

{: .new }
> **在某版本中新增**：`LOCAL_MOUNT_POINTS` 用于改进文件浏览器导航

指定哪些容器路径是宿主机挂载点，以便在文件浏览器中突出显示：

```yaml
environment:
  - LOCAL_MOUNT_POINTS=/local  # 默认
```

**作用说明：**
- 在文件浏览器中用 💾 图标和 **"Host"** 标签突出显示宿主机挂载点
- 便于识别数据实际所在的位置
- 类似于 SSH 挂载点会显示 **"Remote"** 标签

**自定义示例：**

```yaml
# 单个挂载（默认）
volumes:
  - /:/local:rw
environment:
  - LOCAL_MOUNT_POINTS=/local

# 多个挂载（逗号分隔）
volumes:
  - /home/john:/mylocalserver:rw
  - /mnt/nas:/nas:rw
environment:
  - LOCAL_MOUNT_POINTS=/mylocalserver,/nas

# 不突出显示（空字符串）
environment:
  - LOCAL_MOUNT_POINTS=
```

在文件浏览器中：
- 💾 `/local` **[Host]** - 标记为宿主机挂载
- 🌐 `/mnt/ssh-connection` **[Remote]** - SSH 挂载点
- 📦 `/backups/repo1` **[Borg]** - Borg 仓库
- 📁 `/data` - 常规目录

---

## 卷挂载

### 应用数据

**必须的卷：**

```yaml
volumes:
  - borg_data:/data                       # 应用数据
  - borg_cache:/home/borg/.cache/borg    # Borg 缓存
```

**/data 中存储的内容：**
- SQLite 数据库（包含加密的 SSH 密钥）
- 作业日志（备份、检查、压缩等）存放在 `/data/logs/`
- 自动生成的 `SECRET_KEY`
- 部署/测试期间的临时 SSH 密钥文件位于 `/data/ssh_keys/`

### 文件系统访问

**⚠️ 重要安全提示**

容器需要访问你希望备份的目录。**生产环境中应仅挂载必要的特定目录**：

```yaml
volumes:
  # ✅ 推荐：仅挂载特定目录
  - /home/yourusername:/local:rw      # 将此处替换为你的路径
  - /mnt/data:/local/data:rw          # 其他目录

  # ❌ 不建议：挂载整个文件系统
  # - /:/local:rw  # 仅用于开发/测试，生产环境避免
```

**为何要限制文件系统访问？**
- 降低安全风险（最小权限原则）
- 防止意外访问敏感系统文件
- 明确哪些目录被备份，便于排查权限问题

### 挂载示例模式

**个人电脑：**
```yaml
volumes:
  - borg_data:/data
  - borg_cache:/home/borg/.cache/borg
  - /home/john:/local:rw              # 挂载主目录
```

**包含多个目录的服务器：**
```yaml
volumes:
  - borg_data:/data
  - borg_cache:/home/borg/.cache/borg
  - /var/www:/local/www:ro            # 网站文件（只读）
  - /home/appuser:/local/app:rw       # 应用数据
  - /var/lib/postgresql:/local/db:rw  # 数据库目录
```

**NAS 备份（Unraid/TrueNAS）：**
```yaml
volumes:
  - borg_data:/data
  - borg_cache:/home/borg/.cache/borg
  - /mnt/user/Documents:/local:ro     # 文档（只读）
  - /mnt/user/Media:/local/media:ro   # 媒体文件
  - /mnt/backup:/local/backup:rw      # 备份目标
```

**最佳实践：**
- 单目录场景使用简单的 `/local` 挂载
- 多目录使用 `/local/subdir` 模式
- 对于仅备份无需恢复的目录使用 `:ro`
- 如果在本地存储仓库则将备份目标挂载为 `:rw`

---

## 自定义卷位置

将应用数据存放在指定位置：

```yaml
volumes:
  borg_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/storage/borg-data

  borg_cache:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/storage/borg-cache
```

---

## 仓库配置

**重要：** 仓库通过网页界面配置，而不是通过 Docker 卷。

支持的仓库类型：
- **本地路径**：`/local/backups/my-repo`、`/backups/my-repo`
- **SSH/SFTP**：`user@host:/path/to/repo`
- **云存储**：通过 rclone（S3、Azure、Google Cloud）

无需单独创建 `borg_backups` 卷！

---

## 网络配置

### 使用反向代理

Borg Web UI 支持通过反向代理的根域名或子路径部署。

**示例（Nginx 根域名）：**

```nginx
server {
    listen 80;
    server_name backups.example.com;

    location / {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket/SSE 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

**关于完整的反向代理设置（包括：）**
- 子路径部署（例如 `example.com/borg/`）
- Nginx、Traefik、Caddy、Apache 的配置示例
- SSL/HTTPS 设置
- Docker 网络集成
- 故障排查

See the **[Reverse Proxy Setup Guide](reverse-proxy.md)**

### Custom Network

```yaml
networks:
  borg-network:
    driver: bridge

services:
  borg-ui:
    networks:
      - borg-network
```

---

## Performance Tuning

### For Large Repositories

{: .new }
> **New in vX.Y.Z**: Configurable operation timeouts for very large repositories

Increase Borg cache size by mounting to fast storage:

```yaml
volumes:
  - /path/to/ssd/borg-cache:/home/borg/.cache/borg
```

#### Operation Timeouts for Very Large Repositories

For repositories with:
- Multi-terabyte deduplicated size
- Hundreds of archives
- Long cache build times on first access

You can configure operation timeouts via **two methods**:

##### Method 1: Web UI (Recommended)

Go to **Settings → System** to configure timeouts with a user-friendly interface:

| Setting | Description | Default |
|---------|-------------|---------|
| Mount Timeout | Time to wait for archive mounts | 120s (2 min) |
| Info Timeout | Borg info operations (verification, stats) | 600s (10 min) |
| List Timeout | Listing archives and files | 600s (10 min) |
| Init Timeout | Creating new repositories | 300s (5 min) |
| Backup/Restore Timeout | Backup and restore operations | 3600s (1 hour) |

**Advantages of UI configuration:**
- No container restart required
- Changes take effect immediately
- Easier to adjust on-the-fly

##### Method 2: Environment Variables

Set timeouts via Docker environment variables:

```yaml
environment:
  # Borg operation timeouts (in seconds)
  - BORG_INFO_TIMEOUT=7200      # 2 hours for borg info (default: 600 = 10 min)
  - BORG_LIST_TIMEOUT=3600      # 1 hour for borg list (default: 600 = 10 min)
  - BORG_INIT_TIMEOUT=900       # 15 min for borg init (default: 300 = 5 min)
  - BORG_EXTRACT_TIMEOUT=7200   # 2 hours for restore (default: 3600 = 1 hour)
  - SCRIPT_TIMEOUT=300          # 5 min for hooks (default: 120 = 2 min)
```

##### Priority Order

The system checks settings in the following order:

| Priority | Source | Notes |
|----------|--------|-------|
| 1 (Highest) | UI Settings (Settings → System) | Stored in database, persists across restarts |
| 2 | Environment Variables | Used if no UI setting is configured |
| 3 | Built-in Defaults | Used if neither UI nor env vars are set |

**How it works:** If you set a timeout in the UI, that value is used. If you haven't configured a UI setting for a particular timeout, the environment variable is used. Both approaches are valid - use whichever fits your workflow better.

**Timeout Usage Reference:**

| Operation | When Used | Default | Recommended for Large Repos |
|-----------|-----------|---------|------------------------------|
| Mount | Mounting archives for browsing | 2 min | 5-10 min (10TB+ repos) |
| Info | Repository verification, stats, import | 10 min | 1-4 hours (based on cache build time) |
| List | Listing archives/files, restore browser | 10 min | 30-60 min |
| Init | Creating new repositories | 5 min | 10-15 min |
| Backup/Restore | Backup and restore operations | 1 hour | 2-4 hours |

**Example for very large repository (via UI):**
1. Go to **Settings → System**
2. Under "Operation Timeouts", set:
   - Mount Timeout: 600 (10 minutes)
   - Info Timeout: 7200 (2 hours)
   - List Timeout: 3600 (1 hour)
3. Click **Save Settings**

**Symptoms you need higher timeouts:**
- "Repository verification timed out" during import
- "Mount timeout" errors when browsing archives
- Operations fail with timeout errors in logs
- Large operations (info/list) succeed when run manually but fail in UI

### For Raspberry Pi / Low Memory

```yaml
environment:
  - WORKERS=1  # Reduce concurrent workers
```

---

## Redis Cache Configuration

{: .new }
> **New in vX.Y.Z**: Redis-based archive caching for 600x faster browsing

Borg Web UI includes Redis caching for dramatically faster archive browsing. Without cache, navigating folders in large archives (1M+ files) takes 60-90 seconds. With cache, it takes less than 100ms.

### Default Setup (Local Redis)

Redis is included in `docker-compose.yml` - no configuration needed.

```yaml
# Already configured in docker-compose.yml
redis:
  image: redis:7-alpine
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

**Manage via UI:**
- Go to **Settings → Cache** tab
- View statistics, configure TTL/size, clear cache
- Default: 2-hour TTL, 2GB size limit

### External Redis (For Large Repositories)

Connect to Redis on a separate machine with more RAM:

```yaml
# docker-compose.yml
services:
  app:
    environment:
      # External Redis URL (can also configure via Settings → Cache in UI)
      - REDIS_URL=redis://192.168.1.100:6379/0

      # Or with password
      # - REDIS_URL=redis://:password@192.168.1.100:6379/0

      # Or with Unix socket (when Redis and Borg UI are on same system)
      # - REDIS_URL=unix:///run/redis-socket/redis.sock?db=0&password=password

      # Cache settings
      - CACHE_TTL_SECONDS=7200    # 2 hours
      - CACHE_MAX_SIZE_MB=2048    # 2GB
```

**When to use external Redis:**
- Repositories with 5M+ files
- Multiple large archives
- Limited RAM on Borg Web UI host
- NAS/workstation with spare RAM available

**Full setup guide with examples:** [Cache Configuration](cache)

---

## Security Configuration

### Change SECRET_KEY

The SECRET_KEY is auto-generated on first run. To rotate it:

```bash
docker exec borg-web-ui rm /data/.secret_key
docker restart borg-web-ui
```

**Note:** This invalidates all user sessions.

### Enable HTTPS

Use a reverse proxy (Nginx, Traefik, Caddy) with Let's Encrypt certificates.

**Never expose the application directly to the internet without HTTPS.**

### Restrict Access

**Using firewall:**
```bash
# Allow only from local network
sudo ufw allow from 192.168.1.0/24 to any port 8081
```

**Using Docker:**
```yaml
ports:
  - "127.0.0.1:8081:8081"  # Only accessible from localhost
```

Then access via reverse proxy or SSH tunnel.

---

## Backup Configuration Data

### Backup Application Data

```bash
# Backup borg_data volume
docker run --rm \
  -v borg_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/borg-data-backup.tar.gz -C /data .
```

### Restore Application Data

```bash
# Restore borg_data volume
docker run --rm \
  -v borg_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/borg-data-backup.tar.gz -C /data
```

---

## Example Configurations

### Basic Home Setup

```yaml
version: '3.8'

services:
  borg-ui:
    image: ainullcode/borg-ui:latest
    container_name: borg-web-ui
    restart: unless-stopped
    ports:
      - "8081:8081"
    volumes:
      - borg_data:/data
      - borg_cache:/home/borg/.cache/borg
      - /home/yourusername:/local:rw  # Replace with your home directory
    environment:
      - PUID=1000
      - PGID=1000

volumes:
  borg_data:
  borg_cache:
```

### Production Setup with Restricted Access

```yaml
version: '3.8'

services:
  borg-ui:
    image: ainullcode/borg-ui:latest
    container_name: borg-web-ui
    restart: unless-stopped
    ports:
      - "127.0.0.1:8081:8081"  # Only localhost
    volumes:
      # Application data
      - borg_data:/data
      - borg_cache:/home/borg/.cache/borg

      # Backup sources (read-only)
      - /var/www:/local/www:ro
      - /home/appuser:/local/app:ro

      # Backup destination
      - /mnt/backups:/local/backup:rw
    environment:
      - PUID=1000
      - PGID=1000
      - LOG_LEVEL=INFO
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.borg-ui.rule=Host(`backups.example.com`)"
      - "traefik.http.routers.borg-ui.tls=true"

volumes:
  borg_data:
  borg_cache:
```

### NAS Setup (Unraid/TrueNAS)

```yaml
services:
  borg-ui:
    image: ainullcode/borg-ui:latest
    container_name: borg-web-ui
    restart: unless-stopped
    ports:
      - "8081:8081"
    volumes:
      - /mnt/user/appdata/borg-ui:/data
      - /mnt/user/appdata/borg-ui/cache:/home/borg/.cache/borg
      - /mnt/user/Documents:/local:ro         # Documents share
      - /mnt/user/Media:/local/media:ro       # Media share
      - /mnt/user/Backups:/local/backup:rw    # Backup destination
    environment:
      - PUID=99
      - PGID=100
```

---

## Troubleshooting

### Database Locked Error

If multiple containers are using the same database:

```bash
# Stop all containers
docker stop borg-web-ui

# Check for locks
docker exec borg-web-ui ls -la /data/

# Restart
docker start borg-web-ui
```

### Permission Issues

Verify PUID/PGID match your host user:

```bash
# Check file ownership
docker exec borg-web-ui ls -la /data/

# Check container user
docker exec borg-web-ui id

# Fix ownership if needed
docker exec borg-web-ui chown -R borg:borg /data
```

### High Memory Usage

Reduce Borg cache or move to disk-based cache:

```yaml
volumes:
  - /path/to/slower/storage:/home/borg/.cache/borg
```

---

## Next Steps

- [Cache Configuration](cache.md) - Set up external Redis for 600x faster browsing
- [Notifications Setup](notifications.md) - Configure alerts
- [SSH Keys Guide](ssh-keys.md) - Set up remote backups
- [Usage Guide](usage-guide.md) - Create your first backup
