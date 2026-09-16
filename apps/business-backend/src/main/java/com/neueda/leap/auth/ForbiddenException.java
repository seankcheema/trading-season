package com.neueda.leap.auth;

/** The authenticated caller is not allowed to perform the request, such as registering another account's email. */
public class ForbiddenException extends RuntimeException {
    /**
     * Creates the exception.
     *
     * @param message the reason returned to the caller
     */
    public ForbiddenException(String message) {
        super(message);
    }
}
