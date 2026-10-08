package app.order.event;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * {@code GET /api/orders/stream} needs a bearer token like every other order
 * endpoint, answers as a server-sent events stream, and registers the
 * connection under the token's subject.
 */
@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class OrderStatusStreamControllerTest {

    @Autowired
    private WebApplicationContext webApplicationContext;
    @Autowired
    private OrderStatusStreamRegistry registry;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
    }

    @Test
    void rejectsAnAnonymousClient() throws Exception {
        mockMvc.perform(get("/api/orders/stream"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void opensAStreamScopedToTheTokensSubject() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(get("/api/orders/stream")
                        .with(jwt().jwt(token -> token
                                .subject(userId.toString())
                                .claim("roles", List.of("TRADER")))))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM));

        assertEquals(1, registry.openConnections(userId));
    }
}
