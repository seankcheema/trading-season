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
    - start_date: (optional) ISO-8601 date (2026-01-01)
    - end_date: (optional) ISO-8601 date
    - limit: (optional, default=100) max results
    - offset: (optional, default=0) pagination offset
    """
    try:
        user_id = g.user_id
        
        # Parse query parameters
        account_id = request.args.get('account_id', type=int)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
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
        
        # Apply limit and offset
        paginated_trades = trades[offset:offset + limit]
        
        return jsonify({
            'user_id': str(user_id),
            'trades': paginated_trades,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': len(trades),
                'returned': len(paginated_trades)
            },
            'filters': {
                'account_id': account_id,
                'start_date': start_date_str,
                'end_date': end_date_str
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


def init_routes(app):
    """Register routes with Flask app"""
    app.register_blueprint(api_bp)
    logger.info("Registered API routes")
