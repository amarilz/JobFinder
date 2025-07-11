package com.amarildo.jobfinder.error;

public class BadRequestException extends ApiException {

    public BadRequestException(String message) {
        super(400,
                "Bad request: %s".formatted(message));
    }
}
