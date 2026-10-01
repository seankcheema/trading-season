"""
WSGI entry point for Gunicorn
"""

import os
from app import app, init_app, db
from models import db as models_db

if __name__ == '__main__':
    with app.app_context():
        init_app()
        app.run()
