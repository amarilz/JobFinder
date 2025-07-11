package com.amarildo.jobfinder.data.repository;

import com.amarildo.jobfinder.data.entity.Word;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface WordRepository extends JpaRepository<Word, Long> {

    @Query("SELECT w FROM Word w WHERE w.word = ?1")
    Optional<Word> findByWord(String word);

    @Query("SELECT w FROM Word w WHERE w.word in ?1")
    List<Word> findByWordIn(Collection<String> words);
}
