package app.watchlist;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
@ActiveProfiles("test")
class WatchlistSecurityTest {
    @Autowired private WebApplicationContext context;
    @MockitoBean private WatchlistService service;
    private MockMvc mvc;
    private final UUID owner = UUID.randomUUID();

    @BeforeEach void setup() { mvc = webAppContextSetup(context).apply(springSecurity()).build(); }

    @Test void allOperationsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/me/watchlist")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me/watchlist/AAPL")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/me/watchlist/AAPL")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void ownershipIsTakenFromTheTokenAndNotRequestParameters() throws Exception {
        var token = jwt().jwt(jwt -> jwt.subject(owner.toString()));
        var entry = new WatchlistRepository.Entry("AAPL", Instant.parse("2026-01-05T16:00:00Z"));
        when(service.list(owner)).thenReturn(List.of(entry));
        when(service.add(owner, "AAPL")).thenReturn(entry);
        mvc.perform(get("/api/me/watchlist").param("userId", UUID.randomUUID().toString()).with(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].symbol").value("AAPL"));
        mvc.perform(put("/api/me/watchlist/AAPL").with(token)).andExpect(status().isOk());
        mvc.perform(delete("/api/me/watchlist/AAPL").with(token)).andExpect(status().isNoContent());
        verify(service).list(owner);
        verify(service).add(owner, "AAPL");
        verify(service).remove(owner, "AAPL");
    }
}
