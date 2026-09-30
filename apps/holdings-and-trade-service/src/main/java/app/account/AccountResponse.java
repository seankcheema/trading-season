package app.account;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Response DTO for an account.
 *
 * @param accountId   the account ID
 * @param userId      the owner's UUID
 * @param name        the account name
 * @param cashBalance the current cash balance
 * @param openedDate  the date the account was opened
 * @param currency    the account currency (e.g., "USD")
 */
public record AccountResponse(
        Integer accountId,
        UUID userId,
        String name,
        BigDecimal cashBalance,
        LocalDate openedDate,
        String currency
) {

    /**
     * Maps an account entity to its response.
     *
     * @param account the account entity
     * @return the account response
     */
    public static AccountResponse from(Account account) {
        return new AccountResponse(
                account.getAccountId(),
                account.getUserId(),
                account.getName(),
                account.getCashBalance(),
                account.getOpenedDate(),
                account.getCurrency()
        );
    }
}
