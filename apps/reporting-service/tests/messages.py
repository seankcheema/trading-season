"""
Messages as the trading services publish them, for tests that start from
what arrives on the topics instead of from rows.

The shapes follow the producers: OrderStatusEvent in the Order and Sell
Service, the PlatformRecord types in both Java services, and the auth
service's SignInRecord.
"""

SEAN = 'a0000000-0000-4000-8000-00000000000a'
JANE = 'b0000000-0000-4000-8000-00000000000b'


def sign_in(user_id=SEAN, email='sean@example.com', role='TRADER', failed=0, locked_until=None,
            created_at='2026-09-01T09:00:00.000Z', updated_at='2026-09-01T09:00:00.000Z'):
    return {'type': 'SIGN_IN', 'userId': user_id, 'email': email, 'role': role, 'failedLoginAttempts': failed,
            'lockedUntil': locked_until, 'createdAt': created_at, 'updatedAt': updated_at}


def profile(user_id=SEAN, first='Sean', last='Cheema', level='ADVANCED', funds=10000.00,
            as_of='2026-09-01T09:00:05Z', created_at='2026-09-01T09:00:05Z', timeout=10, last_activity=None):
    return {'type': 'CUSTOMER_PROFILE', 'userId': user_id, 'firstName': first, 'lastName': last,
            'traderLevel': level, 'availableFunds': funds, 'sessionTimeoutMinutes': timeout,
            'lastActivityAt': last_activity, 'createdAt': created_at, 'asOf': as_of}


def account(account_id=1, user_id=SEAN, name='Main Account', opened='2026-09-01', currency='USD'):
    return {'type': 'TRADING_ACCOUNT', 'accountId': account_id, 'userId': user_id, 'name': name,
            'openedDate': opened, 'currency': currency}


def transfer(transfer_id, account_id=1, user_id=SEAN, amount=500.00, reason='DEPOSIT',
             created_at='2026-10-05T12:00:00Z', funds=None):
    return {'type': 'CASH_TRANSFER', 'cashTransactionId': transfer_id, 'accountId': account_id, 'userId': user_id,
            'amount': amount, 'reason': reason, 'createdAt': created_at, 'availableFunds': funds}


def valuation(valuation_id, account_id=1, value=1500.00, observed_at='2026-10-05T12:00:00Z'):
    return {'type': 'PORTFOLIO_VALUATION', 'valuationId': valuation_id, 'accountId': account_id,
            'observedAt': observed_at, 'portfolioValue': value}


def audit(audit_id, order_id, event_type, detail=None, recorded_at='2026-10-05T09:30:00Z'):
    return {'type': 'ORDER_AUDIT', 'auditId': audit_id, 'orderId': order_id, 'eventType': event_type,
            'detail': detail, 'recordedAt': recorded_at}


def market_session(session_id=2026001):
    return {'type': 'MARKET_SESSION', 'sessionId': session_id}


def order_event(order_id, status, account_id=1, symbol='AAPL', name='Apple Inc.', instrument_id=3, side='BUY',
                quantity=10, price=100.00, reason=None, submitted_at='2026-10-05T09:30:00Z', accepted_at=None,
                resolved_at=None, execution=None):
    """One trade-events line as the consumer stores it: the account id is the message key."""
    occurred_at = resolved_at or accepted_at or submitted_at
    return {
        'accountId': account_id, 'orderId': order_id, 'status': status, 'symbol': symbol, 'side': side,
        'quantity': quantity, 'price': price, 'rejectionReason': reason, 'occurredAt': occurred_at,
        'order': {
            'clientReference': f'c0000000-0000-4000-8000-{order_id:012d}', 'instrumentId': instrument_id,
            'instrumentName': name, 'indicativePrice': price, 'bufferPercent': 0.50,
            'submittedAt': submitted_at, 'acceptedAt': accepted_at, 'resolvedAt': resolved_at, 'simulatedAt': None,
        },
        'execution': execution,
    }


def execution(fill_id, cash_id, movement_id, user_id=SEAN, price=100.00, quantity=10, cash_amount=-1000.00,
              funds=9000.00, delta=10, held=10, filled_at='2026-10-05T09:30:01Z'):
    return {'userId': user_id, 'fillId': fill_id, 'price': price, 'quantity': quantity, 'filledAt': filled_at,
            'cashTransactionId': cash_id, 'cashAmount': cash_amount, 'availableFunds': funds,
            'holdingMovementId': movement_id, 'quantityDelta': delta, 'holdingQuantity': held}


def filled(order_id, fill_id, cash_id, movement_id, at='2026-10-05T09:30:01Z', **kwargs):
    """A FILLED event with its execution; keyword arguments go to whichever of the two takes them."""
    execution_keys = ('user_id', 'cash_amount', 'funds', 'delta', 'held')
    execution_args = {key: kwargs.pop(key) for key in execution_keys if key in kwargs}
    price = kwargs.get('price', 100.00)
    quantity = kwargs.get('quantity', 10)
    return order_event(order_id, 'FILLED', accepted_at=at, resolved_at=at,
                       execution=execution(fill_id, cash_id, movement_id, price=price, quantity=quantity,
                                           filled_at=at, **execution_args),
                       **kwargs)
