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
import math

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

# ============================================================================
# Performance Metrics Endpoints
# ============================================================================

@api_bp.route('/portfolio/<int:account_id>/performance', methods=['GET'])
@require_auth
def get_account_performance(account_id):
    """
    GET /api/reporting/portfolio/{accountId}/performance
    
    Get detailed performance metrics for a specific account
    Returns: total return, return %, Sharpe ratio, Sortino ratio, max drawdown
    Query parameters:
    - start_date: (optional) ISO-8601 date
    - end_date: (optional) ISO-8601 date
    """
    try:
        user_id = g.user_id
        
        # Verify account belongs to user
        account = AccountRepository.get_account(account_id)
        if not account or str(account.user_id) != str(user_id):
            return jsonify({'error': 'Account not found or access denied'}), 404
        
        # Parse dates
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str)
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO-8601 (YYYY-MM-DD)'}), 400
        
        # Get trade history for account
        trades = TradeRepository.get_trade_history(account_id, start_date, end_date)
        
        # Calculate performance metrics
        performance = _calculate_performance_metrics(trades)
        
        # Get current holdings and cash
        summary = AccountRepository.get_account_summary(account_id)
        holdings = HoldingRepository.get_account_holdings(account_id)
        
        return jsonify({
            'account_id': account_id,
            'performance': performance,
            'current_position': {
                'cash_balance': summary['cash_balance'],
                'total_holdings_value': sum(h['total_value'] for h in holdings),
                'total_portfolio_value': summary['cash_balance'] + sum(h['total_value'] for h in holdings)
            },
            'filters': {
                'start_date': start_date_str,
                'end_date': end_date_str
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting account performance: {e}")
        return jsonify({'error': 'Failed to retrieve account performance'}), 500


@api_bp.route('/portfolio/performance', methods=['GET'])
@require_auth
def get_portfolio_performance():
    """
    GET /api/reporting/portfolio/performance
    
    Get aggregated performance metrics across all user accounts
    Returns: total return, weighted return %, Sharpe ratio, max drawdown
    Query parameters:
    - start_date: (optional) ISO-8601 date
    - end_date: (optional) ISO-8601 date
    """
    try:
        user_id = g.user_id
        
        # Parse dates
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str)
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO-8601 (YYYY-MM-DD)'}), 400
        
        # Get all user accounts
        accounts = AccountRepository.get_user_accounts(user_id)
        if not accounts:
            return jsonify({'error': 'No accounts found'}), 404
        
        # Aggregate trades across all accounts
        all_trades = []
        for account in accounts:
            trades = TradeRepository.get_trade_history(account.account_id, start_date, end_date)
            all_trades.extend(trades)
        
        # Calculate performance metrics
        performance = _calculate_performance_metrics(all_trades)
        
        # Get current portfolio position
        total_cash = 0.0
        total_holdings_value = 0.0
        for account in accounts:
            summary = AccountRepository.get_account_summary(account.account_id)
            holdings = HoldingRepository.get_account_holdings(account.account_id)
            total_cash += summary['cash_balance']
            total_holdings_value += sum(h['total_value'] for h in holdings)
        
        return jsonify({
            'user_id': str(user_id),
            'accounts_count': len(accounts),
            'performance': performance,
            'current_position': {
                'total_cash': total_cash,
                'total_holdings_value': total_holdings_value,
                'total_portfolio_value': total_cash + total_holdings_value
            },
            'filters': {
                'start_date': start_date_str,
                'end_date': end_date_str
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting portfolio performance: {e}")
        return jsonify({'error': 'Failed to retrieve portfolio performance'}), 500


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


def _calculate_performance_metrics(trades):
    """
    Calculate comprehensive performance metrics from trade list
    Returns dict with: total_return, return_percent, sharpe_ratio, sortino_ratio, max_drawdown
    
    Key assumptions:
    - Risk-free rate: 2.0% annual (0.005% daily)
    - Assumes regular daily returns calculation
    """
    if not trades:
        return {
            'total_return': 0.0,
            'return_percent': 0.0,
            'sharpe_ratio': 0.0,
            'sortino_ratio': 0.0,
            'max_drawdown': 0.0,
            'current_drawdown': 0.0,
            'volatility': 0.0,
            'downside_deviation': 0.0,
            'trade_count': 0,
            'starting_capital': 0.0,
            'ending_capital': 0.0
        }
    
    # Calculate total realized P&L
    total_return = sum(t.get('realized_pl', 0) for t in trades)
    
    # Estimate starting capital (simple: assume 10000 base + total deposits/withdrawals)
    cash_transactions = []  # Would need to fetch from CashTransactionRepository if detailed analysis
    estimated_starting_capital = 10000.0  # Default assumption
    
    # Calculate return percentage
    return_percent = (total_return / estimated_starting_capital * 100) if estimated_starting_capital > 0 else 0.0
    
    # Calculate daily returns for risk metrics
    daily_returns = _calculate_daily_returns(trades)
    
    # Calculate volatility (standard deviation of daily returns)
    volatility = _calculate_volatility(daily_returns)
    
    # Calculate Sharpe ratio (annual)
    risk_free_rate = 0.02  # 2% annual
    excess_return = (total_return / estimated_starting_capital) - risk_free_rate
    sharpe_ratio = (excess_return / volatility * math.sqrt(252)) if volatility > 0 else 0.0
    
    # Calculate downside deviation (for Sortino)
    downside_deviation = _calculate_downside_deviation(daily_returns)
    
    # Calculate Sortino ratio (annual)
    sortino_ratio = (excess_return / downside_deviation * math.sqrt(252)) if downside_deviation > 0 else 0.0
    
    # Calculate maximum drawdown
    max_drawdown = _calculate_max_drawdown(trades)
    
    # Calculate current drawdown (from peak)
    current_drawdown = _calculate_current_drawdown(trades)
    
    return {
        'total_return': round(total_return, 2),
        'return_percent': round(return_percent, 2),
        'sharpe_ratio': round(sharpe_ratio, 2),
        'sortino_ratio': round(sortino_ratio, 2),
        'max_drawdown': round(max_drawdown, 2),
        'current_drawdown': round(current_drawdown, 2),
        'volatility': round(volatility, 4),
        'downside_deviation': round(downside_deviation, 4),
        'trade_count': len(trades),
        'starting_capital': round(estimated_starting_capital, 2),
        'ending_capital': round(estimated_starting_capital + total_return, 2)
    }


def _calculate_daily_returns(trades):
    """
    Calculate daily returns from trades
    Returns list of daily return percentages
    """
    if not trades:
        return [0.0]
    
    # Group trades by date
    from collections import defaultdict
    daily_pnl = defaultdict(float)
    
    for trade in trades:
        executed_at = trade.get('executed_at')
        if not executed_at:
            continue
        
        # Parse timestamp if string
        if isinstance(executed_at, str):
            try:
                trade_date = datetime.fromisoformat(executed_at).date()
            except:
                continue
        else:
            trade_date = executed_at.date()
        
        daily_pnl[trade_date] += trade.get('realized_pl', 0)
    
    if not daily_pnl:
        return [0.0]
    
    # Convert to daily returns (assuming 10000 base per day)
    daily_returns = [pnl / 10000.0 for pnl in daily_pnl.values()]
    return daily_returns if daily_returns else [0.0]


def _calculate_volatility(daily_returns):
    """
    Calculate annualized volatility (standard deviation)
    """
    if len(daily_returns) < 2:
        return 0.0
    
    mean_return = sum(daily_returns) / len(daily_returns)
    variance = sum((r - mean_return) ** 2 for r in daily_returns) / len(daily_returns)
    daily_volatility = math.sqrt(variance) if variance >= 0 else 0.0
    
    # Annualize: multiply by sqrt(252 trading days)
    annualized_volatility = daily_volatility * math.sqrt(252)
    return annualized_volatility


def _calculate_downside_deviation(daily_returns):
    """
    Calculate downside deviation (only negative returns)
    For Sortino ratio calculation
    """
    if len(daily_returns) < 2:
        return 0.0
    
    # Risk-free rate as threshold
    risk_free_daily = 0.02 / 252
    
    # Only include returns below risk-free rate
    downside_returns = [r - risk_free_daily for r in daily_returns if r < risk_free_daily]
    
    if not downside_returns:
        return 0.0
    
    variance = sum(r ** 2 for r in downside_returns) / len(downside_returns)
    daily_downside_dev = math.sqrt(variance) if variance >= 0 else 0.0
    
    # Annualize
    annualized_downside_dev = daily_downside_dev * math.sqrt(252)
    return annualized_downside_dev


def _calculate_max_drawdown(trades):
    """
    Calculate maximum drawdown from peak to trough
    """
    if not trades:
        return 0.0
    
    # Sort by executed_at
    sorted_trades = sorted(trades, key=lambda t: t.get('executed_at', ''))
    
    # Calculate cumulative P&L
    cumulative_pnl = 0.0
    peak = 0.0
    max_drawdown = 0.0
    
    for trade in sorted_trades:
        cumulative_pnl += trade.get('realized_pl', 0)
        
        if cumulative_pnl > peak:
            peak = cumulative_pnl
        
        drawdown = peak - cumulative_pnl
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    return max_drawdown


def _calculate_current_drawdown(trades):
    """
    Calculate current drawdown from peak
    """
    if not trades:
        return 0.0
    
    # Sort by executed_at
    sorted_trades = sorted(trades, key=lambda t: t.get('executed_at', ''))
    
    # Calculate cumulative P&L
    cumulative_pnl = 0.0
    peak = 0.0
    
    for trade in sorted_trades:
        cumulative_pnl += trade.get('realized_pl', 0)
        if cumulative_pnl > peak:
            peak = cumulative_pnl
    
    # Current drawdown is peak minus current
    current_drawdown = peak - cumulative_pnl
    return current_drawdown


def init_routes(app):
    """Register routes with Flask app"""
    app.register_blueprint(api_bp)
    logger.info("Registered API routes")
