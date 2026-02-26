from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import structlog
import os
from dotenv import load_dotenv

from app.api import auth, dashboard, backup, archives, restore, schedule, settings as settings_api, events, repositories, ssh_keys, system, filesystem, browse, notifications, scripts, packages, activity, scripts_library, mounts, metrics
from app.routers import config
from app.database.database import engine
from app.database.models import Base
from app.core.security import create_first_user

# Load environment variables
load_dotenv()

# Configure structured logging
import logging

# Set log level based on environment
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer() if log_level == "DEBUG" else structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Borg Web UI",
    description="A lightweight web interface for Borg backup management",
    version="1.56.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS
from app.config import settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for frontend (only if directories exist)
if os.path.exists("app/static/assets"):
    app.mount("/assets", StaticFiles(directory="app/static/assets"), name="assets")
if os.path.exists("app/static"):
    app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Include API routers
app.include_router(metrics.router)  # /metrics endpoint (no prefix for Prometheus)
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])
app.include_router(archives.router, prefix="/api/archives", tags=["Archives"])
app.include_router(browse.router, prefix="/api/browse", tags=["Browse"])
app.include_router(restore.router, prefix="/api/restore", tags=["Restore"])
app.include_router(schedule.router, prefix="/api/schedule", tags=["Schedule"])
app.include_router(settings_api.router, prefix="/api/settings", tags=["Settings"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(repositories.router, prefix="/api/repositories", tags=["Repositories"])
app.include_router(ssh_keys.router, prefix="/api/ssh-keys", tags=["SSH Keys"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(filesystem.router, prefix="/api/filesystem", tags=["Filesystem"])
app.include_router(scripts.router, prefix="/api/scripts", tags=["Scripts"])  # Old script test endpoint
app.include_router(scripts_library.router, prefix="/api", tags=["Script Library"])  # New script management
app.include_router(packages.router, prefix="/api/packages", tags=["Packages"])
app.include_router(notifications.router)
app.include_router(activity.router)
app.include_router(config.router, prefix="/api")
app.include_router(mounts.router)  # Mount management API

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("正在启动 Borg Web UI")

    # Run database migrations
    from app.database.migrations import run_migrations
    try:
        run_migrations()
    except Exception as e:
        logger.error("运行数据库迁移失败", error=str(e))
        # Don't fail startup, just log the error

    # Create first user if no users exist
    await create_first_user()

    # Load Redis URL from database and reconfigure cache service
    from app.services.cache_service import archive_cache
    from app.database.database import SessionLocal
    from app.database.models import SystemSettings
    try:
        db = SessionLocal()
        try:
            settings_obj = db.query(SystemSettings).first()
            if settings_obj and settings_obj.redis_url:
                result = archive_cache.reconfigure(
                    redis_url=settings_obj.redis_url,
                    cache_max_size_mb=settings_obj.cache_max_size_mb
                )
                if result["success"]:
                    logger.info("已从数据库配置缓存服务",
                               backend=result["backend"],
                               connection_info=result.get("connection_info"))
                else:
                    logger.warning("从数据库配置 Redis 失败，使用回退缓存",
                                 backend=result["backend"])
        finally:
            db.close()
    except Exception as e:
        logger.warning("从数据库配置缓存失败", error=str(e))

    # Cache borg system info on startup (prevents repeated borg --version calls)
    from app.core.borg import borg
    try:
        await borg.get_system_info()
        logger.info("Borg 系统信息已缓存")
    except Exception as e:
        logger.warning("缓存 Borg 系统信息失败", error=str(e))

    # Rotate old backup logs on startup (if enabled)
    from app.services.backup_service import backup_service
    from app.database.database import SessionLocal
    from app.database.models import SystemSettings
    try:
        db = SessionLocal()
        try:
            # Check if log cleanup on startup is enabled
            settings = db.query(SystemSettings).first()
            if settings and settings.log_cleanup_on_startup:
                backup_service.rotate_logs(db=db)
                logger.info("日志轮换完成")
            else:
                logger.info("启动时日志清理已禁用，跳过")
        finally:
            db.close()
    except Exception as e:
        logger.warning("日志轮换失败", error=str(e))

    # Cleanup orphaned jobs from container restarts
    from app.utils.process_utils import cleanup_orphaned_jobs, cleanup_orphaned_mounts
    try:
        db = SessionLocal()
        cleanup_orphaned_jobs(db)
        db.close()
        logger.info("孤立作业清理完成")
    except Exception as e:
        logger.error("清理孤立作业失败", error=str(e))

    # Cleanup orphaned mounts from container restarts
    try:
        cleanup_orphaned_mounts()
        logger.info("孤立挂载点清理完成")
    except Exception as e:
        logger.error("清理孤立挂载点失败", error=str(e))

    # Note: Package auto-installation now handled by entrypoint.sh startup script
    # This runs asynchronously via /app/app/scripts/startup_packages.py
    # Package installation jobs will start in the background after API is ready
    logger.info("软件包自动安装将由启动脚本处理")

    # Start scheduled backup checker (background task)
    from app.api.schedule import check_scheduled_jobs
    import asyncio
    
    # Track background tasks for cleanup
    app.state.background_tasks = []
    
    task1 = asyncio.create_task(check_scheduled_jobs())
    app.state.background_tasks.append(task1)
    logger.info("计划备份检查器已启动")

    # Start check scheduler (background task)
    from app.services.check_scheduler import check_scheduler
    task2 = asyncio.create_task(check_scheduler.start())
    app.state.background_tasks.append(task2)
    logger.info("检查调度器已启动")

    # Start stats refresh scheduler (background task)
    from app.services.stats_refresh_scheduler import stats_refresh_scheduler
    task3 = asyncio.create_task(stats_refresh_scheduler.start())
    app.state.background_tasks.append(task3)
    logger.info("统计刷新调度器已启动")

    logger.info("Borg Web UI 启动成功")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("正在关闭 Borg Web UI")
    
    # Cancel background tasks
    tasks = getattr(app.state, "background_tasks", [])
    if tasks:
        logger.info(f"正在取消 {len(tasks)} 个后台任务")
        for task in tasks:
            task.cancel()
        
        # Wait for tasks to finish cancelling
        import asyncio
        try:
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.info("后台任务已取消")
        except Exception as e:
            logger.warning("等待后台任务取消时出错", error=str(e))

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main application"""
    try:
        with open("app/static/index.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Borg Web UI</h1><p>前端尚未构建。请先运行构建流程。</p>")

@app.get("/{full_path:path}", response_class=HTMLResponse)
async def catch_all(full_path: str):
    """Catch-all route for SPA routing - serves index.html for frontend routes"""
    # Don't interfere with API routes
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    # Don't interfere with static assets
    if full_path.startswith("assets/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not Found")

    # Serve static files from root (logo.png, favicon files, etc.)
    if full_path in ["logo.png", "logo.svg", "favicon.svg", "favicon.ico", "favicon-16x16.png", "favicon-32x32.png"]:
        from fastapi.responses import FileResponse
        import os
        file_path = f"app/static/{full_path}"
        if os.path.exists(file_path):
            return FileResponse(file_path)
        raise HTTPException(status_code=404, detail="Not Found")

    # Serve index.html for all other routes (frontend routes)
    try:
        with open("app/static/index.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Borg Web UI</h1><p>前端尚未构建。请先运行构建流程。</p>")

@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration and startup scripts"""
    return {"status": "healthy", "service": "borg-web-ui"}

@app.get("/api")
async def api_info():
    """API information endpoint"""
    return {
        "name": "Borg Web UI API",
        "version": "1.56.0",
        "docs": "/api/docs",
        "status": "running"
    }

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests (except static assets and SSE streams)"""
    # Skip logging for static assets and SSE streams to reduce noise
    skip_paths = ["/assets/", "/static/", "/api/events/stream"]
    should_log = not any(request.url.path.startswith(path) for path in skip_paths)

    if should_log:
        logger.info(
            "request_received",
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None
        )

    response = await call_next(request)

    if should_log:
        # Log errors and warnings with more detail
        if response.status_code >= 400:
            logger.warning(
                "request_failed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code
            )
        else:
            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code
            )

    return response 