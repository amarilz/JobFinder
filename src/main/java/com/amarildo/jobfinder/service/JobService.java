package com.amarildo.jobfinder.service;

import com.amarildo.jobfinder.data.entity.JobApplication;
import com.amarildo.jobfinder.data.entity.JobPosting;
import com.amarildo.jobfinder.data.mapping.JobPostingMapper;
import com.amarildo.jobfinder.data.repository.JobApplicationRepository;
import com.amarildo.jobfinder.data.repository.JobPostingRepository;
import com.amarildo.jobfinder.error.BadRequestException;
import com.amarildo.openapi.model.JobApplicationDto;
import com.amarildo.openapi.model.JobApplicationDtoResponse;
import com.amarildo.openapi.model.JobPostingDto;
import com.amarildo.openapi.model.JobPostingDtoResponse;
import com.github.pemistahl.lingua.api.Language;
import com.github.pemistahl.lingua.api.LanguageDetector;
import com.github.pemistahl.lingua.api.LanguageDetectorBuilder;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.amarildo.jobfinder.Constants.TRACE;
import static com.amarildo.openapi.model.Esito.ALREADY_SEEN;
import static com.amarildo.openapi.model.Esito.NEW;
import static com.amarildo.openapi.model.Esito.TOO_MANY_CANDIDATES;
import static com.amarildo.openapi.model.Esito.UNSUITABLE_LANGUAGE;

@Service
@Slf4j(topic = TRACE)
public class JobService {

    private final MeterRegistry meterRegistry;
    private final JobPostingRepository jobPostingRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final JobPostingMapper jobPostingMapper;

    @Value(value = "${job.posting.max.candidates}")
    private int maxCandidates;

    @Value("#{'${job.posting.language.handling}'.split(',')}")
    private List<String> handlingLanguages;
    private Language[] handlingLanguagesArray;

    @Value("#{'${job.posting.language.preferred}'.split(',')}")
    private List<String> preferredLanguages;

    private final Counter newJobCounter;
    private final Counter wrongLanguageCounter;
    private final Counter oldJobCounter;
    private final Counter tooManyCandidatesCounter;

    @Autowired
    public JobService(
            MeterRegistry meterRegistry,
            JobPostingRepository jobPostingRepository,
            JobApplicationRepository jobApplicationRepository,
            JobPostingMapper jobPostingMapper) {
        this.meterRegistry = meterRegistry;
        this.jobPostingRepository = jobPostingRepository;
        this.jobApplicationRepository = jobApplicationRepository;
        this.jobPostingMapper = jobPostingMapper;

        newJobCounter = meterRegistry.counter("new_job");
        wrongLanguageCounter = meterRegistry.counter("wrong_language");
        oldJobCounter = meterRegistry.counter("old_job");
        tooManyCandidatesCounter = meterRegistry.counter("too_many_candidates");
    }

    @PostConstruct
    private void dfs() {
        handlingLanguagesArray = handlingLanguages.stream()
                .map(String::toUpperCase)
                .map(Language::valueOf) // throws IllegalArgumentException if invalid
                .toArray(Language[]::new);
    }

    public JobPostingDtoResponse newJob(JobPostingDto jobPostingDto) throws BadRequestException {
        validateInput(jobPostingDto);

        int candidates = calculateCandidate(jobPostingDto.getCandidates());
        if (candidates > maxCandidates) {
            String message = String.format("Candidate count %d exceeds the maximum allowed limit of %d", candidates,
                    maxCandidates);
            log.info(message);
            tooManyCandidatesCounter.increment();
            return new JobPostingDtoResponse(TOO_MANY_CANDIDATES, message, false);
        }

        String bodyText = getTextFromHtmlBody(jobPostingDto.getBody());
        jobPostingDto.setBody(bodyText);

        String language = calculateLanguage(jobPostingDto.getBody());
        if (!preferredLanguages.contains(language)) {
            String message = String.format(
                    "Job posting language '%s' is not among the preferred languages: %s",
                    language,
                    String.join(", ", preferredLanguages));
            log.info(message);
            wrongLanguageCounter.increment();
            return new JobPostingDtoResponse(UNSUITABLE_LANGUAGE, message, false);
        }

        List<JobPosting> byPostedDateAsc = jobPostingRepository
                .findByCompanyAndLocationAndTitleAndBodyAndLanguageOrderByPostedDateAsc(
                        jobPostingDto.getCompany(),
                        jobPostingDto.getLocation(),
                        jobPostingDto.getTitle(),
                        jobPostingDto.getBody(),
                        language);
        if (!byPostedDateAsc.isEmpty()) {
            int visteCount = byPostedDateAsc.size();

            String msg = (visteCount == 1)
                    ? String.format("Job posting vista una volta in passato. Ultima volta nella data %s", byPostedDateAsc.getLast().getPostedDate())
                    : String.format("Job posting vista in passato %s volte. Ultima volta nella data %s", visteCount, byPostedDateAsc.getLast().getPostedDate());
            log.info(msg);

            JobPosting jobPosting = jobPostingMapper.toJobPosting(jobPostingDto, language);
            jobPostingRepository.save(jobPosting);
            oldJobCounter.increment();
            return new JobPostingDtoResponse(ALREADY_SEEN, msg, getApplicationStatus(jobPostingDto));
        }

        JobPosting jobPosting = jobPostingMapper.toJobPosting(jobPostingDto, language);
        jobPostingRepository.save(jobPosting);
        newJobCounter.increment();
        return new JobPostingDtoResponse(NEW, "", false);
    }

    public JobApplicationDtoResponse updateJobApplication(JobApplicationDto applicationDto) throws BadRequestException {
        if (applicationDto == null || applicationDto.getOriginWebsite() == null
                || applicationDto.getOriginWebsite().isBlank()
                || applicationDto.getCompany() == null || applicationDto.getCompany().isBlank()
                || applicationDto.getLocation() == null || applicationDto.getLocation().isBlank()
                || applicationDto.getTitle() == null || applicationDto.getTitle().isBlank()
                || applicationDto.getApplied() == null) {
            throw new BadRequestException("Incomplete job application data");
        }

        var existingApplication = jobApplicationRepository.findByOriginWebsiteAndCompanyAndLocationAndTitle(
                applicationDto.getOriginWebsite(),
                applicationDto.getCompany(),
                applicationDto.getLocation(),
                applicationDto.getTitle());

        if (!applicationDto.getApplied()) {
            existingApplication.ifPresent(jobApplicationRepository::delete);
            return new JobApplicationDtoResponse(false);
        }

        JobApplication jobApplication = existingApplication.orElseGet(JobApplication::new);
        jobApplication.setOriginWebsite(applicationDto.getOriginWebsite());
        jobApplication.setCompany(applicationDto.getCompany());
        jobApplication.setLocation(applicationDto.getLocation());
        jobApplication.setTitle(applicationDto.getTitle());
        jobApplication.setApplied(true);
        jobApplicationRepository.save(jobApplication);
        return new JobApplicationDtoResponse(true);
    }

    private boolean getApplicationStatus(JobPostingDto jobPostingDto) {
        return jobApplicationRepository.findByOriginWebsiteAndCompanyAndLocationAndTitle(
                        jobPostingDto.getOriginWebsite(),
                        jobPostingDto.getCompany(),
                        jobPostingDto.getLocation(),
                        jobPostingDto.getTitle())
                .map(JobApplication::isApplied)
                .orElse(false);
    }

    private void validateInput(JobPostingDto jobPostingDto) throws BadRequestException {
        if (jobPostingDto == null)
            throw new BadRequestException("jobPostingDto cannot be null");
        if (jobPostingDto.getOriginWebsite() == null || jobPostingDto.getOriginWebsite().isBlank())
            throw new BadRequestException("originWebsite cannot be null/empty");
        if (jobPostingDto.getCompany() == null || jobPostingDto.getCompany().isBlank())
            throw new BadRequestException("company cannot be null/empty");
        if (jobPostingDto.getLocation() == null || jobPostingDto.getLocation().isBlank())
            throw new BadRequestException("location cannot be null/empty");
        if (jobPostingDto.getTitle() == null || jobPostingDto.getTitle().isBlank())
            throw new BadRequestException("title cannot be null/empty");
        if (jobPostingDto.getCandidates() == null || jobPostingDto.getCandidates().isBlank())
            throw new BadRequestException("candidates cannot be null/empty");
        if (jobPostingDto.getBody() == null || jobPostingDto.getBody().isBlank())
            throw new BadRequestException("body cannot be null/empty");
        if (jobPostingDto.getPostedDate() == null || jobPostingDto.getPostedDate().isBlank())
            throw new BadRequestException("postedDate cannot be null/empty");
    }

    public int calculateCandidate(@NotNull String input) throws BadRequestException {
        String normalizedInput = input.trim();

        Integer extractedCandidateCount = null;

        // Gestisce il caso "Over X"
        if (normalizedInput.toLowerCase().startsWith("over")) {
            Pattern overFormatPattern = Pattern.compile("over\\s+(\\d+)", Pattern.CASE_INSENSITIVE);
            Matcher overMatcher = overFormatPattern.matcher(normalizedInput);
            if (overMatcher.find()) {
                extractedCandidateCount = Integer.parseInt(overMatcher.group(1));
            }
        }

        // Cerca il primo numero nella stringa
        Pattern numberPattern = Pattern.compile("\\d+");
        Matcher matcher = numberPattern.matcher(normalizedInput);

        if (matcher.find()) {
            extractedCandidateCount = Integer.parseInt(matcher.group());
        }

        if (extractedCandidateCount == null)
            throw new BadRequestException("Unable to determine the number of candidates");
        return extractedCandidateCount;
    }

    @NotNull
    public static String getTextFromHtmlBody(String body) {
        return Jsoup.parse(body).text();
    }

    @NotNull
    private String calculateLanguage(String body) {
        LanguageDetector languageDetector = LanguageDetectorBuilder.Companion.fromLanguages(handlingLanguagesArray).build();
        SortedMap<Language, Double> languageDoubleSortedMap = languageDetector.computeLanguageConfidenceValues(body);

        List<Map.Entry<Language, Double>> top3 = languageDoubleSortedMap.entrySet()
                .stream()
                .sorted(Map.Entry.<Language, Double>comparingByValue().reversed())
                .limit(3)
                .toList();

        String msg = "Detected language: %s with confidence scores - 1st: %s (%.2f%%), 2nd: %s (%.2f%%), 3rd: %s (%.2f%%)".formatted(
                top3.get(0).getKey().name(),
                top3.get(0).getKey().name(), top3.get(0).getValue() * 100,
                top3.get(1).getKey().name(), top3.get(1).getValue() * 100,
                top3.get(2).getKey().name(), top3.get(2).getValue() * 100);
        log.info(msg);

        return top3.getFirst().getKey().name();
    }
}
