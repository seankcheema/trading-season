"""
One report run: read the event files, add names from the database, write
report.json and PNG charts into a dated run directory, replace the previous run.

The run reads PostgreSQL only for users and accounts: the names it labels
accounts with and the trader level it segments them by. Trade data comes from
the files the consumer wrote.
"""

import json
import logging
import os
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import matplotlib
matplotlib.use('Agg')  # headless; must precede the pyplot import
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter, MaxNLocator  # noqa: E402

from event_store import EventStore  # noqa: E402
from models import Account, User  # noqa: E402
from run_store import LATEST_FILE, REPORT_FILE, runs_dir  # noqa: E402

logger = logging.getLogger(__name__)

RUN_ID_FORMAT = '%Y%m%dT%H%M%SZ'
# The client segments a run splits activity by: the trader levels, lowest first.
SEGMENTS = ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
# Where the orders of an account the database does not know are counted.
UNKNOWN_SEGMENT = 'UNKNOWN'
_FRACTION = re.compile(r'(\.\d{6})\d+')


def parse_occurred_at(value):
    """
    Parse the ISO-8601 timestamp Jackson writes. It may end in Z or an offset
    and may carry more than six fractional digits, which Python rejects.
    Returns an aware datetime in UTC, or None when unparseable.
    """
    if not isinstance(value, str) or not value:
        return None
    text = value.strip()
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    text = _FRACTION.sub(r'\1', text)
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def load_events(files_dir):
    """Every event on disk, with exact duplicates by (partition, offset) removed."""
    store = EventStore(Path(files_dir) / 'events')
    seen = set()
    events = []
    for event in store.iter_events():
        identity = (event.get('partition'), event.get('offset'))
        if identity in seen:
            continue
        seen.add(identity)
        events.append(event)
    return events


def _decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)


def build_insights(events):
    """
    The BR-17 insights: fills versus rejections, traded volume per symbol,
    activity per account, and trades per UTC day.
    """
    status_counts = {'FILLED': 0, 'REJECTED': 0}
    by_symbol = defaultdict(lambda: {'fills': 0, 'shares': Decimal(0), 'notional': Decimal(0)})
    by_account = defaultdict(lambda: {'total': 0, 'filled': 0, 'rejected': 0})
    by_day = defaultdict(lambda: {'filled': 0, 'rejected': 0})

    for event in events:
        status = event.get('status')
        if status not in status_counts:
            continue
        status_counts[status] += 1

        account = by_account[event.get('accountId')]
        account['total'] += 1
        account['filled' if status == 'FILLED' else 'rejected'] += 1

        occurred = parse_occurred_at(event.get('occurredAt'))
        if occurred is not None:
            by_day[occurred.date().isoformat()]['filled' if status == 'FILLED' else 'rejected'] += 1

        if status == 'FILLED':
            quantity = _decimal(event.get('quantity'))
            price = _decimal(event.get('price'))
            symbol = by_symbol[event.get('symbol') or 'UNKNOWN']
            symbol['fills'] += 1
            symbol['shares'] += quantity
            symbol['notional'] += quantity * price

    volume_by_symbol = [
        {'symbol': symbol, 'fills': data['fills'], 'shares': str(data['shares']),
         'notional': str(data['notional'].quantize(Decimal('0.01')))}
        for symbol, data in sorted(by_symbol.items(), key=lambda item: item[1]['notional'], reverse=True)
    ]
    trades_per_account = [
        {'accountId': account_id, **counts}
        for account_id, counts in sorted(by_account.items(), key=lambda item: (item[1]['total'], str(item[0])),
                                         reverse=True)
    ]
    daily_counts = [{'date': day, **counts} for day, counts in sorted(by_day.items())]

    return {
        'statusCounts': status_counts,
        'volumeBySymbol': volume_by_symbol,
        'tradesPerAccount': trades_per_account,
        'dailyCounts': daily_counts,
    }


def build_segment_insights(events, segments):
    """
    The BR-16 view by client segment: the accounts that resolved an order,
    their fills and rejections and the value filled, per trader level.
    segments maps an account id to its trader's level. Every level is listed,
    lowest first; UNKNOWN follows only when an account the database does not
    know resolved an order.
    """
    def empty():
        return {'accounts': set(), 'total': 0, 'filled': 0, 'rejected': 0, 'notional': Decimal(0)}

    by_segment = {segment: empty() for segment in SEGMENTS}
    for event in events:
        status = event.get('status')
        if status not in ('FILLED', 'REJECTED'):
            continue
        account_id = event.get('accountId')
        entry = by_segment.setdefault(segments.get(account_id, UNKNOWN_SEGMENT), empty())
        entry['accounts'].add(account_id)
        entry['total'] += 1
        if status == 'FILLED':
            entry['filled'] += 1
            entry['notional'] += _decimal(event.get('quantity')) * _decimal(event.get('price'))
        else:
            entry['rejected'] += 1

    return [
        {'segment': segment, 'accounts': len(entry['accounts']), 'total': entry['total'],
         'filled': entry['filled'], 'rejected': entry['rejected'],
         'notional': str(entry['notional'].quantize(Decimal('0.01')))}
        for segment, entry in by_segment.items()
    ]


def load_account_names(session, account_ids):
    """account_id -> {'accountName', 'userName', 'segment'} for the ids that exist; others are absent."""
    ids = [account_id for account_id in account_ids if isinstance(account_id, int)]
    if not ids:
        return {}
    rows = (session.query(Account, User)
            .join(User, Account.user_id == User.user_id)
            .filter(Account.account_id.in_(ids))
            .all())
    return {
        account.account_id: {
            'accountName': account.name,
            'userName': f'{user.first_name} {user.last_name}'.strip(),
            'segment': user.trader_level,
        }
        for account, user in rows
    }


# The product is dark-only, so the charts wear the same TradingSeason tokens as
# the Reporting UI that shows them (apps/reporting-ui/src/styles.css): the card
# surface, frost text, the cyan accent, filled in the gain color and rejected in
# the loss color.
CHART_SURFACE = '#141414'
CHART_TEXT = '#eefaff'
CHART_MUTED = (238 / 255, 250 / 255, 1.0, 0.5)
CHART_BORDER = (238 / 255, 250 / 255, 1.0, 0.15)
CHART_GRID = (238 / 255, 250 / 255, 1.0, 0.09)
CHART_ACCENT = '#00bbff'
CHART_GAIN = '#25eb69'
CHART_LOSS = '#ff3d5a'
BAR_WIDTH = 0.6
# The plot is at least this many bars wide, so a run with one or two bars
# draws them as bars and not as blocks that fill the chart.
MIN_BAR_SLOTS = 8
# Past this many bars the labels are slanted to keep them apart.
MAX_LEVEL_LABELS = 8


def _new_chart(title, ylabel):
    """A figure on the card surface with a right-hand value axis and hairline gridlines."""
    fig, axis = plt.subplots(figsize=(8, 4.5), facecolor=CHART_SURFACE)
    axis.set_facecolor(CHART_SURFACE)
    axis.set_title(title, color=CHART_TEXT, fontsize=12, fontweight='bold', loc='left', pad=14)
    axis.yaxis.tick_right()
    axis.yaxis.set_label_position('right')
    axis.set_ylabel(ylabel, color=CHART_MUTED, labelpad=10)
    axis.tick_params(colors=CHART_MUTED, length=0, labelsize=9)
    for side in ('top', 'left', 'right'):
        axis.spines[side].set_visible(False)
    axis.spines['bottom'].set_color(CHART_BORDER)
    axis.grid(axis='y', color=CHART_GRID, linewidth=0.8)
    axis.set_axisbelow(True)
    return fig, axis


def _fit_bars(axis, count):
    """Give every bar the same slot width whatever their number, and keep their labels readable."""
    axis.set_xlim(-0.5, max(count, MIN_BAR_SLOTS) - 0.5)
    if count > MAX_LEVEL_LABELS:
        plt.setp(axis.get_xticklabels(), rotation=30, ha='right')


def _mark_empty(axis):
    axis.text(0.5, 0.5, 'No trade events yet', ha='center', va='center', color=CHART_MUTED,
              transform=axis.transAxes)
    axis.set_xticks([])
    axis.set_yticks([])


def _write_chart(fig, path):
    fig.tight_layout()
    fig.savefig(path, format='png', dpi=100, facecolor=fig.get_facecolor())
    plt.close(fig)


def _save_bar_chart(path, labels, values, title, ylabel, money=False):
    fig, axis = _new_chart(title, ylabel)
    if labels:
        axis.bar(labels, values, width=BAR_WIDTH, color=CHART_ACCENT)
        _fit_bars(axis, len(labels))
        if money:
            axis.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f'${value:,.0f}'))
        else:
            axis.yaxis.set_major_locator(MaxNLocator(integer=True))
    else:
        _mark_empty(axis)
    _write_chart(fig, path)


def _save_daily_chart(path, daily_counts):
    fig, axis = _new_chart('Trades per day (UTC)', 'Orders resolved')
    if daily_counts:
        days = [row['date'] for row in daily_counts]
        filled = [row['filled'] for row in daily_counts]
        rejected = [row['rejected'] for row in daily_counts]
        # The surface-colored edge leaves a gap between the two stacked segments.
        edge = {'edgecolor': CHART_SURFACE, 'linewidth': 1.5, 'width': BAR_WIDTH}
        axis.bar(days, filled, label='Filled', color=CHART_GAIN, **edge)
        axis.bar(days, rejected, bottom=filled, label='Rejected', color=CHART_LOSS, **edge)
        # Above the plot, level with the title, so it never covers a bar.
        axis.legend(frameon=False, labelcolor=CHART_MUTED, fontsize=9, ncols=2,
                    loc='lower right', bbox_to_anchor=(1.0, 1.0), borderaxespad=0.6)
        _fit_bars(axis, len(days))
        axis.yaxis.set_major_locator(MaxNLocator(integer=True))
    else:
        _mark_empty(axis)
    _write_chart(fig, path)


def render_charts(insights, run_dir):
    """Write the four PNG charts into run_dir and return their file names."""
    run_dir = Path(run_dir)
    volume = insights['volumeBySymbol']
    _save_bar_chart(run_dir / 'volume_by_symbol.png',
                    [row['symbol'] for row in volume],
                    [float(row['notional']) for row in volume],
                    'Traded value by symbol (filled orders)', 'Notional', money=True)
    _save_daily_chart(run_dir / 'daily_trades.png', insights['dailyCounts'])
    # Every level is drawn once any order has resolved, so a level that traded nothing shows as nothing.
    segments = insights['activityBySegment']
    if not any(row['total'] for row in segments):
        segments = []
    _save_bar_chart(run_dir / 'volume_by_segment.png',
                    [row['segment'].capitalize() for row in segments],
                    [float(row['notional']) for row in segments],
                    'Traded value by client segment (filled orders)', 'Notional', money=True)
    accounts = insights['tradesPerAccount']
    _save_bar_chart(run_dir / 'trades_per_account.png',
                    [row.get('label') or str(row['accountId']) for row in accounts],
                    [row['total'] for row in accounts],
                    'Orders per account', 'Orders resolved')
    return ['volume_by_symbol.png', 'daily_trades.png', 'volume_by_segment.png', 'trades_per_account.png']


def run_report(files_dir, session, now=None, keep_runs=1):
    """
    Produce one run and make it the latest. Returns the report dict.

    Writes into runs/<id>.tmp first and renames, so a reader never sees a
    half-written run. The latest pointer is replaced atomically. Older runs
    beyond keep_runs are deleted afterwards.
    """
    files_dir = Path(files_dir)
    now = now or datetime.now(timezone.utc)
    run_id = now.strftime(RUN_ID_FORMAT)

    events = load_events(files_dir)
    insights = build_insights(events)
    names = load_account_names(session, [row['accountId'] for row in insights['tradesPerAccount']])
    for row in insights['tradesPerAccount']:
        info = names.get(row['accountId'], {})
        row['accountName'] = info.get('accountName')
        row['userName'] = info.get('userName')
        row['label'] = f"{row['accountName']} ({row['userName']})" if info else str(row['accountId'])
    insights['activityBySegment'] = build_segment_insights(
        events, {account_id: info['segment'] for account_id, info in names.items()})

    base = runs_dir(files_dir)
    base.mkdir(parents=True, exist_ok=True)
    staging = base / f'{run_id}.tmp'
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir()

    files = render_charts(insights, staging)
    report = {
        'runId': run_id,
        'generatedAt': now.isoformat(),
        'timezone': 'UTC',
        'eventCount': len(events),
        **insights,
        'files': files,
    }
    with open(staging / REPORT_FILE, 'w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2)

    final = base / run_id
    if final.exists():
        shutil.rmtree(final)
    os.replace(staging, final)

    pointer_tmp = base / f'{LATEST_FILE}.tmp'
    pointer_tmp.write_text(run_id + '\n', encoding='utf-8')
    os.replace(pointer_tmp, base / LATEST_FILE)

    _prune_runs(base, keep_runs)
    logger.info('Report run %s written: %s events, %s filled, %s rejected',
                run_id, len(events), insights['statusCounts']['FILLED'], insights['statusCounts']['REJECTED'])
    return report


def _prune_runs(base, keep_runs):
    runs = sorted((child for child in base.iterdir() if child.is_dir() and not child.name.endswith('.tmp')),
                  key=lambda child: child.name, reverse=True)
    for stale in runs[max(keep_runs, 1):]:
        shutil.rmtree(stale, ignore_errors=True)
