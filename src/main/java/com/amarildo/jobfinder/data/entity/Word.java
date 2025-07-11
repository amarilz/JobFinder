package com.amarildo.jobfinder.data.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.jetbrains.annotations.NotNull;

import java.util.HashSet;
import java.util.Set;

import static jakarta.persistence.GenerationType.SEQUENCE;

@Entity
@Table(name = "WORD")
@NoArgsConstructor
@Getter
@Setter
@ToString
public class Word {

    @Id
    @GeneratedValue(strategy = SEQUENCE, generator = "WORD_SEQ_GEN")
    @SequenceGenerator(name = "WORD_SEQ_GEN", sequenceName = "WORD_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "WORD", length = 50, nullable = false)
    private String word; // es. "ciao", "hello"

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(
            name = "WORD_LANGUAGE",
            joinColumns = @JoinColumn(name = "WORD_ID"),
            inverseJoinColumns = @JoinColumn(name = "LANGUAGE_ID")
    )
    @ToString.Exclude
    private Set<Language> languages = new HashSet<>();

    public Word(@NotNull String word) {
        this.word = word.toLowerCase();
    }

    public void addLanguage(Language language) {
        if (language != null) {
            this.languages.add(language);
            language.getWords().add(this);
        }
    }

    public void removeLanguage(Language language) {
        if (language != null) {
            this.languages.remove(language);
            language.getWords().remove(this);
        }
    }

    public void clearLanguages() {
        for (Language language : new HashSet<>(this.languages)) {
            removeLanguage(language);
        }
    }

    public boolean belongsToLanguage(String languageName) {
        return languages.stream()
                .anyMatch(lang -> lang.getName().equals(languageName));
    }
}
