"""
Gunicorn entry point. Only registers the API routes: no database probe and
no scheduler, because gunicorn runs several workers and the report job
belongs to the single consumer process (consumer.py).
"""

from app import app, register_routes

register_routes()
