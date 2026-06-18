from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    async def log(
        db: AsyncSession,
        action: str,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            extra_data=metadata or {},
        )
        db.add(log_entry)
        try:
            await db.flush()
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
        return log_entry

    @staticmethod
    async def get_logs(
        db: AsyncSession,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        status: Optional[str] = None,
        days: int = 30,
        skip: int = 0,
        limit: int = 100,
    ):
        query = select(AuditLog)

        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action.ilike(f"%{action}%"))
        if status:
            query = query.where(AuditLog.status == status)

        since = datetime.utcnow() - timedelta(days=days)
        query = query.where(AuditLog.created_at >= since)
        query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)

        result = await db.execute(query)
        logs = result.scalars().all()

        # Enrich with user data
        enriched = []
        for log in logs:
            log_dict = {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "description": log.description,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "status": log.status,
                "metadata": log.extra_data or {},
                "created_at": log.created_at,
                "username": None,
                "user_email": None,
            }

            if log.user_id:
                user_result = await db.execute(select(User).where(User.id == log.user_id))
                user = user_result.scalar_one_or_none()
                if user:
                    log_dict["username"] = user.username
                    log_dict["user_email"] = user.email

            enriched.append(log_dict)

        return enriched

    @staticmethod
    async def get_activity_summary(db: AsyncSession, days: int = 7) -> Dict:
        since = datetime.utcnow() - timedelta(days=days)

        result = await db.execute(
            select(
                AuditLog.action,
                func.count(AuditLog.id).label("count")
            )
            .where(AuditLog.created_at >= since)
            .group_by(AuditLog.action)
            .order_by(desc("count"))
            .limit(10)
        )
        top_actions = [{"action": r[0], "count": r[1]} for r in result.all()]

        result2 = await db.execute(
            select(
                AuditLog.status,
                func.count(AuditLog.id).label("count")
            )
            .where(AuditLog.created_at >= since)
            .group_by(AuditLog.status)
        )
        status_breakdown = {r[0]: r[1] for r in result2.all()}

        return {
            "top_actions": top_actions,
            "status_breakdown": status_breakdown,
            "period_days": days,
        }
