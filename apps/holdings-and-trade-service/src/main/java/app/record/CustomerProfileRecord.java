package app.record;

import app.user.User;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A trader's profile, published as {@value #TYPE} when the profile is
 * created. It carries the name, the level reporting segments clients by and
 * the cash balance; the SSN, address, date of birth and middle name stay in
 * the database.
 *
 * @param userId                the trader, the auth service's user id
 * @param firstName             given name
 * @param lastName              family name
 * @param traderLevel           {@code BEGINNER}, {@code INTERMEDIATE} or {@code ADVANCED}
 * @param availableFunds        the trader's cash as of {@code asOf}
 * @param sessionTimeoutMinutes minutes of inactivity before the trader is signed out
 * @param lastActivityAt        when the trader was last active, or {@code null}
 * @param createdAt             when the profile was created
 * @param asOf                  when this state was read; a consumer keeps the funds of the newest state it has seen
 */
public record CustomerProfileRecord(
        UUID userId,
        String firstName,
        String lastName,
        String traderLevel,
        BigDecimal availableFunds,
        Integer sessionTimeoutMinutes,
        OffsetDateTime lastActivityAt,
        OffsetDateTime createdAt,
        OffsetDateTime asOf) implements PlatformRecord {

    /** The record type profiles are published under. */
    public static final String TYPE = "CUSTOMER_PROFILE";

    /**
     * Captures a profile as it stands now.
     *
     * @param user the saved profile
     * @return the record describing it
     */
    public static CustomerProfileRecord from(User user) {
        return new CustomerProfileRecord(user.getUserId(), user.getFirstName(), user.getLastName(),
                user.getTraderLevel(), user.getAvailableFunds(), user.getSessionTimeoutMinutes(),
                user.getLastActivityAt(), user.getCreatedAt(), OffsetDateTime.now());
    }

    @Override
    public String recordType() {
        return TYPE;
    }

    @Override
    public String recordId() {
        return String.valueOf(userId);
    }
}
