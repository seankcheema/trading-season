package app.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Security-related bean configuration.
 */
@Configuration
public class SecurityConfig {

    /** Creates the security configuration. */
    public SecurityConfig() {
    }

    /**
     * Provides the password encoder used to hash and verify user passwords.
     *
     * @return the application password encoder
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
