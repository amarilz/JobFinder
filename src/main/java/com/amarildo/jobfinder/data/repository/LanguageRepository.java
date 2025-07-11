package com.amarildo.jobfinder.data.repository;

import com.amarildo.jobfinder.data.entity.Language;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LanguageRepository extends JpaRepository<Language, Long> {

    @Query("SELECT l FROM Language l WHERE l.name = ?1")
    Optional<Language> findByName(String name);
}
