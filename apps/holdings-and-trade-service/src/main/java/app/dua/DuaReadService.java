package app.dua;

import app.account.AccountService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Ownership-checked acknowledgment of versioned Dua summaries. */
@Service
public class DuaReadService {
    private final AccountService accounts;
    private final DuaReadRepository repository;

    /**
     * Exact insight version rendered by the client; contains no caller identity.
     * @param accountId selected account
     * @param sessionId simulation session
     * @param insight summary category
     * @param symbol stock symbol or empty for account summaries
     * @param version opaque content version
     */
    public record Context(@NotNull @Positive Integer accountId, @NotNull @Positive Long sessionId,
            @NotBlank @Pattern(regexp = "stock|daily|holdings") String insight,
            @NotNull @Size(max = 32) @Pattern(regexp = "[A-Z0-9.\\-]*") String symbol,
            @NotBlank @Size(max = 4096) String version) { }

    /**
     * Creates ownership-scoped state handling.
     * @param accounts account ownership service
     * @param repository viewed version persistence
     */
    public DuaReadService(AccountService accounts, DuaReadRepository repository) {
        this.accounts = accounts; this.repository = repository;
    }

    /**
     * Returns viewed versions from a bounded request after checking every account.
     * @param owner verified caller
     * @param contexts requested versions
     * @return previously viewed versions
     * @throws app.account.AccountNotFoundException if any account is unavailable to the caller
     * @throws ResponseStatusException if a stock context omits its symbol or an account context includes one
     */
    public List<Context> query(UUID owner, List<Context> contexts) {
        contexts.forEach(context -> validate(owner, context));
        return contexts.stream().filter(context -> repository.viewed(owner, context)).toList();
    }

    /**
     * Records a rendered summary version idempotently.
     * @param owner verified caller
     * @param context rendered version
     * @throws app.account.AccountNotFoundException if the account is unavailable to the caller
     * @throws ResponseStatusException if the category and symbol do not agree
     */
    public void save(UUID owner, Context context) {
        validate(owner, context); repository.save(owner, context);
    }

    private void validate(UUID owner, Context context) {
        accounts.getAccountForUser(context.accountId(), owner);
        if (context.insight().equals("stock") == context.symbol().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock contexts require a symbol; account contexts do not");
        }
    }
}
