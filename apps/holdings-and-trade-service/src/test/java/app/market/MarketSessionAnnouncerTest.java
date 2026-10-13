package app.market;

import app.record.MarketSessionRecord;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("unit")
class MarketSessionAnnouncerTest {

    private final MarketDataRepository sessions = mock(MarketDataRepository.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final MarketSessionAnnouncer announcer = new MarketSessionAnnouncer(sessions, events);

    @Test
    void announcesTheNewestCompletedSession() {
        when(sessions.resolveSession(null)).thenReturn(new MarketModels.Session(2026001L, "parquet", "/archive"));

        announcer.announce();

        verify(events).publishEvent(new MarketSessionRecord(2026001L));
    }

    @Test
    void aDatabaseWithoutACompletedSessionAnnouncesNothingAndDoesNotStopStartup() {
        when(sessions.resolveSession(null))
                .thenThrow(new MarketRequestException("Completed simulation session not found"));

        assertDoesNotThrow(announcer::announce);

        verify(events, never()).publishEvent(any());
    }
}
