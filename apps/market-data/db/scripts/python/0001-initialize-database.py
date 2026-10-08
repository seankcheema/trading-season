"""Apply the canonical schema once to an empty database."""
import argparse
import asyncio
import re
from pathlib import Path
import asyncpg


async def run(url: str) -> None:
    connection = await asyncpg.connect(url)
    try:
        async with connection.transaction():
            for name in ('V001__Initialize_database.sql', 'V002__Add_watchlist.sql', 'V008_Drop_account_status.sql', 'V009__Add_terms_acceptance_to_users.sql'):
                sql = (Path(__file__).parents[5] / 'db' / 'migrations' / name).read_text(encoding='utf-8-sig')
                sql = re.sub(r'^\s*(?:BEGIN|COMMIT);\s*$', '', sql, flags=re.MULTILINE)
                await connection.execute(sql)
        print('Database setup completed: schema committed.')
    finally:
        await connection.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-url', required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--empty-database', action='store_true')
    mode.add_argument('--disposable-database', action='store_true', help='Legacy alias; still requires an empty schema and never drops tables.')
    args = parser.parse_args()
    asyncio.run(run(args.database_url))
