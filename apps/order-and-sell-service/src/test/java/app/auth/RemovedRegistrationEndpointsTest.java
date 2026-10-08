package app.auth;

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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * Registration belongs to Holdings and Trade. This service must not expose it,
 * and must still authenticate the endpoints it does own.
 */
@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class RemovedRegistrationEndpointsTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
    }

    @Test
    void accountExistsIsNoLongerPublic() throws Exception {
        mockMvc.perform(post("/api/auth/account-exists")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice@example.com\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void registerIsNotRoutedForASignedInCaller() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .with(jwt().jwt(token -> token.subject(UUID.randomUUID().toString())
                    .claim("email", "alice@example.com")
                    .claim("roles", List.of("TRADER"))))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().is4xxClientError())
            .andExpect(status().is(org.hamcrest.Matchers.not(201)));
    }

    @Test
    void ordersStillRequireAToken() throws Exception {
        mockMvc.perform(get("/api/orders"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void ordersAreServedToASignedInCaller() throws Exception {
        mockMvc.perform(get("/api/orders")
                .with(jwt().jwt(token -> token.subject(UUID.randomUUID().toString())
                    .claim("email", "alice@example.com")
                    .claim("roles", List.of("TRADER")))))
            .andExpect(status().isOk());
    }
}
