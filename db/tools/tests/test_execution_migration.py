"""Opt-in PostgreSQL migration contract; the supplied database must be disposable."""
import os
from pathlib import Path
from uuid import uuid4

import pytest


@pytest.mark.skipif(not os.environ.get('EXECUTION_MIGRATION_DISPOSABLE_DATABASE_URL'),
                    reason='requires an explicitly disposable PostgreSQL migration database')
def test_buffer_migration_is_atomic_and_preserves_history():
    psycopg = pytest.importorskip('psycopg')
    from psycopg import sql
    migration = Path(__file__).resolve().parents[2] / 'migrations' / 'V011__Execution_preferences_and_order_types.sql'
    schema = 'execution_migration_' + uuid4().hex
    with psycopg.connect(os.environ['EXECUTION_MIGRATION_DISPOSABLE_DATABASE_URL'], autocommit=True) as connection:
        connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        try:
            connection.execute(sql.SQL('SET search_path TO {}').format(sql.Identifier(schema)))
            connection.execute("""
                CREATE TABLE users (user_id integer PRIMARY KEY, execution_buffer_percent numeric(5,2) NOT NULL DEFAULT 0,
                    CONSTRAINT users_execution_buffer_percent_check CHECK (execution_buffer_percent >= 0));
                CREATE TABLE simulation_sessions (id bigint PRIMARY KEY);
                CREATE TABLE orders (order_id integer PRIMARY KEY, status text NOT NULL, quantity numeric(14,4) NOT NULL,
                    buffer_percent numeric(5,2), CONSTRAINT orders_status_check CHECK (status IN ('PENDING','ACCEPTED','FILLED','REJECTED')));
                CREATE TABLE fills (order_id integer UNIQUE REFERENCES orders(order_id), quote_price numeric(18,6));
                INSERT INTO users VALUES (1,0), (2,2.5), (3,10.01);
                INSERT INTO orders VALUES (1,'FILLED',2,0), (2,'ACCEPTED',1,0);
                INSERT INTO fills VALUES (1,100.123456);
            """)
            with pytest.raises(psycopg.Error, match='correct invalid preferences first'):
                connection.execute(migration.read_text(encoding='utf-8'))
            connection.execute('ROLLBACK')
            assert connection.execute('SELECT execution_buffer_percent FROM users WHERE user_id=1').fetchone()[0] == 0
            assert connection.execute("SELECT count(*) FROM information_schema.columns WHERE table_schema=%s AND table_name='orders' AND column_name='reference_price'", (schema,)).fetchone()[0] == 0
            connection.execute('UPDATE users SET execution_buffer_percent=8.5 WHERE user_id=3')
            connection.execute(migration.read_text(encoding='utf-8'))
            assert [row[0] for row in connection.execute('SELECT execution_buffer_percent FROM users ORDER BY user_id')] == [1, 2.5, 8.5]
            rows = connection.execute('SELECT execution_type, reference_price, execution_price, reserved_cash FROM orders ORDER BY order_id').fetchall()
            assert rows[0][0] == 'MARKET' and rows[0][1] is None and str(rows[0][2]) == '100.123456'
            assert rows[1][0] == 'MARKET' and rows[1][1] is None and rows[1][3] == 0
            with pytest.raises(psycopg.errors.CheckViolation):
                connection.execute('UPDATE users SET execution_buffer_percent=10.01 WHERE user_id=1')
        finally:
            connection.execute('ROLLBACK')
            connection.execute('SET search_path TO public')
            connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))
