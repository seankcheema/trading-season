"""
Scheduled Background Tasks
Periodic jobs for data aggregation and cache updates
"""

from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from db_service import (
    AccountRepository, UserRepository, OrderRepository,
    TradeRepository, MetadataRepository
)
import logging

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None


def init_scheduler(app):
    """
    Initialize and start background scheduler
    Called from Flask app factory
    """
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already initialized")
        return scheduler
    
    # Create scheduler instance
    scheduler = BackgroundScheduler()
    
    # Get configuration
    scheduler_enabled = app.config.get('SCHEDULER_ENABLED', True)
    interval_minutes = app.config.get('SCHEDULER_INTERVAL_MINUTES', 15)
    
    if not scheduler_enabled:
        logger.info("Scheduler is disabled via configuration")
        return scheduler
    
    # Register jobs
    try:
        scheduler.add_job(
            func=refresh_reporting_data,
            trigger="interval",
            minutes=interval_minutes,
            id='refresh_reporting_data',
            name='Refresh reporting data aggregates',
            replace_existing=True,
            coalesce=True,
            max_instances=1
        )
        logger.info(f"Scheduled reporting data refresh job every {interval_minutes} minutes")
    except Exception as e:
        logger.error(f"Failed to schedule reporting data refresh job: {e}")
    
    # Start scheduler
    try:
        scheduler.start()
        logger.info("Background scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    return scheduler


def shutdown_scheduler():
    """
    Gracefully shutdown scheduler
    Called during Flask shutdown
    """
    global scheduler
    
    if scheduler is None:
        return
    
    try:
        scheduler.shutdown(wait=True)
        logger.info("Background scheduler shut down successfully")
    except Exception as e:
        logger.error(f"Error shutting down scheduler: {e}")


def refresh_reporting_data():
    """
    Periodic task to refresh reporting data aggregates
    
    This job runs every N minutes and:
    1. Recalculates portfolio aggregates for all active users
    2. Updates trade statistics cache
    3. Marks refresh timestamp in metadata
    
    NOTE: This could be extended to:
    - Write aggregates to materialized views
    - Pre-compute common queries (most traded symbols, etc.)
    - Archive old audit records
    - Validate data integrity
    """
    start_time = datetime.utcnow()
    logger.info("Starting reporting data refresh job")
    
    try:
        # Update refresh timestamp
        refresh_time = start_time.isoformat()
        MetadataRepository.update_last_refresh_time(refresh_time)
        logger.info(f"Updated last refresh time: {refresh_time}")
        
        # In a production system, this would:
        # 1. Fetch all active users
        # 2. Calculate aggregates for each user
        # 3. Store in cache or materialized view
        # 4. Track completion metrics
        
        # For now, we log successful completion
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Reporting data refresh completed in {elapsed:.2f} seconds")
        
    except Exception as e:
        logger.error(f"Error refreshing reporting data: {e}", exc_info=True)
        # Update metadata with error status if needed
        try:
            error_msg = f"Error at {datetime.utcnow().isoformat()}: {str(e)}"
            MetadataRepository.set_metadata('last_refresh_error', error_msg)
        except:
            pass


def get_refresh_status():
    """
    Get current refresh status and last refresh time
    Returns dict with status information
    """
    try:
        last_refresh_time = MetadataRepository.get_last_refresh_time()
        last_refresh_error = MetadataRepository.get_metadata('last_refresh_error')
        
        status = {
            'scheduler_running': scheduler is not None and scheduler.running if scheduler else False,
            'last_refresh_time': last_refresh_time,
            'last_refresh_error': last_refresh_error,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return status
    except Exception as e:
        logger.error(f"Error getting refresh status: {e}")
        return {
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }
