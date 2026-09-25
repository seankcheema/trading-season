package app.order.audit;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuditTrailServiceTest {

    private final AuditTrailRepository repository = mock(AuditTrailRepository.class);
    private final AuditTrailService service = new AuditTrailService(repository);

    @Test
    void recordsTheOrderEventWithItsDetailAndTime() {
        OffsetDateTime before = OffsetDateTime.now();

        service.record(12, "FILLED", "Filled 3 @ 10.00");

        AuditTrail entry = saved();
        assertNull(entry.getAuditId());
        assertEquals(12, entry.getOrderId());
        assertEquals("FILLED", entry.getEventType());
        assertEquals("Filled 3 @ 10.00", entry.getDetail());
        assertFalse(entry.getRecordedAt().isBefore(before));
    }

    @Test
    void allowsEventsWithoutDetail() {
        service.record(12, "SUBMITTED", null);

        assertNull(saved().getDetail());
    }

    @Test
    void identifierCanBeAssignedExplicitly() {
        AuditTrail entry = new AuditTrail();
        entry.setAuditId(3);

        assertEquals(3, entry.getAuditId());
    }

    private AuditTrail saved() {
        ArgumentCaptor<AuditTrail> captor = ArgumentCaptor.forClass(AuditTrail.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }
}
