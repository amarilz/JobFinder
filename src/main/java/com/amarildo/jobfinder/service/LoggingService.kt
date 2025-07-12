package com.amarildo.jobfinder.service

import org.slf4j.MDC
import org.springframework.stereotype.Service

@Service
class LoggingService {

    @JvmOverloads
    fun addLoggingInfo(
        correlationId: String,
        operation: String? = "",
    ) {
        MDC.put("correlationId", correlationId)

        // Aggiunta di controllo per evitare di inserire valori nulli
        operation?.let {
            MDC.put("operation", it)
        } ?: MDC.put("operation", "") // fallback su stringa vuota se null
    }
}
