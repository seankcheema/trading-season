package app.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class TermsAcceptanceRepositoryIntegrationTest {

    private static final String VERSION = "2026-10-12";
    private static final OffsetDateTime ACCEPTED_AT = OffsetDateTime.of(2026, 10, 12, 9, 30, 0, 0, ZoneOffset.UTC);

    @Autowired
    private TermsAcceptanceRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void storesAnAcceptanceAndReadsItBackByClientAndVersion() {
        UUID userId = UUID.randomUUID();

        repository.save(new TermsAcceptance(userId, VERSION, ACCEPTED_AT));

        TermsAcceptance stored = repository.findById(new TermsAcceptanceId(userId, VERSION)).orElseThrow();
        assertEquals(userId, stored.getUserId());
        assertEquals(VERSION, stored.getTermsVersion());
        assertTrue(ACCEPTED_AT.isEqual(stored.getAcceptedAt()));
    }

    @Test
    void anAcceptanceCoversOnlyItsOwnClientAndVersion() {
        UUID userId = UUID.randomUUID();
        repository.save(new TermsAcceptance(userId, VERSION, ACCEPTED_AT));

        assertTrue(repository.existsById(new TermsAcceptanceId(userId, VERSION)));
        assertFalse(repository.existsById(new TermsAcceptanceId(userId, "2027-01-01")));
        assertFalse(repository.existsById(new TermsAcceptanceId(UUID.randomUUID(), VERSION)));
    }

    @Test
    void savingTheSameAcceptanceAgainKeepsTheFirstTimestamp() {
        UUID userId = UUID.randomUUID();
        repository.save(new TermsAcceptance(userId, VERSION, ACCEPTED_AT));

        repository.save(new TermsAcceptance(userId, VERSION, ACCEPTED_AT.plusDays(30)));

        assertEquals(1, repository.count());
        TermsAcceptance stored = repository.findById(new TermsAcceptanceId(userId, VERSION)).orElseThrow();
        assertTrue(ACCEPTED_AT.isEqual(stored.getAcceptedAt()));
    }
}
