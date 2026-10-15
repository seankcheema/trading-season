package app.auth;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Checks the JSON bodies written for the security filter chain's 401 and 403 responses.
 */
class SecurityErrorHandlerTest {

    private final SecurityErrorHandler handler = new SecurityErrorHandler(JsonMapper.builder().build());

    @Test
    void anInvalidTokenGets401WithTheBearerChallengeAndAGenericBody() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.commence(new MockHttpServletRequest(), response, new BadCredentialsException("expired"));

        assertEquals(401, response.getStatus());
        assertNotNull(response.getHeader(HttpHeaders.WWW_AUTHENTICATE));
        assertEquals("{\"error\":\"A valid access token is required\"}", response.getContentAsString());
    }

    @Test
    void aMissingPermissionGets403WithAGenericBody() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(new MockHttpServletRequest(), response, new AccessDeniedException("no role"));

        assertEquals(403, response.getStatus());
        assertEquals("{\"error\":\"Access denied\"}", response.getContentAsString());
    }
}
