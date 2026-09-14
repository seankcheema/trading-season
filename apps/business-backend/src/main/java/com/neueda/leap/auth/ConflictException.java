package com.neueda.leap.auth;

/** Registration rejected because the username or email is already taken. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
