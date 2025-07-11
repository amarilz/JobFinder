package com.amarildo.jobfinder;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import static com.amarildo.jobfinder.Constants.TRACE;

@SpringBootApplication
@Slf4j(topic = TRACE)
public class JobfinderApplication {

	public static void main(String[] args) {
		log.info("Start: firma-fed");
		SpringApplication.run(JobfinderApplication.class, args);
	}
}
