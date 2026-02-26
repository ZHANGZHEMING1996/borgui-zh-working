---
layout: default
title: Technical Specification
nav_order: 8
description: "Architecture and technical details"
---

# Borg Web UI - 技术规范

## 1. 概要说明

本文档列出了 Borg Web UI 的技术规范。该界面为 Borg 提供轻量级的 Web 管理界面，设计目标是在资源受限的设备（如 Raspberry Pi、Odroid）上高效运行，既支持完整的备份管理功能，又尽量降低对命令行的依赖。

### 1.1 主要目标
- 资源高效：内存与 CPU 占用最低，适合 ARM 平台
- 功能完备：通过 Web 界面实现备份管理的主要能力
- 易于部署：基于 Docker 的容器化部署方案
- 安全性：提供认证与安全远程访问选项
- 良好体验：为非技术用户提供直观的操作界面

## 2. 系统架构

### 2.1 高层架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web 浏览器    │    │   Borg UI 前端  │    │   后端服务      │
│   (Frontend)    │◄──►│   (Backend API)  │◄──►│   系统 / Borg CLI│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Borg CLI 接口  │
                       └─────────────────┘
```

### 2.2 技术栈

后端：
- 框架：FastAPI（Python 3.10+）
- 通过子进程与 Borg CLI 交互
- 认证：JWT + bcrypt 密码哈希
- 数据库：SQLite（轻量级存储）
- 日志：结构化日志并支持日志轮转

前端：
- 框架：React 18 + TypeScript
- 样式：Tailwind CSS
- 状态管理：React Context + useReducer
- HTTP 客户端：Axios
- 实时更新：Server-Sent Events（SSE）

容器化：
- 运行时：Docker，多阶段构建以减小镜像体积
- 基础镜像：Python-slim 系列
- Web 服务：Gunicorn + Uvicorn workers（生产部署场景）

## 3. 核心组件规范

### 3.1 仪表盘（Dashboard）

#### 功能要点
- 备份状态总览：所有仓库的实时状态
- 存储指标：磁盘使用、备份大小、压缩比等
- 调度显示：下次定时备份时间
- 快速操作：手动备份、恢复、配置入口
- 系统健康：CPU、内存、磁盘监控

#### 数据流
```
Dashboard → API → Borg CLI → 系统 → 实时更新
```

#### API 端点示例
```python
GET /api/dashboard/status
GET /api/dashboard/metrics
GET /api/dashboard/schedule
GET /api/dashboard/health
```

### 3.2 配置管理

#### 配置查看器
- YAML 编辑器：语法高亮与校验
- 配置模板：预置常用配置
- 实时校验：YAML 与 Borg 配置的联动校验
- 配置备份/恢复

#### API 端点示例
```python
GET /api/config/current
PUT /api/config/update
POST /api/config/validate
GET /api/config/templates
POST /api/config/backup
POST /api/config/restore
```

### 3.3 备份控制

#### 手动备份功能
- 仓库选择：选择要备份的目标仓库
- 进度监控：实时显示详细日志与进度
- 取消操作：支持取消正在运行的备份
- 与 prune 集成：备份后可自动触发 prune

#### API 端点示例
```python
POST /api/backup/start
GET /api/backup/status/{job_id}
DELETE /api/backup/cancel/{job_id}
GET /api/backup/logs/{job_id}
```

### 3.4 归档浏览器（Archive Browser）

#### 功能要点
- 列出所有配置的仓库
- 查看归档元信息、大小与内容
- 文件浏览：支持搜索与目录导航
- 归档操作：删除、重命名、标记等

#### API 端点示例
```python
GET /api/archives/list
GET /api/archives/{archive_id}/info
GET /api/archives/{archive_id}/contents
DELETE /api/archives/{archive_id}
POST /api/archives/{archive_id}/rename
```

### 3.5 恢复功能

#### 恢复操作
- 归档选择：选择要恢复的归档
- 路径选择：选择要恢复的文件或目录
- 目标配置：选择恢复的目的地
- 进度监控：实时显示恢复进度
- 预演（Dry Run）：预览恢复效果

#### API 端点示例
```python
POST /api/restore/preview
POST /api/restore/start
GET /api/restore/status/{job_id}
DELETE /api/restore/cancel/{job_id}
GET /api/restore/logs/{job_id}
```

### 3.6 调度管理

#### Cron 集成
- 可视化 cron 表达式编辑器
- 调度管理：查看、编辑、删除调度任务
- 执行历史记录
- 手动触发调度任务

#### API 端点示例
```python
GET /api/schedule/jobs
POST /api/schedule/job
PUT /api/schedule/job/{job_id}
DELETE /api/schedule/job/{job_id}
POST /api/schedule/job/{job_id}/trigger
GET /api/schedule/history
```

### 3.7 日志管理

#### 日志查看器
- 实时日志流：支持筛选
- 日志级别：error、warning、info、debug
- 支持全文搜索
- 导出日志功能

#### API 端点示例
```python
GET /api/logs/stream
GET /api/logs/search
GET /api/logs/download
GET /api/logs/levels
```

### 3.8 系统设置

#### 设置管理
- 认证与用户管理
- 网络配置：端口与访问控制
- 备份默认参数
- 通知设置：邮件与 Webhook

#### API 端点示例
```python
GET /api/settings/system
PUT /api/settings/system
GET /api/settings/auth
PUT /api/settings/auth
GET /api/settings/notifications
PUT /api/settings/notifications
```

### 3.9 健康监控

#### 系统健康
- 资源监控：CPU、内存、磁盘
- 备份健康：仓库状态与完整性
- 网络监控：连通性与性能
- 告警系统：可配置告警策略

#### API 端点示例
```python
GET /api/health/system
GET /api/health/backups
GET /api/health/network
POST /api/health/alerts
```

## 4. 用户界面设计

### 4.1 设计原则

#### 响应式设计
- 移动优先（Mobile-First），优化触控体验
- 渐进增强（Progressive Enhancement）：无 JS 时仍能实现核心功能
- 可访问性：目标达到 WCAG 2.1 AA
- 性能：尽量减小打包体积与加载时间

#### 视觉设计
- 主题：支持深色模式并保持高对比度
- 排版：优先使用系统字体以提高性能
- 图标：使用 SVG 可缩放图标
- 布局：基于网格的响应式布局

### 4.2 组件结构

```
src/
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Loading.tsx
│   │   └── ErrorBoundary.tsx
│   ├── dashboard/
│   │   ├── StatusCard.tsx
│   │   ├── MetricsChart.tsx
│   │   └── QuickActions.tsx
│   ├── config/
│   │   ├── YamlEditor.tsx
│   │   ├── ConfigValidator.tsx
│   │   └── TemplateSelector.tsx
│   ├── backup/
│   │   ├── BackupControl.tsx
│   │   ├── ProgressMonitor.tsx
│   │   └── JobQueue.tsx
│   ├── archives/
│   │   ├── ArchiveList.tsx
│   │   ├── FileBrowser.tsx
│   │   └── ArchiveDetails.tsx
│   ├── restore/
│   │   ├── RestoreWizard.tsx
│   │   ├── PathSelector.tsx
│   │   └── RestoreProgress.tsx
│   ├── schedule/
│   │   ├── CronEditor.tsx
│   │   ├── JobList.tsx
│   │   └── ExecutionHistory.tsx
│   ├── logs/
│   │   ├── LogViewer.tsx
│   │   ├── LogFilter.tsx
│   │   └── LogSearch.tsx
│   ├── settings/
│   │   ├── SystemSettings.tsx
│   │   ├── AuthSettings.tsx
│   │   └── NotificationSettings.tsx
│   └── health/
│       ├── SystemHealth.tsx
│       ├── BackupHealth.tsx
│       └── AlertManager.tsx
```

### 4.3 状态管理

#### Context 结构示例
```typescript
interface AppState {
  auth: AuthState;
  dashboard: DashboardState;
  backup: BackupState;
  config: ConfigState;
  archives: ArchivesState;
  restore: RestoreState;
  schedule: ScheduleState;
  logs: LogsState;
  settings: SettingsState;
  health: HealthState;
}
```

#### 实时更新
- 使用 Server-Sent Events 提供实时日志流和进度更新
- 对不支持 SSE 的环境提供 WebSocket 回退
- 在受限环境下使用轮询作为最后手段

## 5. 后端架构

### 5.1 FastAPI 应用结构

```
app/
├── main.py                 # 应用入口
├── config.py              # 配置管理
├── database/
│   ├── models.py          # SQLAlchemy 模型
│   ├── database.py        # 数据库连接
│   └── migrations/        # 数据库迁移脚本
├── api/
│   ├── auth.py            # 认证端点
│   ├── dashboard.py       # 仪表盘端点
│   ├── config.py          # 配置端点
│   ├── backup.py          # 备份端点
│   ├── archives.py        # 归档端点
│   ├── restore.py         # 恢复端点
│   ├── schedule.py        # 调度端点
│   ├── logs.py            # 日志端点
│   ├── settings.py        # 设置端点
│   └── health.py          # 健康检查端点
├── core/
│   ├── borg.py            # Borg CLI 接口
│   ├── scheduler.py       # Cron 调度管理
│   ├── notifications.py   # 通知系统
│   └── security.py        # 安全工具
├── models/
│   ├── auth.py            # 认证模型
│   ├── backup.py          # 备份模型
│   ├── config.py          # 配置模型
│   └── system.py          # 系统模型
└── utils/
    ├── logger.py          # 日志工具
    ├── validators.py      # 校验工具
    └── helpers.py         # 助手函数
```

### 5.2 Borg 集成

#### CLI 接口示例
```python
class BorgInterface:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.borg_cmd = "borg"
    
    async def run_backup(self, repository: str = None) -> dict:
        """执行备份操作"""
        cmd = [self.borg_cmd, "create"]
        if repository:
            cmd.extend(["--repository", repository])
        
        return await self._execute_command(cmd)
    
    async def list_archives(self, repository: str) -> dict:
        """列出仓库中的归档"""
        cmd = [self.borg_cmd, "list", "--repository", repository]
        return await self._execute_command(cmd)
    
    async def _execute_command(self, cmd: List[str]) -> dict:
        """执行命令并实时捕获输出"""
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        return {
            "return_code": process.returncode,
            "stdout": stdout.decode(),
            "stderr": stderr.decode()
        }
```

### 5.3 数据库模式

#### 核心表示例
```sql
-- Users 表（用于认证）
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 备份作业表
CREATE TABLE backup_jobs (
    id INTEGER PRIMARY KEY,
    repository VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    logs TEXT
);

-- Configuration backups
CREATE TABLE config_backups (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled jobs
CREATE TABLE scheduled_jobs (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    repository VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP,
    next_run TIMESTAMP
);

-- System logs
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50)
);
```

## 6. API Design

### 6.1 Authentication API

#### 6.1.1 Endpoints
```python
# Authentication
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me

# User management
GET /api/auth/users
POST /api/auth/users
PUT /api/auth/users/{user_id}
DELETE /api/auth/users/{user_id}
```

#### 6.1.2 Security Implementation
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return username
```

### 6.2 Dashboard API

#### 6.2.1 Status Endpoint
```python
@router.get("/api/dashboard/status")
async def get_dashboard_status(current_user: str = Depends(get_current_user)):
    """Get comprehensive dashboard status"""
    try:
        # Get backup status
        backup_status = await borg.get_backup_status()
        
        # Get system metrics
        system_metrics = await get_system_metrics()
        
        # Get scheduled jobs
        scheduled_jobs = await get_scheduled_jobs()
        
        return {
            "backup_status": backup_status,
            "system_metrics": system_metrics,
            "scheduled_jobs": scheduled_jobs,
            "last_updated": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting dashboard status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard status")
```

### 6.3 Real-time Updates

#### 6.3.1 Server-Sent Events
```python
@router.get("/api/events/backup-progress/{job_id}")
async def backup_progress_events(job_id: str):
    """Stream backup progress updates"""
    async def event_generator():
        while True:
            # Check if job is still running
            job_status = await get_job_status(job_id)
            
            if job_status["status"] in ["completed", "failed", "cancelled"]:
                yield f"data: {json.dumps(job_status)}\n\n"
                break
            
            yield f"data: {json.dumps(job_status)}\n\n"
            await asyncio.sleep(1)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )
```

## 7. Docker Implementation

### 7.1 Multi-stage Dockerfile

```dockerfile
# Build stage for frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ .
RUN npm run build

# Build stage for backend
FROM python:3.10-slim AS backend-builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.10-slim AS production
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    cron \
    borgbackup \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies
COPY --from=backend-builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy application code
COPY app/ ./app/
COPY --from=frontend-builder /app/frontend/build ./app/static

# Create non-root user
RUN useradd -m -u 1000 borg && \
    chown -R borg:borg /app

# Switch to non-root user
USER borg

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/system || exit 1

# Start application
CMD ["gunicorn", "app.main:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker"]
```

### 7.2 Docker Compose Configuration

```yaml
version: '3.8'

services:
  borg-ui:
    build: .
    container_name: borg-web-ui
    ports:
      - "8080:8000"
    volumes:
      - ./config:/app/config:ro
      - ./backups:/backups:ro
      - ./logs:/app/logs
      - /etc/cron.d:/etc/cron.d:ro
    environment:
      - BORG_CONFIG_PATH=/app/config
      - BORG_BACKUP_PATH=/backups
      - LOG_LEVEL=INFO
      - SECRET_KEY=${SECRET_KEY}
    restart: unless-stopped
    networks:
      - borg-network

  # Optional: PostgreSQL for production
  postgres:
    image: postgres:13-alpine
    container_name: borg-db
    environment:
      - POSTGRES_DB=borg
      - POSTGRES_USER=borg
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - borg-network

networks:
  borg-network:
    driver: bridge

volumes:
  postgres_data:
```

### 7.3 Environment Configuration

```bash
# .env file
SECRET_KEY=your-secret-key-here
DB_PASSWORD=your-db-password
BORG_CONFIG_PATH=/app/config
BORG_BACKUP_PATH=/backups
LOG_LEVEL=INFO
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

## 8. Deployment Considerations

### 8.1 Resource Requirements

#### 8.1.1 Minimum Requirements
- **CPU**: 1 core ARM Cortex-A53 or equivalent
- **RAM**: 512MB (1GB recommended)
- **Storage**: 2GB for application + backup storage
- **Network**: Ethernet or WiFi connection

#### 8.1.2 Recommended Requirements
- **CPU**: 2+ cores ARM Cortex-A72 or equivalent
- **RAM**: 2GB
- **Storage**: 8GB+ for application and backup storage
- **Network**: Gigabit Ethernet

### 8.2 Security Considerations

#### 8.2.1 Authentication
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Configurable session timeouts
- **Rate Limiting**: API rate limiting to prevent abuse

#### 8.2.2 Network Security
- **HTTPS**: TLS/SSL encryption for all communications
- **CORS**: Configurable Cross-Origin Resource Sharing
- **Firewall**: Port restrictions and access controls
- **VPN**: Optional VPN integration for remote access

#### 8.2.3 Data Security
- **Encryption**: Backup data encryption at rest
- **Access Control**: Role-based access control
- **Audit Logging**: Comprehensive audit trail
- **Backup Security**: Encrypted configuration backups

### 8.3 Monitoring and Logging

#### 8.3.1 Application Monitoring
```python
# Health check endpoints
@router.get("/api/health/system")
async def system_health():
    return {
        "cpu_usage": get_cpu_usage(),
        "memory_usage": get_memory_usage(),
        "disk_usage": get_disk_usage(),
        "uptime": get_system_uptime()
    }

@router.get("/api/health/backups")
async def backup_health():
    return {
        "repositories": await get_repository_status(),
        "last_backup": await get_last_backup_time(),
        "backup_errors": await get_recent_backup_errors()
    }
```

#### 8.3.2 Logging Configuration
```python
# Structured logging setup
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
```

### 8.4 Backup and Recovery

#### 8.4.1 Configuration Backup
```python
async def backup_configuration():
    """Backup current configuration"""
    config_path = os.getenv("BORG_CONFIG_PATH")
    backup_dir = "/app/backups/config"
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"{backup_dir}/config_backup_{timestamp}.tar.gz"
    
    with tarfile.open(backup_file, "w:gz") as tar:
        tar.add(config_path, arcname="config")
    
    return backup_file
```

#### 8.4.2 Disaster Recovery
- **Configuration Backup**: Automatic backup of all configurations
- **Database Backup**: Regular SQLite database backups
- **Application Backup**: Docker image and configuration backups
- **Recovery Procedures**: Documented recovery procedures

## 9. Performance Optimization

### 9.1 Frontend Optimization

#### 9.1.1 Bundle Optimization
```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
};
```

#### 9.1.2 Lazy Loading
```typescript
// Lazy load components for better performance
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const ConfigEditor = lazy(() => import('./components/config/ConfigEditor'));
const ArchiveBrowser = lazy(() => import('./components/archives/ArchiveBrowser'));
```

### 9.2 Backend Optimization

#### 9.2.1 Caching Strategy
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

@cache(expire=300)  # Cache for 5 minutes
async def get_dashboard_metrics():
    """Get cached dashboard metrics"""
    return await calculate_metrics()

@cache(expire=60)  # Cache for 1 minute
async def get_repository_status():
    """Get cached repository status"""
    return await borg.get_repository_status()
```

#### 9.2.2 Database Optimization
```python
# Database connection pooling
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    "sqlite:///borg.db",
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)
```

## 10. Testing Strategy

### 10.1 Unit Testing

#### 10.1.1 Backend Tests
```python
# tests/test_borg.py
import pytest
from app.core.borg import BorgInterface

@pytest.fixture
def borg_interface():
    return BorgInterface("/tmp/test_config")

@pytest.mark.asyncio
async def test_run_backup(borg_interface):
    result = await borg_interface.run_backup("test_repo")
    assert result["return_code"] == 0
    assert "backup" in result["stdout"].lower()
```

#### 10.1.2 Frontend Tests
```typescript
// tests/components/Dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard';

test('renders dashboard with status cards', () => {
  render(<Dashboard />);
  expect(screen.getByText('Backup Status')).toBeInTheDocument();
  expect(screen.getByText('System Health')).toBeInTheDocument();
});
```

### 10.2 Integration Testing

#### 10.2.1 API Testing
```python
# tests/test_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_dashboard_status():
    response = client.get("/api/dashboard/status")
    assert response.status_code == 200
    assert "backup_status" in response.json()
```

### 10.3 End-to-End Testing

#### 10.3.1 Docker Testing
```yaml
# docker-compose.test.yml
version: '3.8'

services:
  test-app:
    build: .
    environment:
      - TESTING=true
      - DATABASE_URL=sqlite:///test.db
    volumes:
      - ./tests:/app/tests
    command: ["pytest", "/app/tests"]
```

## 11. Documentation

### 11.1 User Documentation

#### 11.1.1 Getting Started Guide
- **Installation**: Step-by-step Docker installation
- **Configuration**: Initial setup and configuration
- **First Backup**: Creating and running first backup
- **Troubleshooting**: Common issues and solutions

#### 11.1.2 User Manual
- **Dashboard**: Understanding the dashboard interface
- **Backup Management**: Creating and managing backups
- **Restore Operations**: Restoring data from archives
- **Scheduling**: Setting up automated backups
- **Monitoring**: Understanding system health and logs

### 11.2 Developer Documentation

#### 11.2.1 API Documentation
- **OpenAPI/Swagger**: Auto-generated API documentation
- **Endpoint Reference**: Detailed endpoint documentation
- **Authentication**: Authentication and authorization guide
- **Error Codes**: Comprehensive error code reference

#### 11.2.2 Development Guide
- **Setup**: Development environment setup
- **Architecture**: System architecture overview
- **Contributing**: Contribution guidelines
- **Testing**: Testing procedures and guidelines

## 12. Conclusion

This technical specification provides a comprehensive framework for developing a lightweight, feature-rich web UI for Borg. The solution addresses all core requirements while maintaining focus on resource efficiency and ease of deployment.

### 12.1 Key Success Factors

1. **Resource Efficiency**: Minimal footprint suitable for ARM devices
2. **Comprehensive Functionality**: Full backup management capabilities
3. **Security**: Robust authentication and data protection
4. **User Experience**: Intuitive interface for non-technical users
5. **Deployment Simplicity**: Docker-based deployment for easy installation
6. **Maintainability**: Well-structured codebase with comprehensive testing
7. **Scalability**: Architecture supports future enhancements

### 12.2 Next Steps

1. **Implementation**: Begin with core dashboard and backup functionality
2. **Testing**: Comprehensive testing across different ARM devices
3. **Documentation**: Complete user and developer documentation
4. **Deployment**: Create deployment packages and installation scripts
5. **Community**: Open source release and community engagement

This specification provides a solid foundation for building a production-ready Borg web UI that meets all requirements while maintaining the lightweight, efficient design necessary for resource-constrained devices. 