package com.amarildo.jobfinder.data.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jetbrains.annotations.NotNull;

import java.time.LocalDate;

import static jakarta.persistence.GenerationType.SEQUENCE;

@Entity
@Table(name = "JOB_POSTING")
@NoArgsConstructor
@Getter
@Setter
public class JobPosting {

    private static final int TITLE_MAX_LENGTH = 100;

    @Id
    @GeneratedValue(strategy = SEQUENCE, generator = "JOB_POSTING_SEQ_GEN")
    @SequenceGenerator(name = "JOB_POSTING_SEQ_GEN", sequenceName = "JOB_POSTING_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "ORIGIN_WEBSITE", length = 2048, nullable = false)
    private String originWebsite;

    @Column(name = "COMPANY", length = 100, nullable = false)
    private String company;

    @Column(name = "LOCATION", length = 100, nullable = false)
    private String location;

    @Column(name = "TITLE", length = TITLE_MAX_LENGTH, nullable = false)
    private String title;

    @Column(name = "BODY", columnDefinition = "TEXT", nullable = false)
    private String body;

    @Column(name = "LANGUAGE", length = 20, nullable = false)
    private String language;

    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Column(name = "POSTED_DATE", nullable = false)
    private LocalDate postedDate;

    public void setTitle(@NotNull String title) {
        this.title = (title.length() <= TITLE_MAX_LENGTH)
                ? title
                : title.substring(0, TITLE_MAX_LENGTH);
    }
}
