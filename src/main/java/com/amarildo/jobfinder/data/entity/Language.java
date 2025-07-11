package com.amarildo.jobfinder.data.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.jetbrains.annotations.NotNull;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static jakarta.persistence.GenerationType.SEQUENCE;

@Entity
@Table(name = "LANGUAGE")
@NoArgsConstructor
@Getter
@Setter
@ToString
public class Language {

    @Id
    @GeneratedValue(strategy = SEQUENCE, generator = "LANGUAGE_SEQ_GEN")
    @SequenceGenerator(name = "LANGUAGE_SEQ_GEN", sequenceName = "LANGUAGE_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "NAME", length = 50, nullable = false, unique = true)
    private String name; // es. "Italiano", "Inglese"

    @ManyToMany(mappedBy = "languages", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @ToString.Exclude
    private Set<Word> words = new HashSet<>();

    public Language(@NotNull String name) {
        this.name = name.toLowerCase();
    }

    public void addWord(Word word) {
        if (word != null) {
            this.words.add(word);
            word.getLanguages().add(this);
        }
    }

    public void removeWord(Word word) {
        if (word != null) {
            this.words.remove(word);
            word.getLanguages().remove(this);
        }
    }

    public void clearWords() {
        for (Word word : new HashSet<>(this.words)) {
            removeWord(word);
        }
    }

    public boolean containsWord(String word) {
        Optional<Word> any = words.stream()
                .filter(w -> w.getWord().equals(word))
                .findAny();
        return any.isPresent();
    }
}
