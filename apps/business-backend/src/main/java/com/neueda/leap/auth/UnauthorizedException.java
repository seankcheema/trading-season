package com.neueda.leap.auth;

/** Login rejected: unknown user, bad password, locked, or inactive account. */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
