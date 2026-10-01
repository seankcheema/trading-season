"""
WSGI entry point for Gunicorn
"""

import os
from app import app, init_app

if __name__ == '__main__':
    init_app()
    app.run()
