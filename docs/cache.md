---
layout: default
title: 缓存 配置
nav_order: 7
description: "为归档浏览配置 Redis 缓存，可实现约 600 倍的速度提升"
---

# 归档 缓存 配置

{: .no_toc }

Borg Web UI 使用基于 Redis 的缓存，大幅提升在大型归档中浏览的性能。没有缓存时，在包含 100 万+ 文件的仓库中浏览文件夹可能需要 60-90 秒；使用缓存后，响应时间可低于 100ms（约 600 倍加速）。

---

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## 快速开始

**Complete docker-compose.yml with Redis:**

```yaml
version: '3.8'
      # Redis connection (uses redis service below)
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_DB=0
      # Cache defaults (override in Settings → Cache UI)
      - CACHE_TTL_SECONDS=7200
      - CACHE_MAX_SIZE_MB=2048
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - borg_network

  redis:
    image: redis:7-alpine
    container_name: borg-redis
    restart: unless-stopped
    command: >
      redis-server
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
      --save ""
      --appendonly no
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - borg_network

networks:
  borg_network:
    driver: bridge

volumes:
  borg_data:
    driver: local
  borg_cache:
    driver: local
```

启动：`docker compose up -d`

然后在 **Settings → Cache** 选项卡中配置缓存设置。

---

## 快速要点

 - **性能：** 文件夹导航从 60-90 秒 → <100ms
 - **默认设置：** 缓存 TTL 2 小时，最大大小 2GB
 - **后端支持：** 外部 Redis → 本地 Redis（Docker）→ 内存回退
 - **配置方式：** 通过 UI（Settings → Cache）或环境变量

---

## 工作原理

当您浏览归档时，Borg Web UI 会运行 `borg list` 来解析整个归档内容。对于大型归档，这个过程会很慢：

| Archive Size | Files | Without Cache | With Cache (after first load) |
|-------------|-------|---------------|--------------------------------|
| Small | 1,000 | ~1 second | <100ms |
| Medium | 100,000 | ~10 seconds | <100ms |
| Large | 1,000,000 | 60-90 seconds | <100ms |
| Very Large | 10,000,000 | 10-15 minutes | <1 second |

**缓存策略：**
 - 第一次浏览归档：执行完整的 `borg list`（构建缓存）
 - 后续浏览：从缓存即时读取
 - 缓存条目在 TTL 到期后失效（默认：2 小时）
 - 若超出大小限制，缓存将按 LRU 策略自动清理

---

## 缓存后端

### 1. 本地 Redis（默认）

Included in `docker-compose.yml` - no setup needed.

**Pros:**
- Zero configuration
- Persistent across app restarts
- Works out of the box

**Cons:**
- Limited to container's memory allocation
- Shares resources with app container

**Configuration:**
```yaml
# docker-compose.yml (already configured)
redis:
  image: redis:7-alpine
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

### 2. 外部 Redis（建议用于大型仓库）

Connect to Redis running on a separate machine with more RAM.

**Pros:**
- Dedicated resources (more RAM available)
- Can be shared across multiple Borg Web UI instances
- Better performance for very large repositories

**Cons:**
- Requires separate Redis setup
- Network latency (minimal if on same network)

**Use cases:**
- Repositories with 1M+ files
- Multiple archive browsing sessions
- Server with limited RAM but NAS/workstation with spare RAM

### 3. 内存回退

Python OrderedDict with LRU eviction - used when Redis unavailable.

**Pros:**
- No external dependencies
- Automatic fallback

**Cons:**
- Lost on app restart
- Limited capacity
- Not persistent

---

## 设置外部 Redis

### 方案 1：在另一台机器上使用 Docker

**On your NAS/server (192.168.1.100):**

```bash
# Create docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: redis-cache
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: >
      redis-server
      --maxmemory 8gb
      --maxmemory-policy allkeys-lru
      --save ""
      --appendonly no
    volumes:
      - redis_data:/data

volumes:
  redis_data:
EOF

# Start Redis
docker compose up -d

# Test connection (from Redis host)
docker exec redis-cache redis-cli ping
# Should return: PONG
```

**Configure in Borg Web UI:**
1. Go to **Settings → Cache**
2. Enter: `redis://192.168.1.100:6379/0`
3. Click **Save Settings**

### 方案 2：使用密码保护的 Docker Redis

**On remote server:**

```bash
# Generate strong password
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "Redis password: $REDIS_PASSWORD"

# Start Redis with password
docker run -d \
  --name redis-cache \
  --restart unless-stopped \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server \
  --requirepass "$REDIS_PASSWORD" \
  --maxmemory 8gb \
  --maxmemory-policy allkeys-lru
```

**Configure in Borg Web UI:**
```
redis://:YOUR_PASSWORD@192.168.1.100:6379/0
```

Replace `YOUR_PASSWORD` with the generated password (note the colon before password).

### 方案 3：独立安装 Redis

**Ubuntu/Debian:**
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
```

Edit these settings:
```conf
# Allow remote connections (change from 127.0.0.1)
bind 0.0.0.0

# Set memory limit
maxmemory 8gb
maxmemory-policy allkeys-lru

# Disable persistence (optional, for cache-only use)
save ""
appendonly no

# Optional: Enable password
requirepass your-strong-password-here
```

```bash
# Restart Redis
sudo systemctl restart redis-server

# Test connection
redis-cli -h localhost ping
# Should return: PONG
```

**Configure in Borg Web UI:**
- Without password: `redis://192.168.1.100:6379/0`
- With password: `redis://:your-strong-password-here@192.168.1.100:6379/0`

### 方案 4：云端 Redis 服务

#### AWS ElastiCache
```bash
# After creating ElastiCache Redis cluster
# Use the Primary Endpoint from AWS console
redis://my-cluster.abc123.cache.amazonaws.com:6379/0
```

#### Azure Cache for Redis
```bash
# Get connection string from Azure Portal
redis://:YOUR_ACCESS_KEY@my-cache.redis.cache.windows.net:6379/0
```

#### Redis Cloud (Free Tier Available)
```bash
# Sign up at https://redis.com/try-free/
# Get connection URL from dashboard
redis://default:password@redis-12345.c123.us-east-1.cloud.redislabs.com:12345/0
```

### 方案 5：TLS/SSL 连接

For encrypted connections, use `rediss://` (note the extra 's'):

```bash
# AWS ElastiCache with TLS
rediss://my-cluster.abc123.cache.amazonaws.com:6379/0

# Custom Redis with TLS certificate
rediss://:password@secure-redis.example.com:6380/0
```

### 方案 6：Unix 套接字连接

For connecting to Redis via Unix socket (useful when Redis and Borg UI are on the same system):

**Docker Compose Configuration:**

```yaml
services:
  borg-ui:
    image: ainullcode/borg-ui:latest
    container_name: borg-ui
    volumes:
      - /path/to/redis/socket:/run/redis-socket # Ensure container has necessary privileges to access socket

  redis-borg-ui:
    image: redis:latest
    container_name: redis-borg-ui
    network_mode: none
    volumes:
      - /path/to/redis/socket:/run/redis-socket
      - /path/to/redis.conf:/etc/redis.conf
    command: redis-server /etc/redis.conf
```

**Redis Configuration (`redis.conf`):**

```conf
# Use Unix socket
unixsocket /run/redis-socket/redis.sock
unixsocketperm 660
port 0

# Enable password (optional)
requirepass mypassword

# Set memory limit
maxmemory 8gb
maxmemory-policy allkeys-lru
```

**Configure in Borg Web UI:**
- Go to **Settings → Cache**
- Enter: `unix:///run/redis-socket/redis.sock?db=0[&password=mypassword]`
- Click **Save Settings**

**Note:** Ensure the Borg UI container has the necessary privileges and volume mounts to access the Unix socket file.

---

## 通过 UI 配置

### Settings → Cache 选项卡

**Cache Status:**
- Backend type (Redis/In-Memory)
- Connection info (host:port, type)
- Cached archives count
- Memory usage with progress bar
- Hit rate statistics

**Configuration:**
- **Cache TTL:** 1 minute to 7 days (default: 2 hours)
- **Max Cache Size:** 100 MB to 10 GB (default: 2 GB)
- **External Redis URL:** Optional external Redis connection
- **Clear Cache:** Manual cache clearing for testing/troubleshooting

### 配置选项

| Setting | Range | Default | Notes |
|---------|-------|---------|-------|
| Cache TTL | 1-10080 minutes | 120 (2 hours) | Only affects new entries |
| Max Size | 100-10240 MB | 2048 (2 GB) | Enforced by LRU eviction |
| Redis URL | Valid Redis URL | Empty (use local) | Takes precedence over env vars |

---

## 通过环境变量配置

Alternative to UI configuration - useful for initial setup or automation.

```yaml
# docker-compose.yml
services:
  app:
    environment:
      # Option 1: External Redis URL (highest priority)
      # Takes precedence over host/port settings
      - REDIS_URL=redis://192.168.1.100:6379/0

      # Option 2: Local Redis connection details
      # Used if REDIS_URL is not set
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_DB=0
      - REDIS_PASSWORD=optional-password

      # Cache behavior
      - CACHE_TTL_SECONDS=7200        # 2 hours
      - CACHE_MAX_SIZE_MB=2048        # 2GB
```

**Priority Order:**
1. Database `redis_url` (set via UI - highest priority)
2. Environment `REDIS_URL`
3. Environment `REDIS_HOST`/`REDIS_PORT`
4. In-memory fallback (if all above fail)

---

## URL 格式参考

### Basic Format
```
redis://[password@]host:port/database
unix:///path/to/redis.sock?db=database[&password=password]
```

### Examples

**Local Docker (default):**
```
redis://redis:6379/0
```

**External server without password:**
```
redis://192.168.1.100:6379/0
redis://nas.local:6379/0
redis://cache-server.home.arpa:6379/0
```

**External server with password:**
```
redis://:mypassword123@192.168.1.100:6379/0
redis://:super-secure-pwd@nas.local:6379/0
```

**AWS ElastiCache:**
```
redis://my-cluster.abc123.cache.amazonaws.com:6379/0
```

**Redis Cloud:**
```
redis://default:longpassword@redis-12345.c123.cloud.redislabs.com:12345/0
```

**TLS/SSL encrypted connection:**
```
rediss://secure-redis.example.com:6380/0
rediss://:password@secure-redis.example.com:6380/0
```

**Unix socket connection:**
```
unix:///run/redis-socket/redis.sock?db=0
unix:///run/redis-socket/redis.sock?db=0&password=password
```

**URL Components:**
- `redis://` or `rediss://` or `unix://` - Protocol (rediss = TLS, unix = Unix socket)
- `:password@` - Optional password (the colon before password and @ after password is for TCP/TLS only)
- `host` - IP address or hostname (TCP/TLS only)
- `port` - Redis port (default: 6379, TCP/TLS only)
- `/database` - Database number (0-15, default: 0, TCP/TLS only)
- `/path/to/redis.sock` - Unix socket file path (Unix socket only)

---

## 性能调优

### 针对大型仓库（100 万+ 文件）

**Increase Redis memory:**
```yaml
# docker-compose.yml
redis:
  command: >
    redis-server
    --maxmemory 8gb                    # Increase from 2gb
    --maxmemory-policy allkeys-lru
```

**Increase cache size in UI:**
- Settings → Cache → Max Cache Size: 8192 MB

**Increase TTL for stable repos:**
- Settings → Cache → Cache TTL: 1440 minutes (24 hours)

### 针对多个大型归档

**Use external Redis with more RAM:**
```bash
# On dedicated server with 32GB RAM
docker run -d \
  --name redis-cache \
  --restart unless-stopped \
  -p 6379:6379 \
  -m 24g \
  redis:7-alpine \
  redis-server \
  --maxmemory 20gb \
  --maxmemory-policy allkeys-lru
```

Configure in UI:
- Redis URL: `redis://server-ip:6379/0`
- Max Cache Size: 20480 MB

### 内存估算

Estimate cache size needed:

```
Archive files × 200 bytes = Approximate cache size

Examples:
- 100,000 files  × 200 = 20 MB
- 1,000,000 files × 200 = 200 MB
- 10,000,000 files × 200 = 2 GB
```

Compression reduces this by ~70-80%, so actual usage is lower.

**Rule of thumb:**
- 1M files per archive × number of archives × 50 MB per archive = Total cache size needed

---

## 监控

### 查看缓存统计信息

**Via UI:**
- Settings → Cache tab
- Shows: backend type, hit rate, memory usage, entry count

**Via Docker logs:**
```bash
docker logs borg-web-ui | grep cache
```

**Via Redis CLI:**
```bash
# Connect to local Redis
docker exec -it borg-redis redis-cli

# Check memory usage
INFO memory

# Check number of keys
DBSIZE

# Check specific cache keys
KEYS archive:*

# Clear all cache (testing only)
FLUSHDB
```

### 健康检查

**Test connection:**
```bash
# From Redis host
redis-cli -h localhost ping

# From remote machine
redis-cli -h 192.168.1.100 ping

# With password
redis-cli -h 192.168.1.100 -a your-password ping
```

**Check if Borg Web UI is using Redis:**
```bash
docker logs borg-web-ui | grep -i redis
# Should show: "Cache service configured" with backend: redis
```

---

## 故障排查

### 缓存无效

**Symptom:** Archive browsing still slow after first load.

**Diagnosis:**
1. Go to Settings → Cache tab
2. Check "Backend Type" - should show "Redis"
3. Check "Cached Archives" - should increase after browsing
4. Check logs: `docker logs borg-web-ui | grep cache`

**Solutions:**

**If backend shows "In-Memory":**
```bash
# Check if Redis is running
docker ps | grep redis

# Check Redis logs
docker logs borg-redis

# Check connectivity from app container
docker exec borg-web-ui redis-cli -h redis ping
# Should return: PONG
```

**If external Redis not connecting:**
```bash
# Test from host machine
redis-cli -h 192.168.1.100 ping

# Check firewall on Redis server
sudo ufw allow 6379/tcp  # Ubuntu/Debian
sudo firewall-cmd --add-port=6379/tcp --permanent  # CentOS/RHEL

# Check Redis is listening on correct interface
docker exec redis-cache redis-cli CONFIG GET bind
# Should show: 0.0.0.0 (not 127.0.0.1)
```

### Redis 连接被拒绝

**Error in logs:** `Failed to connect to Redis`

**Solutions:**
```bash
# 1. Check Redis is running
docker ps | grep redis

# 2. Check Redis is listening on correct port
docker port borg-redis
# Should show: 6379/tcp -> 0.0.0.0:6379

# 3. Test connection
docker exec borg-web-ui ping redis  # Local Redis
ping 192.168.1.100  # External Redis

# 4. Check for firewall blocking
# On Redis host
sudo iptables -L | grep 6379
```

### 缓存未过期

**Symptom:** Old archive data shown after repository changes.

**Solutions:**
```bash
# Clear specific repository cache via UI
# Settings → Cache → Clear All Cache

# Or via Redis CLI
docker exec -it borg-redis redis-cli
> KEYS archive:*
> FLUSHDB  # Clears all cache
```

### 高内存使用

**Symptom:** Redis using more memory than expected.

**Check current usage:**
```bash
docker exec borg-redis redis-cli INFO memory | grep used_memory_human
```

**Solutions:**
1. Reduce cache size: Settings → Cache → Max Cache Size
2. Reduce TTL: Settings → Cache → Cache TTL
3. Clear old entries: Settings → Cache → Clear Cache
4. Increase Redis memory limit:
```yaml
redis:
  command: redis-server --maxmemory 4gb  # Increase limit
```

---

## 安全注意事项

### Network Security

**Firewall rules (if using external Redis):**
```bash
# Allow only specific IP (Borg Web UI host)
sudo ufw allow from 192.168.1.50 to any port 6379

# Or allow entire subnet
sudo ufw allow from 192.168.1.0/24 to any port 6379
```

**Redis bind address:**
```conf
# Only allow connections from specific network
bind 192.168.1.100 127.0.0.1

# Or all networks (less secure)
bind 0.0.0.0
```

### Password Protection

**Always use passwords for external Redis:**
```bash
# Generate strong password
openssl rand -base64 32

# Configure in redis.conf or docker command
redis-server --requirepass "your-strong-password"
```

**URL with password:**
```
redis://:your-strong-password@192.168.1.100:6379/0
```

**Note:** Passwords are redacted in UI and logs (shown as `***`).

### TLS/SSL Encryption

**For Redis on untrusted networks:**
```bash
# Use rediss:// protocol
rediss://:password@redis.example.com:6380/0
```

**Configure Redis with TLS:**
```conf
# redis.conf
port 0
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
tls-ca-cert-file /path/to/ca.crt
```

---

## 最佳实践

### For Home Networks

✅ Use local Redis (included in docker-compose)
✅ No password needed (if Redis not exposed outside Docker network)
✅ Default settings work well

### For Production / Remote Access

✅ Use external Redis with password
✅ Enable firewall rules
✅ Use TLS if Redis is on different network
✅ Monitor memory usage
✅ Set up backups (if using Redis persistence)

### For Large Repositories

✅ Use dedicated Redis server with 8GB+ RAM
✅ Increase cache size to 8-20 GB
✅ Increase TTL to 24 hours for stable repos
✅ Monitor hit rate in UI
✅ Consider cache warming (browse archives after backup)

---

## 迁移指南

### From In-Memory to Local Redis

Already done if using docker-compose.yml - Redis is included by default.

### From Local to External Redis

**Step 1:** Set up external Redis (see setup guides above)

**Step 2:** Configure in UI
1. Go to Settings → Cache
2. Enter Redis URL: `redis://your-server-ip:6379/0`
3. Click Save Settings
4. Verify "Connected to Redis" message appears

**Step 3:** Verify
1. Browse an archive to populate cache
2. Check Settings → Cache - should show external connection
3. Restart app - cache should persist

### From Environment to UI Configuration

**Before (docker-compose.yml):**
```yaml
environment:
  - REDIS_URL=redis://192.168.1.100:6379/0
```

**After:**
1. Remove `REDIS_URL` from docker-compose.yml
2. Restart: `docker compose up -d`
3. Configure in UI: Settings → Cache → External Redis URL
4. Click Save Settings

**Benefit:** Settings persist in database, can be changed without restart.

---

## 常见问题

**Q: Do I need external Redis?**
A: No. Local Redis (included) works great for most users. Use external Redis only if:
- You have repositories with 5M+ files
- You frequently browse multiple large archives
- Your host has limited RAM but another machine has spare RAM

**Q: Will cache survive app restarts?**
A: Yes (if using Redis). In-memory cache is lost on restart.

**Q: How often should I clear cache?**
A: Rarely. Cache automatically expires based on TTL. Only clear if:
- Repository structure changed (added/removed files)
- Testing cache functionality
- Troubleshooting browsing issues

**Q: Can multiple Borg Web UI instances share one Redis?**
A: Yes! Use different database numbers:
```
Instance 1: redis://server:6379/0
Instance 2: redis://server:6379/1
Instance 3: redis://server:6379/2
```

**Q: Does cache contain sensitive data?**
A: Only file paths and metadata (size, mtime). No file contents are cached.

**Q: What happens if Redis crashes?**
A: Borg Web UI automatically falls back to in-memory cache. Browsing continues working (but slower on first load).

---

## 相关文档

- [Installation Guide](installation) - Docker 安装指南
- [Configuration Guide](configuration) - 环境变量说明
- [Security Guide](security) - Redis 加固与安全
