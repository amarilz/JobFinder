package com.amarildo.jobfinder.data.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "JOB_APPLICATION",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_JOB_APPLICATION_IDENTITY",
                columnNames = {"ORIGIN_WEBSITE", "COMPANY", "LOCATION", "TITLE"}
        )
)
@NoArgsConstructor
@Getter
@Setter
public class JobApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ORIGIN_WEBSITE", length = 50, nullable = false)
    private String originWebsite;

    @Column(name = "COMPANY", length = 100, nullable = false)
    private String company;

    @Column(name = "LOCATION", length = 100, nullable = false)
    private String location;

    @Column(name = "TITLE", length = 200, nullable = false)
    private String title;

    @Column(name = "APPLIED", nullable = false)
    private boolean applied;
}
