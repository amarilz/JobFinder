package com.amarildo.jobfinder.util;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.jetbrains.annotations.NotNull;
import org.jsoup.Jsoup;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class Util {

    private static final int MIN_WORD_LENGTH = 2;
    private static final int MAX_WORD_LENGHT = 50;

    /**
     * Estrae le parole da un testo applicando filtri e normalizzazioni.
     * Rimuove caratteri speciali, esclude parole troppo corte o troppo lunghe
     * e quelle che contengono numeri.
     */
    public static Set<String> extractWordsFromText(@NotNull String text) {
        // Normalizza il testo in minuscolo
        String normalizedText = text.toLowerCase();

        // Rimuove tutti i caratteri non alfanumerici (mantiene lettere, numeri e spazi)
        normalizedText = normalizedText.replaceAll("[^\\p{L}\\p{N}\\s]", " ");

        // Suddivide il testo in parole
        String[] rawWords = normalizedText.split("\\s+");

        return Arrays.stream(rawWords)
                .map(String::trim)
                .filter(word -> !word.isEmpty())
                .filter(word -> word.length() >= MIN_WORD_LENGTH)
                .filter(word -> word.length() <= MAX_WORD_LENGHT)
                .filter(word -> !containsAnyDigit(word)) // esclude parole con numeri
                .collect(Collectors.toSet());
    }

    /**
     * Verifica se una stringa contiene almeno una cifra numerica.
     */
    private static boolean containsAnyDigit(@NotNull String word) {
        return word.matches(".*\\d.*");
    }

    @NotNull
    public static String getTextFromHtmlBody(String body) {
        return Jsoup.parse(body).text();
    }
}
