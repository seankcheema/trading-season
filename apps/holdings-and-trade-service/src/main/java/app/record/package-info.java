/**
 * What this service tells the reporting service. The reporting service has
 * no database connection, so each row it shows that this service writes is
 * raised as a {@link app.record.PlatformRecord} in the transaction that wrote
 * it and sent to the {@code platform-records} topic by
 * {@link app.record.PlatformRecordPublisher} after the commit: a new profile
 * ({@link app.record.CustomerProfileRecord}), an account opened or renamed
 * ({@link app.record.TradingAccountRecord}), a deposit or withdrawal
 * ({@link app.record.CashTransferRecord}), a portfolio valuation
 * ({@link app.record.PortfolioValuationRecord}) and the session prices are
 * replayed from ({@link app.record.MarketSessionRecord}).
 *
 * <p>The Order and Sell Service publishes audit trail entries and the auth
 * service publishes sign-ins to the same topic. The publisher is registered
 * only when {@code app.events.enabled} is {@code true}.
 */
package app.record;
