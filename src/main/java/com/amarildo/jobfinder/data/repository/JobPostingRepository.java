package com.amarildo.jobfinder.data.repository;

import com.amarildo.jobfinder.data.entity.JobPosting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobPostingRepository extends JpaRepository<JobPosting, Long> {

    @Query("""
            SELECT j FROM JobPosting j
            WHERE j.company = ?1
                AND j.location = ?2
                AND j.title = ?3
                AND j.body = ?4
                AND j.language = ?5
            ORDER BY j.postedDate""")
    List<JobPosting> findByCompanyAndLocationAndTitleAndBodyAndLanguageOrderByPostedDateAsc(String company, String location, String title, String body, String language);
}
