package com.amarildo.jobfinder.data.repository;

import com.amarildo.jobfinder.data.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    Optional<JobApplication> findByOriginWebsiteAndCompanyAndLocationAndTitle(String originWebsite,
                                                                              String company,
                                                                              String location,
                                                                              String title);
}
