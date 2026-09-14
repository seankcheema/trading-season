package com.neueda.leap.auth;

import com.neueda.leap.user.SessionRepository;
import com.neueda.leap.user.User;
import com.neueda.leap.user.UserRepository;
import com.neueda.leap.user.UserSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Handles user registration and login, including account lockout after
 * repeated failed login attempts.
 */
@Service
public class AuthService {

    // KAN-84 rate limiting: lock the account after repeated failed attempts.
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, SessionRepository sessionRepository,
                        PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Registers a new user, rejecting duplicate usernames or emails.
     *
     * @param request the registration details
     * @return the newly created user
     * @throws ConflictException if the username or email is already taken
     */
    @Transactional
    public User register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new ConflictException("Username is already taken");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email is already registered");
        }

        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName());
        user.setMiddleName(request.middleName());
        user.setLastName(request.lastName());
        user.setSsn(request.ssn());
        user.setAddress(request.address());
        user.setDateOfBirth(request.dateOfBirth());
        user.setCreatedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    /**
     * Validates credentials and issues a new session for the user.
     *
     * @param request the login credentials
     * @return the newly issued session
     * @throws UnauthorizedException if the credentials are invalid or the account is inactive/locked
     */
    @Transactional
    public UserSession login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new UnauthorizedException("Invalid username or password"));

        if (!"ACTIVE".equals(user.getAccountStatus())) {
            throw new UnauthorizedException("Account is not active");
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(OffsetDateTime.now())) {
            throw new UnauthorizedException("Account is temporarily locked due to failed login attempts");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            recordFailedAttempt(user);
            throw new UnauthorizedException("Invalid username or password");
        }

        OffsetDateTime now = OffsetDateTime.now();
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        user.setLastActivityAt(now);
        userRepository.save(user);

        UserSession session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        session.setUserId(user.getUserId());
        session.setIssuedAt(now);
        session.setExpiresAt(now.plusMinutes(user.getSessionTimeoutMinutes()));
        session.setLastSeenAt(now);
        return sessionRepository.save(session);
    }

    /** Increments the failed login counter, locking the account once the limit is reached. */
    private void recordFailedAttempt(User user) {
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setLockedUntil(OffsetDateTime.now().plus(LOCKOUT_DURATION));
        }
        userRepository.save(user);
    }
}
