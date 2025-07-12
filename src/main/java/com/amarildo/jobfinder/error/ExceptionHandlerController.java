package com.amarildo.jobfinder.error;

import com.amarildo.openapi.model.ErrorResponseMessage;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.LocalDateTime;

import static com.amarildo.jobfinder.Constants.TRACE;

@ControllerAdvice
@Slf4j(topic = TRACE)
public class ExceptionHandlerController {

    private static final String STACKTRACE = "{}. Stacktrace: ";

    @ExceptionHandler({Exception.class})
    public ResponseEntity<ErrorResponseMessage> handleFedException(HttpServletRequest request, Exception exception) {
        return handleGenericException(exception, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // 400
    @ExceptionHandler({BadRequestException.class})
    public ResponseEntity<ErrorResponseMessage> handleFedException(HttpServletRequest request, BadRequestException exception) {
        return handleGenericException(exception, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler({IllegalArgumentException.class})
    public ResponseEntity<ErrorResponseMessage> handleFedException(HttpServletRequest request, IllegalArgumentException exception) {
        return handleGenericException(exception, HttpStatus.BAD_REQUEST);
    }

    @NotNull
    private ResponseEntity<ErrorResponseMessage> handleGenericException(Exception exception, @NotNull HttpStatus status) {
        if (status.is4xxClientError()) {
            log.warn(exception.getMessage());
        } else {
            log.error(STACKTRACE, exception.getMessage(), exception);
        }

        ErrorResponseMessage errorResponse = createError(exception.getMessage(), status);
        return ResponseEntity.status(status).body(errorResponse);
    }

    @NotNull
    private ErrorResponseMessage createError(String errorMessage, @NotNull HttpStatus status) {
        ErrorResponseMessage error = new ErrorResponseMessage();
        error.setError(errorMessage);
        error.setStatus(status.value());
        error.setTimestamp(LocalDateTime.now());
        return error;
    }
}
