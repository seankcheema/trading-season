package app.dua;

import app.auth.AuthenticatedUser;
import app.dua.DuaReadService.Context;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Authenticated Dua read-state endpoints; identity is always token-derived. */
@RestController
@RequestMapping("/api/me/dua/read-state")
public class DuaReadController {
    private final DuaReadService service;

    /**
     * A bounded collection of context versions.
     * @param contexts requested versions
     */
    public record Query(@NotNull @Size(max = 20) List<@NotNull @Valid Context> contexts) { }

    /**
     * Creates HTTP mapping.
     * @param service ownership-scoped state handling
     */
    public DuaReadController(DuaReadService service) { this.service = service; }

    /**
     * Queries viewed versions without putting account identifiers in a URL.
     * @param jwt verified caller token
     * @param query bounded contexts
     * @return viewed versions among those requested
     * @throws app.account.AccountNotFoundException if any account is unavailable
     */
    @PostMapping("/query")
    public List<DuaReadService.Context> query(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Query query) {
        return service.query(AuthenticatedUser.from(jwt).userId(), query.contexts());
    }

    /**
     * Acknowledges the exact version rendered in the foreground.
     * @param jwt verified caller token
     * @param context rendered version
     * @throws app.account.AccountNotFoundException if the account is unavailable
     */
    @PutMapping
    public void save(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DuaReadService.Context context) {
        service.save(AuthenticatedUser.from(jwt).userId(), context);
    }
}
