package com.neueda.leap.auth;

import com.neueda.leap.user.User;
import com.neueda.leap.user.UserSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST endpoints for user registration and login.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Registers a new user account.
     *
     * @param request the registration details
     * @return the created user's public profile
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        User user = authService.register(request);
        return new RegisterResponse(user.getUserId(), user.getUsername(), user.getEmail());
    }

    /**
     * Authenticates a user and issues a new session.
     *
     * @param request the login credentials
     * @return the issued session's id and expiry
     */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        UserSession session = authService.login(request);
        return new AuthResponse(session.getSessionId(), session.getExpiresAt());
    }
}
