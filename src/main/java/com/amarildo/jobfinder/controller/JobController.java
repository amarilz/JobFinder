package com.amarildo.jobfinder.controller;

import com.amarildo.jobfinder.service.JobService;
import com.amarildo.jobfinder.service.LoggingService;
import com.amarildo.openapi.api.JobApi;
import com.amarildo.openapi.model.JobPostingDto;
import com.amarildo.openapi.model.JobPostingDtoResponse;
import com.amarildo.openapi.model.JobApplicationDto;
import com.amarildo.openapi.model.JobApplicationDtoResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.amarildo.jobfinder.Constants.TRACE;

@RestController
@CrossOrigin(originPatterns = { "chrome-extension://*" })
@RequestMapping("/be-jobfinder/api/v1") // map all services here
@Slf4j(topic = TRACE)
public class JobController implements JobApi {

    private final JobService jobService;
    private final LoggingService loggingService;

    @Autowired
    public JobController(JobService jobService, LoggingService loggingService) {
        this.jobService = jobService;
        this.loggingService = loggingService;
    }

    @Override
    public ResponseEntity<JobPostingDtoResponse> newJobPosting(String correlationId, JobPostingDto jobPostingDto)
            throws Exception {
        loggingService.addLoggingInfo(correlationId, "newJobPosting");
        log.info("Request caught: {}", jobPostingDto);

        JobPostingDtoResponse jobPostingDtoResponse = jobService.newJob(jobPostingDto);

        log.info("End");
        return ResponseEntity.ok(jobPostingDtoResponse);
    }

    @Override
    public ResponseEntity<JobApplicationDtoResponse> updateJobApplication(
            String correlationId, JobApplicationDto jobApplicationDto) throws Exception {
        loggingService.addLoggingInfo(correlationId, "updateJobApplication");
        log.info("Application status update requested for {} - {}", jobApplicationDto.getCompany(),
                jobApplicationDto.getTitle());

        return ResponseEntity.ok(jobService.updateJobApplication(jobApplicationDto));
    }
}
