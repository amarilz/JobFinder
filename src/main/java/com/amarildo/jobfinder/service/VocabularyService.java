package com.amarildo.jobfinder.service;

import com.amarildo.jobfinder.data.entity.Language;
import com.amarildo.jobfinder.data.entity.Word;
import com.amarildo.jobfinder.data.repository.LanguageRepository;
import com.amarildo.jobfinder.data.repository.WordRepository;
import com.amarildo.jobfinder.util.Util;
import com.amarildo.openapi.model.NewWordsDto;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.amarildo.jobfinder.Constants.TRACE;

@Service
@Slf4j(topic = TRACE)
public class VocabularyService {

    private static final int BATCH_SIZE = 100;

    private final LanguageRepository languageRepository;
    private final WordRepository wordRepository;

    @Autowired
    public VocabularyService(LanguageRepository languageRepository, WordRepository wordRepository) {
        this.languageRepository = languageRepository;
        this.wordRepository = wordRepository;
    }

    /**
     * Estrae le parole da un testo e le associa a una lingua specifica.
     */
    @Transactional(rollbackOn = Exception.class)

    public void addWordsFromText(NewWordsDto newWordsDto) {
        validateInput(newWordsDto);
        newWordsDto.setLanguage(newWordsDto.getLanguage().toLowerCase()); // metti in lower case la lingua
        String languageName = newWordsDto.getLanguage();
        String text = newWordsDto.getText();

        log.info("Inizio parsing del testo per la lingua: {}", languageName);

        // crea o recupera la lingua
        Language language = createLanguage(languageName);

        // Estrai le parole dal testo
        Set<String> candidateWords = Util.extractWordsFromText(text);
        log.info("Estratte {} parole uniche dal testo: {}", candidateWords.size(), candidateWords);

        // Trova le parole già esistenti per evitare duplicati
        List<Word> persistedWords = wordRepository.findByWordIn(candidateWords);
        Map<String, Word> persistedWordMap = persistedWords.stream()
                .collect(Collectors.toMap(Word::getWord, Function.identity()));

        // Elimina le parole che giá esistono
        Set<String> wordsToCreate = candidateWords.stream()
                .filter(word -> !persistedWordMap.containsKey(word))
                .collect(Collectors.toSet());

        int createdWordCount = 0;
        int newlyAssociatedWordCount = 0;

        // Processa in batch per performance migliori
        List<String> wordsToProcess = new ArrayList<>(candidateWords);

        for (int i = 0; i < wordsToProcess.size(); i += BATCH_SIZE) {
            int endIndex = Math.min(i + BATCH_SIZE, wordsToProcess.size());
            List<String> batch = wordsToProcess.subList(i, endIndex);

            for (String wordText : batch) {
                Word word = persistedWordMap.get(wordText);

                // Se la parola non esiste, salvala e aggiungila alla mappa
                if (word == null) {
                    word = wordRepository.save(new Word(wordText));
                    persistedWordMap.put(wordText, word);
                    createdWordCount++;
                }

                // Associa la parola alla lingua, se necessario
                if (!word.belongsToLanguage(languageName)) {
                    word.addLanguage(language);
                    wordRepository.save(word);

                    // conta solo le associazioni aggiuntive, non la creazione
                    if (!wordsToCreate.contains(wordText)) {
                        newlyAssociatedWordCount++;
                    }
                }
            }
        }

        log.info("Completato parsing: {} parole nuove, {} parole associate alla lingua {}",
                createdWordCount, newlyAssociatedWordCount, languageName);
    }

    private void validateInput(NewWordsDto newWordsDto) {
        String text = newWordsDto.getText();
        String languageName = newWordsDto.getLanguage();

        if (text == null || text.trim().isEmpty()) {
            throw new IllegalArgumentException("Il testo non può essere vuoto");
        }
        if (languageName == null || languageName.trim().isEmpty()) {
            throw new IllegalArgumentException("Il nome della lingua non può essere vuoto");
        }
    }

    private Language createLanguage(String languageName) {
        // se esiste giá non lo ricrea
        return languageRepository.findByName(languageName)
                .orElseGet(() -> {
                    Language language = new Language(languageName);
                    Language save = languageRepository.save(language);
                    log.info("Creata nuova lingua: {}", languageName);
                    return save;
                });
    }

    @NotNull
    private Word createWord(String wordText, String @NotNull ... languageNames) {
        Word word = new Word(wordText);

        // Aggiungi le lingue usando i metodi helper
        for (String langName : languageNames) {
            Language language = createLanguage(langName);
            word.addLanguage(language); // Gestisce automaticamente entrambi i lati
        }

        return wordRepository.save(word);
    }

    @NotNull
    private Word createWord(String wordText, @NotNull Set<String> languageNames) {
        return createWord(wordText, languageNames.toArray(new String[0]));
    }

    private void associateWordWithLanguage(String wordText, String languageName) {
        Word word = wordRepository.findByWord(wordText)
                .orElseThrow(() -> new EntityNotFoundException("Word not found: " + wordText));

        Language language = languageRepository.findByName(languageName)
                .orElseThrow(() -> new EntityNotFoundException("Language not found: " + languageName));

        word.addLanguage(language); // Sincronizza automaticamente
        wordRepository.save(word);
    }

    private void removeWordFromLanguage(String wordText, String languageName) {
        Word word = wordRepository.findByWord(wordText)
                .orElseThrow(() -> new EntityNotFoundException("Word not found: " + wordText));

        Language language = languageRepository.findByName(languageName)
                .orElseThrow(() -> new EntityNotFoundException("Language not found: " + languageName));

        word.removeLanguage(language); // Sincronizza automaticamente
        wordRepository.save(word);
    }
}
