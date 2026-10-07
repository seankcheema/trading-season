package app.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for accessing Order entities.
 */
public interface OrderRepository extends JpaRepository<Order, Integer> {

    /**
     * Finds a prior order by its idempotency key. Checked before creating a
     * new order so a retried submission returns the original outcome
     * instead of being validated and possibly executed a second time.
     *
     * @param accountId the account the order was placed on
     * @param clientReference the caller-supplied idempotency key
     * @return the earlier order, or empty if the key has not been used
     */
    Optional<Order> findByAccountIdAndClientReference(Integer accountId, UUID clientReference);

    /**
     * Lists every order placed on any account the given user owns, newest
     * first. Orders reference their account by id rather than by association,
     * so ownership is resolved by joining {@code Account}. The id comes from
     * the caller's verified token, never from the request, so this cannot
     * return another user's orders.
     *
     * @param userId the owning user's id, from the token's {@code sub} claim
     * @return the user's orders, newest submission first; empty if they have none
     */
    @Query("SELECT o FROM Order o JOIN Account a ON a.id = o.accountId "
            + "WHERE a.userId = :userId ORDER BY o.submittedAt DESC, o.orderId DESC")
    List<Order> findAllByOwningUserId(UUID userId);
}


