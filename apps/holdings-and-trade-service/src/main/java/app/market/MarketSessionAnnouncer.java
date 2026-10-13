package app.market;

import app.record.MarketSessionRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Tells the reporting service which simulation session prices are replayed
 * from, once, when this service has started. The reporting service shows the
 * session beside its figures and cannot read {@code simulation_sessions}
 * itself.
 *
 * <p>A session imported while the service is running is announced at the
 * next start. Absent when {@code app.events.enabled} is {@code false}.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true", matchIfMissing = true)
public class MarketSessionAnnouncer {

    private static final Logger LOG = LoggerFactory.getLogger(MarketSessionAnnouncer.class);

    private final MarketDataRepository sessions;
    private final ApplicationEventPublisher events;

    /**
     * Creates the announcer.
     *
     * @param sessions resolves the newest completed session
     * @param events   publisher of the {@link MarketSessionRecord}
     */
    public MarketSessionAnnouncer(MarketDataRepository sessions, ApplicationEventPublisher events) {
        this.sessions = sessions;
        this.events = events;
    }

    /**
     * Raises a {@link MarketSessionRecord} for the newest completed session.
     * A database without one, or without market data at all, announces
     * nothing. Never throws, so it cannot stop the service from starting.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void announce() {
        try {
            long sessionId = sessions.resolveSession(null).id();
            events.publishEvent(new MarketSessionRecord(sessionId));
            LOG.info("Announced simulation session {} to reporting", sessionId);
        } catch (RuntimeException unavailable) {
            LOG.info("No simulation session to announce to reporting: {}", unavailable.toString());
        }
    }
}
