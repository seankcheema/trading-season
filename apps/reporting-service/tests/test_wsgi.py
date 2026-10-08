"""Gunicorn imports wsgi:app; that import must register the API and nothing else."""

import importlib
import sys


def test_importing_wsgi_registers_the_api_and_starts_no_scheduler(app):
    sys.modules.pop('wsgi', None)

    wsgi = importlib.import_module('wsgi')

    assert wsgi.app is app
    assert 'api' in wsgi.app.blueprints
    assert not hasattr(wsgi, 'scheduler')
    assert 'apscheduler.schedulers.background' not in {name for name in sys.modules if 'wsgi' in name}
