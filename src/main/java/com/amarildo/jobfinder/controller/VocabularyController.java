package com.amarildo.jobfinder.controller;

import com.amarildo.jobfinder.service.LoggingService;
import com.amarildo.jobfinder.service.VocabularyService;
import com.amarildo.openapi.api.VocabularyApi;
import com.amarildo.openapi.model.NewWordsDto;
import lombok.SneakyThrows;
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
public class VocabularyController implements VocabularyApi {

    private final VocabularyService vocabularyService;
    private final LoggingService loggingService;

    @Autowired
    public VocabularyController(VocabularyService vocabularyService, LoggingService loggingService) {
        this.vocabularyService = vocabularyService;
        this.loggingService = loggingService;
    }

    @Override
    @SneakyThrows
    public ResponseEntity<Void> addNewWords(String correlationId, NewWordsDto newWordsDto) {
        loggingService.addLoggingInfo(correlationId, "addNewWords");
        log.info("Request caught: {}", newWordsDto);

        vocabularyService.addWordsFromText(newWordsDto);
        return ResponseEntity.ok().build();
    }
}
