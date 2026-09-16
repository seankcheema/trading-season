package com.neueda.leap.auth;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Verifies the production decoder against tokens signed the way the auth service
 * signs them, with the key set served from a mocked JWKS endpoint.
 */
@Tag("unit")
class SecurityConfigTest {

    private static final String JWKS_URI = "http://auth-service.test/.well-known/jwks.json";
    private static final String ISSUER = "https://auth.dualeapa.local";

    private static RSAKey signingKey;
    private static RSAKey otherKeyWithSameKid;

    @BeforeAll
    static void generateKeys() throws JOSEException {
        signingKey = new RSAKeyGenerator(2048).keyID("test-kid").generate();
        otherKeyWithSameKid = new RSAKeyGenerator(2048).keyID("test-kid").generate();
    }

    private record Fixture(NimbusJwtDecoder decoder, MockRestServiceServer jwksServer) {
    }

    private static Fixture decoderServingJwks(ExpectedCount fetches) {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(fetches, requestTo(JWKS_URI))
            .andRespond(withSuccess(new JWKSet(signingKey.toPublicJWK()).toString(), MediaType.APPLICATION_JSON));
        return new Fixture(SecurityConfig.buildJwtDecoder(JWKS_URI, ISSUER, restTemplate), server);
    }

    private static NimbusJwtDecoder decoder() {
        return decoderServingJwks(ExpectedCount.manyTimes()).decoder();
    }

    /** Claims matching what the auth service issues, adjustable per test. */
    private static JWTClaimsSet claims(Consumer<JWTClaimsSet.Builder> customizer) {
        Instant now = Instant.now();
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
            .subject(UUID.randomUUID().toString())
            .claim("email", "alice@example.com")
            .claim("roles", List.of("TRADER"))
            .issuer(ISSUER)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plusSeconds(900)));
        customizer.accept(builder);
        return builder.build();
    }

    private static String signRs256(RSAKey key, JWTClaimsSet claims) throws JOSEException {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    @Test
    void acceptsTokenIssuedByAuthService() throws JOSEException {
        UUID userId = UUID.randomUUID();
        String token = signRs256(signingKey, claims(c -> c.subject(userId.toString())));

        Jwt jwt = decoder().decode(token);
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);

        assertEquals(userId, caller.userId());
        assertEquals("alice@example.com", caller.email());
    }

    @Test
    void fetchesJwksOnceAndCachesIt() throws JOSEException {
        Fixture fixture = decoderServingJwks(ExpectedCount.once());

        for (int i = 0; i < 3; i++) {
            fixture.decoder().decode(signRs256(signingKey, claims(c -> { })));
        }

        fixture.jwksServer().verify();
    }

    @Test
    void rejectsTokenSignedWithDifferentKey() throws JOSEException {
        String token = signRs256(otherKeyWithSameKid, claims(c -> { }));

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void rejectsExpiredToken() throws JOSEException {
        Instant past = Instant.now().minusSeconds(3600);
        String token = signRs256(signingKey, claims(c -> c
            .issueTime(Date.from(past.minusSeconds(900)))
            .expirationTime(Date.from(past))));

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void rejectsTokenFromAnotherIssuer() throws JOSEException {
        String token = signRs256(signingKey, claims(c -> c.issuer("https://evil.example.com")));

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void rejectsTokenWhoseSubjectIsNotUuid() throws JOSEException {
        String token = signRs256(signingKey, claims(c -> c.subject("alice")));

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void rejectsTokenWithoutSubject() throws JOSEException {
        String token = signRs256(signingKey, claims(c -> c.subject(null)));

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void rejectsHmacSignedToken() throws JOSEException {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims(c -> { }));
        jwt.sign(new MACSigner(new byte[32]));
        String token = jwt.serialize();

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void rejectsUnsignedToken() {
        String token = new PlainJWT(claims(c -> { })).serialize();

        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void mapsRolesClaimToRoleAuthorities() throws JOSEException {
        String token = signRs256(signingKey, claims(c -> c.claim("roles", List.of("ADMIN", "TRADER"))));
        Jwt jwt = decoder().decode(token);

        List<String> authorities = SecurityConfig.jwtAuthenticationConverter().convert(jwt).getAuthorities()
            .stream().map(GrantedAuthority::getAuthority).sorted().toList();

        assertEquals(List.of("ROLE_ADMIN", "ROLE_TRADER"), authorities);
    }

    @Test
    void recognisesOnlyCanonicalUuids() {
        assertEquals(true, AuthenticatedUser.isUuid(UUID.randomUUID().toString()));
        assertEquals(false, AuthenticatedUser.isUuid("1-1-1-1-1"));
        assertEquals(false, AuthenticatedUser.isUuid("not-a-uuid"));
        assertEquals(false, AuthenticatedUser.isUuid(null));
    }
}
