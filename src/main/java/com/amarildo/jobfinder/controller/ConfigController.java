package com.amarildo.jobfinder.controller;

import com.amarildo.jobfinder.service.ConfigService;
import com.amarildo.jobfinder.service.LoggingService;
import com.amarildo.openapi.api.ConfigApi;
import com.amarildo.openapi.model.ChromeExtensionConfigDtoResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.amarildo.jobfinder.Constants.TRACE;

@RestController
@CrossOrigin(originPatterns = {"chrome-extension://*"})
@RequestMapping("/be-jobfinder/api/v1") // map all services here
@Slf4j(topic = TRACE)
public class ConfigController implements ConfigApi {

    private final LoggingService loggingService;
    private final ConfigService configService;

    @Autowired
    public ConfigController(LoggingService loggingService, ConfigService configService) {
        this.loggingService = loggingService;
        this.configService = configService;
    }

    @Override
    public ResponseEntity<ChromeExtensionConfigDtoResponse> getChromeExtensionConfig(String correlationId) throws Exception {
        loggingService.addLoggingInfo(correlationId, "getChromeExtensionConfig");
        log.info("Request caught");

        ChromeExtensionConfigDtoResponse config = configService.getConfig();

        log.info("End");
        return ResponseEntity.ok(config);
    }
}
