/**
 * What this service tells the reporting service beyond order statuses. The
 * reporting service has no database connection, so each row it shows that an
 * {@link app.order.event.OrderStatusEvent} does not carry is raised as a
 * {@link app.record.PlatformRecord} in the transaction that wrote it and sent
 * to the {@code platform-records} topic by
 * {@link app.record.PlatformRecordPublisher} after the commit: every audit
 * trail entry ({@link app.record.AuditEntryRecord}).
 *
 * <p>The Holdings and Trade Service and the auth service publish the other
 * record types to the same topic. The publisher is registered only when
 * {@code app.events.enabled} is {@code true}.
 */
package app.record;
