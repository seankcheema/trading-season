package app.holding;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class HoldingRepositoryTest {

    @Autowired
    private HoldingRepository holdingRepository;

    @Test
    void newHoldingsStartAtZeroQuantity() {
        assertEquals(BigDecimal.ZERO, new Holding().getQuantity());
    }

    @Test
    void findsAHoldingByAccountAndInstrument() {
        OffsetDateTime updatedAt = OffsetDateTime.of(2026, 1, 5, 14, 30, 0, 0, ZoneOffset.UTC);
        Holding saved = holdingRepository.saveAndFlush(holding(10, 20, "15", updatedAt));
        holdingRepository.saveAndFlush(holding(10, 21, "3", updatedAt));
        holdingRepository.saveAndFlush(holding(11, 20, "4", updatedAt));

        Holding found = holdingRepository.findByAccountIdAndInstrumentId(10, 20).orElseThrow();

        assertNotNull(saved.getHoldingId());
        assertEquals(saved.getHoldingId(), found.getHoldingId());
        assertEquals(10, found.getAccountId());
        assertEquals(20, found.getInstrumentId());
        assertEquals(0, new BigDecimal("15").compareTo(found.getQuantity()));
        assertEquals(updatedAt.toInstant(), found.getUpdatedAt().toInstant());
    }

    @Test
    void lockedLookupReturnsTheSameRowOrNothing() {
        Holding saved = holdingRepository.saveAndFlush(holding(12, 30, "7", OffsetDateTime.now()));

        assertEquals(saved.getHoldingId(),
                holdingRepository.findByAccountIdAndInstrumentIdForUpdate(12, 30).orElseThrow().getHoldingId());
        assertTrue(holdingRepository.findByAccountIdAndInstrumentIdForUpdate(12, 31).isEmpty());
    }

    @Test
    void identifierCanBeAssignedExplicitly() {
        Holding holding = new Holding();
        holding.setHoldingId(5);

        assertEquals(5, holding.getHoldingId());
    }

    private static Holding holding(int accountId, int instrumentId, String quantity, OffsetDateTime updatedAt) {
        Holding holding = new Holding();
        holding.setAccountId(accountId);
        holding.setInstrumentId(instrumentId);
        holding.setQuantity(new BigDecimal(quantity));
        holding.setUpdatedAt(updatedAt);
        return holding;
    }
}
