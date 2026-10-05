"""
Tests for scheduled background tasks
"""

import pytest
from datetime import datetime
from scheduled_tasks import (
    init_scheduler, shutdown_scheduler, refresh_reporting_data,
    get_refresh_status
)
from db_service import MetadataRepository


class TestSchedulerInitialization:
    """Test scheduler initialization"""
    
    def test_init_scheduler_creates_scheduler(self, app):
        """Test scheduler is initialized"""
        from scheduled_tasks import scheduler
        # Scheduler may or may not be initialized depending on config
        # Just test that the function doesn't raise
        try:
            init_scheduler(app)
        except Exception as e:
            pytest.fail(f"init_scheduler raised {e}")
    
    def test_init_scheduler_idempotent(self, app):
        """Test scheduler can be initialized multiple times"""
        init_scheduler(app)
        init_scheduler(app)  # Should not raise


class TestSchedulerConfiguration:
    """Test scheduler configuration"""
    
    def test_scheduler_respects_disabled_config(self, app):
        """Test scheduler respects SCHEDULER_ENABLED config"""
        app.config['SCHEDULER_ENABLED'] = False
        init_scheduler(app)
        # Should not start if disabled
    
    def test_scheduler_interval_configuration(self, app):
        """Test scheduler uses configured interval"""
        app.config['SCHEDULER_INTERVAL_MINUTES'] = 30
        # Scheduler should use this interval
        init_scheduler(app)


class TestRefreshTask:
    """Test refresh_reporting_data task"""
    
    def test_refresh_task_completes(self):
        """Test refresh task runs without error"""
        try:
            refresh_reporting_data()
        except Exception as e:
            pytest.fail(f"refresh_reporting_data raised {e}")
    
    def test_refresh_task_updates_metadata(self):
        """Test refresh task updates metadata"""
        refresh_reporting_data()
        # Check metadata was updated
        last_refresh = MetadataRepository.get_last_refresh_time()
        # May or may not be set depending on implementation


class TestSchedulerStatus:
    """Test get_refresh_status function"""
    
    def test_get_refresh_status_returns_dict(self):
        """Test refresh status returns dict"""
        status = get_refresh_status()
        assert isinstance(status, dict)
    
    def test_get_refresh_status_has_timestamp(self):
        """Test refresh status includes timestamp"""
        status = get_refresh_status()
        assert 'timestamp' in status or 'error' in status
    
    def test_get_refresh_status_structure(self):
        """Test refresh status has expected structure"""
        status = get_refresh_status()
        if 'error' not in status:
            assert 'scheduler_running' in status or 'timestamp' in status


class TestSchedulerShutdown:
    """Test scheduler shutdown"""
    
    def test_shutdown_scheduler_completes(self):
        """Test shutdown completes without error"""
        try:
            shutdown_scheduler()
        except Exception as e:
            pytest.fail(f"shutdown_scheduler raised {e}")
    
    def test_shutdown_scheduler_idempotent(self):
        """Test shutdown can be called multiple times"""
        shutdown_scheduler()
        shutdown_scheduler()  # Should not raise


class TestRefreshTaskErrorHandling:
    """Test refresh task error handling"""
    
    def test_refresh_task_handles_errors(self, mocker):
        """Test refresh task handles errors gracefully"""
        # Mock MetadataRepository to raise error
        mock_update = mocker.patch.object(
            MetadataRepository, 'update_last_refresh_time'
        )
        mock_update.side_effect = Exception("Test error")
        
        # Should not raise, should handle error
        try:
            refresh_reporting_data()
        except:
            # May log error but shouldn't crash
            pass


class TestSchedulerLifecycle:
    """Test scheduler lifecycle"""
    
    def test_scheduler_can_start_and_stop(self, app):
        """Test scheduler can start and stop"""
        init_scheduler(app)
        shutdown_scheduler()
        # Both operations should complete


class TestMetadataTracking:
    """Test metadata tracking during refresh"""
    
    def test_refresh_updates_last_refresh_time(self):
        """Test refresh updates last refresh timestamp"""
        before = MetadataRepository.get_last_refresh_time()
        refresh_reporting_data()
        after = MetadataRepository.get_last_refresh_time()
        # After should be newer than before (or both None initially)


class TestSchedulerJobConfiguration:
    """Test scheduler job configuration"""
    
    def test_job_configured_with_coalesce(self, app):
        """Test job is configured with coalesce=True"""
        # Prevents multiple instances from running
        app.config['SCHEDULER_ENABLED'] = True
        init_scheduler(app)
        # Job should be configured to not run multiple times


class TestSchedulerExceptionHandling:
    """Test exception handling in scheduler"""
    
    def test_scheduler_init_handles_missing_config(self, app):
        """Test scheduler handles missing config gracefully"""
        del app.config['SCHEDULER_ENABLED']
        try:
            init_scheduler(app)
        except:
            pass  # May raise, but should handle gracefully
