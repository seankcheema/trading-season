"""
Reporting API Routes
Defines the REST endpoints for portfolio and trade data
"""

from flask import Blueprint, jsonify, request, g
from datetime import datetime, timedelta
from db_service import (
    AccountRepository, HoldingRepository, OrderRepository, 
    TradeRepository, UserRepository
)
from app import require_auth
import logging

logger = logging.getLogger(__name__)

# Create blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api/reporting')


# ============================================================================
# Portfolio Endpoints
# ============================================================================

@api_bp.route('/portfolio', methods=['GET'])
@require_auth
def get_portfolio_summary():
    """
    GET /api/reporting/portfolio
    
    Get user's portfolio summary across all accounts
    Includes: accounts list, total holdings, total cash
    """
    try:
        user_id = g.user_id
        
        # Get user accounts
        accounts = AccountRepository.get_user_accounts(user_id)
        if not accounts:
            return jsonify({'accounts': [], 'summary': {}}), 200
        
        # Aggregate data across accounts
        total_cash = 0.0
        total_holdings_value = 0.0
        account_summaries = []
        
        for account in accounts:
            summary = AccountRepository.get_account_summary(account.account_id)
            total_cash += summary['cash_balance']
            
            # Get holdings for this account
            holdings = HoldingRepository.get_account_holdings(account.account_id)
            holdings_value = sum(h['total_value'] for h in holdings)
            total_holdings_value += holdings_value
            
            summary['holdings'] = holdings
            summary['holdings_value'] = holdings_value
            account_summaries.append(summary)
        
        # Get user's available funds
        user = UserRepository.get_user(user_id)
        available_funds = float(user.available_funds) if user else 0.0
        
        return jsonify({
            'user_id': str(user_id),
            'accounts': account_summaries,
            'summary': {
                'total_accounts': len(accounts),
                'total_cash': total_cash,
                'total_holdings_value': total_holdings_value,
                'total_portfolio_value': total_cash + total_holdings_value,
                'available_funds': available_funds
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting portfolio: {e}")
        return jsonify({'error': 'Failed to retrieve portfolio'}), 500


@api_bp.route('/portfolio/<int:account_id>', methods=['GET'])
@require_auth
def get_account_portfolio(account_id):
    """
    GET /api/reporting/portfolio/{accountId}
    
    Get portfolio for a specific account
    Includes: account details, holdings with market values
    """
    try:
        user_id = g.user_id
        
        # Verify account belongs to user
        account = AccountRepository.get_account(account_id)
        if not account or str(account.user_id) != str(user_id):
            return jsonify({'error': 'Account not found or access denied'}), 404
        
        # Get account summary
        summary = AccountRepository.get_account_summary(account_id)
        
        # Get holdings
        holdings = HoldingRepository.get_account_holdings(account_id)
        
        return jsonify({
            'account': summary,
            'holdings': holdings,
            'portfolio_value': sum(h['total_value'] for h in holdings) + summary['cash_balance'],
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting account portfolio: {e}")
        return jsonify({'error': 'Failed to retrieve account portfolio'}), 500


# ============================================================================
# Trade History Endpoints
# ============================================================================

@api_bp.route('/trades', methods=['GET'])
@require_auth
def get_trades():
    """
    GET /api/reporting/trades
    
    Get trade history for user across all accounts
    Query parameters:
    - account_id: (optional) filter by specific account
    - symbol: (optional) filter by instrument symbol
    - order_type: (optional) filter by BUY/SELL
    - status: (optional) filter by FILLED/REJECTED/PENDING
    - start_date: (optional) ISO-8601 date (2026-01-01)
    - end_date: (optional) ISO-8601 date
    - min_profit: (optional) minimum profit in currency
    - max_profit: (optional) maximum profit in currency
    - limit: (optional, default=100) max results
    - offset: (optional, default=0) pagination offset
    """
    try:
        user_id = g.user_id
        
        # Parse query parameters
        account_id = request.args.get('account_id', type=int)
        symbol = request.args.get('symbol', type=str)
        order_type = request.args.get('order_type', type=str)
        status = request.args.get('status', type=str)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        min_profit = request.args.get('min_profit', type=float)
        max_profit = request.args.get('max_profit', type=float)
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        # Validate limit
        if limit > 500:
            limit = 500
        if limit < 1:
            limit = 1
        
        # Parse dates
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str)
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO-8601 (YYYY-MM-DD)'}), 400
        
        trades = []
        
        if account_id:
            # Get trades for specific account
            account = AccountRepository.get_account(account_id)
            if not account or str(account.user_id) != str(user_id):
                return jsonify({'error': 'Account not found or access denied'}), 404
            
            trades = TradeRepository.get_trade_history(account_id, start_date, end_date)
        else:
            # Get trades for all user accounts
            accounts = AccountRepository.get_user_accounts(user_id)
            for account in accounts:
                account_trades = TradeRepository.get_trade_history(
                    account.account_id, start_date, end_date
                )
                trades.extend(account_trades)
            
            # Sort by executed_at descending (newest first)
            trades.sort(key=lambda t: t['executed_at'], reverse=True)
        
        # Apply additional filters
        if symbol:
            trades = [t for t in trades if t['symbol'].upper() == symbol.upper()]
        
        if order_type:
            trades = [t for t in trades if t['order_type'].upper() == order_type.upper()]
        
        if status:
            trades = [t for t in trades if t.get('status', '').upper() == status.upper()]
        
        if min_profit is not None or max_profit is not None:
            filtered_trades = []
            for t in trades:
                realized_pl = t.get('realized_pl', 0.0)
                if min_profit is not None and realized_pl < min_profit:
                    continue
                if max_profit is not None and realized_pl > max_profit:
                    continue
                filtered_trades.append(t)
            trades = filtered_trades
        
        # Calculate statistics before pagination
        trade_stats = _calculate_trade_statistics(trades)
        
        # Apply limit and offset
        paginated_trades = trades[offset:offset + limit]
        
        return jsonify({
            'user_id': str(user_id),
            'trades': paginated_trades,
            'statistics': trade_stats,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': len(trades),
                'returned': len(paginated_trades)
            },
            'filters': {
                'account_id': account_id,
                'symbol': symbol,
                'order_type': order_type,
                'status': status,
                'start_date': start_date_str,
                'end_date': end_date_str,
                'min_profit': min_profit,
                'max_profit': max_profit
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting trades: {e}")
        return jsonify({'error': 'Failed to retrieve trades'}), 500


@api_bp.route('/trades/<int:order_id>', methods=['GET'])
@require_auth
def get_trade_detail(order_id):
    """
    GET /api/reporting/trades/{orderId}
    
    Get details for a specific trade/order
    """
    try:
        user_id = g.user_id
        
        order = OrderRepository.get_order(order_id)
        if not order or str(order.get('user_id')) != str(user_id):
            return jsonify({'error': 'Trade not found or access denied'}), 404
        
        return jsonify({
            'trade': order,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting trade detail: {e}")
        return jsonify({'error': 'Failed to retrieve trade detail'}), 500


# ============================================================================
# User Profile Endpoints
# ============================================================================

@api_bp.route('/trades/statistics', methods=['GET'])
@require_auth
def get_trade_statistics():
    """
    GET /api/reporting/trades/statistics
    
    Get trade statistics and performance metrics
    Query parameters:
    - account_id: (optional) filter by specific account
    - start_date: (optional) ISO-8601 date
    - end_date: (optional) ISO-8601 date
    """
    try:
        user_id = g.user_id
        
        # Parse query parameters
        account_id = request.args.get('account_id', type=int)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Parse dates
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str)
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO-8601 (YYYY-MM-DD)'}), 400
        
        trades = []
        
        if account_id:
            # Get trades for specific account
            account = AccountRepository.get_account(account_id)
            if not account or str(account.user_id) != str(user_id):
                return jsonify({'error': 'Account not found or access denied'}), 404
            
            trades = TradeRepository.get_trade_history(account_id, start_date, end_date)
        else:
            # Get trades for all user accounts
            accounts = AccountRepository.get_user_accounts(user_id)
            for account in accounts:
                account_trades = TradeRepository.get_trade_history(
                    account.account_id, start_date, end_date
                )
                trades.extend(account_trades)
        
        # Calculate statistics
        stats = _calculate_trade_statistics(trades)
        
        return jsonify({
            'user_id': str(user_id),
            'statistics': stats,
            'filters': {
                'account_id': account_id,
                'start_date': start_date_str,
                'end_date': end_date_str
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting trade statistics: {e}")
        return jsonify({'error': 'Failed to retrieve trade statistics'}), 500


@api_bp.route('/trades/drill-down', methods=['GET'])
@require_auth
def get_trade_drilldown():
    """
    GET /api/reporting/trades/drill-down
    
    Get detailed drill-down analysis of trades
    Breakdown by: symbol, order type, and performance
    Query parameters:
    - account_id: (optional) filter by specific account
    - start_date: (optional) ISO-8601 date
    - end_date: (optional) ISO-8601 date
    """
    try:
        user_id = g.user_id
        
        # Parse query parameters
        account_id = request.args.get('account_id', type=int)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Parse dates
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str)
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO-8601 (YYYY-MM-DD)'}), 400
        
        trades = []
        
        if account_id:
            # Get trades for specific account
            account = AccountRepository.get_account(account_id)
            if not account or str(account.user_id) != str(user_id):
                return jsonify({'error': 'Account not found or access denied'}), 404
            
            trades = TradeRepository.get_trade_history(account_id, start_date, end_date)
        else:
            # Get trades for all user accounts
            accounts = AccountRepository.get_user_accounts(user_id)
            for account in accounts:
                account_trades = TradeRepository.get_trade_history(
                    account.account_id, start_date, end_date
                )
                trades.extend(account_trades)
        
        # Drill-down analysis
        by_symbol = _analyze_by_symbol(trades)
        by_order_type = _analyze_by_order_type(trades)
        best_worst = _get_best_worst_trades(trades)
        
        return jsonify({
            'user_id': str(user_id),
            'by_symbol': by_symbol,
            'by_order_type': by_order_type,
            'best_trades': best_worst['best'],
            'worst_trades': best_worst['worst'],
            'filters': {
                'account_id': account_id,
                'start_date': start_date_str,
                'end_date': end_date_str
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting trade drill-down: {e}")
        return jsonify({'error': 'Failed to retrieve trade drill-down'}), 500


# ============================================================================
# User Profile Endpoints
# ============================================================================

@api_bp.route('/profile', methods=['GET'])
@require_auth
def get_user_profile():
    """
    GET /api/reporting/profile
    
    Get current user's profile information
    """
    try:
        user_id = g.user_id
        user = UserRepository.get_user(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user_id': str(user.user_id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'trader_level': user.trader_level,
            'available_funds': float(user.available_funds),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        return jsonify({'error': 'Failed to retrieve user profile'}), 500


# ============================================================================
# Helper Functions for Statistics and Analysis
# ============================================================================

def _calculate_trade_statistics(trades):
    """
    Calculate comprehensive trade statistics from a list of trades
    Returns dict with: total_trades, win_count, loss_count, win_rate,
                      profit_factor, total_realized_pl, avg_profit, avg_loss
    """
    if not trades:
        return {
            'total_trades': 0,
            'filled_trades': 0,
            'win_count': 0,
            'loss_count': 0,
            'break_even_count': 0,
            'win_rate': 0.0,
            'profit_factor': 0.0,
            'total_realized_pl': 0.0,
            'average_profit': 0.0,
            'average_loss': 0.0,
            'gross_profit': 0.0,
            'gross_loss': 0.0
        }
    
    total_trades = len(trades)
    filled_trades = len([t for t in trades if t.get('filled_quantity', 0) > 0])
    
    winning_trades = [t for t in trades if t.get('realized_pl', 0) > 0]
    losing_trades = [t for t in trades if t.get('realized_pl', 0) < 0]
    breakeven_trades = [t for t in trades if t.get('realized_pl', 0) == 0]
    
    win_count = len(winning_trades)
    loss_count = len(losing_trades)
    breakeven_count = len(breakeven_trades)
    
    win_rate = (win_count / filled_trades * 100) if filled_trades > 0 else 0.0
    
    gross_profit = sum(t.get('realized_pl', 0) for t in winning_trades)
    gross_loss = abs(sum(t.get('realized_pl', 0) for t in losing_trades))
    
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (1.0 if gross_profit > 0 else 0.0)
    
    total_realized_pl = sum(t.get('realized_pl', 0) for t in trades)
    
    avg_profit = (gross_profit / win_count) if win_count > 0 else 0.0
    avg_loss = (gross_loss / loss_count) if loss_count > 0 else 0.0
    
    return {
        'total_trades': total_trades,
        'filled_trades': filled_trades,
        'win_count': win_count,
        'loss_count': loss_count,
        'break_even_count': breakeven_count,
        'win_rate': round(win_rate, 2),
        'profit_factor': round(profit_factor, 2),
        'total_realized_pl': round(total_realized_pl, 2),
        'average_profit': round(avg_profit, 2),
        'average_loss': round(avg_loss, 2),
        'gross_profit': round(gross_profit, 2),
        'gross_loss': round(gross_loss, 2)
    }


def _analyze_by_symbol(trades):
    """
    Analyze trades grouped by instrument symbol
    Returns list of dict with symbol, count, realized_pl, win_rate
    """
    from collections import defaultdict
    
    by_symbol = defaultdict(list)
    for trade in trades:
        symbol = trade.get('symbol', 'UNKNOWN')
        by_symbol[symbol].append(trade)
    
    result = []
    for symbol, symbol_trades in sorted(by_symbol.items()):
        stats = _calculate_trade_statistics(symbol_trades)
        result.append({
            'symbol': symbol,
            'count': len(symbol_trades),
            'filled_trades': stats['filled_trades'],
            'total_realized_pl': stats['total_realized_pl'],
            'win_rate': stats['win_rate'],
            'average_profit': stats['average_profit'],
            'average_loss': stats['average_loss']
        })
    
    return sorted(result, key=lambda x: x['total_realized_pl'], reverse=True)


def _analyze_by_order_type(trades):
    """
    Analyze trades grouped by order type (BUY/SELL)
    Returns list of dict with order_type, count, realized_pl, win_rate
    """
    from collections import defaultdict
    
    by_type = defaultdict(list)
    for trade in trades:
        order_type = trade.get('order_type', 'UNKNOWN')
        by_type[order_type].append(trade)
    
    result = []
    for order_type, type_trades in sorted(by_type.items()):
        stats = _calculate_trade_statistics(type_trades)
        result.append({
            'order_type': order_type,
            'count': len(type_trades),
            'filled_trades': stats['filled_trades'],
            'total_realized_pl': stats['total_realized_pl'],
            'win_rate': stats['win_rate'],
            'average_profit': stats['average_profit'],
            'average_loss': stats['average_loss']
        })
    
    return result


def _get_best_worst_trades(trades, limit=5):
    """
    Get best and worst performing trades
    Returns dict with 'best' and 'worst' lists of trades
    """
    sorted_by_pl = sorted(trades, key=lambda t: t.get('realized_pl', 0), reverse=True)
    
    return {
        'best': sorted_by_pl[:limit],
        'worst': sorted_by_pl[-limit:] if len(sorted_by_pl) >= limit else sorted_by_pl[:limit]
    }


def init_routes(app):
    """Register routes with Flask app"""
    app.register_blueprint(api_bp)
    logger.info("Registered API routes")
