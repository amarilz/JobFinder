package com.amarildo.jobfinder.service;

import com.amarildo.jobfinder.data.entity.JobPosting;
import com.amarildo.jobfinder.data.entity.Language;
import com.amarildo.jobfinder.data.mapping.JobPostingMapper;
import com.amarildo.jobfinder.data.repository.JobPostingRepository;
import com.amarildo.jobfinder.data.repository.LanguageRepository;
import com.amarildo.jobfinder.error.BadRequestException;
import com.amarildo.jobfinder.util.Util;
import com.amarildo.openapi.model.Esito;
import com.amarildo.openapi.model.JobPostingDto;
import com.amarildo.openapi.model.JobPostingDtoResponse;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.amarildo.jobfinder.Constants.TRACE;

@Service
@Slf4j(topic = TRACE)
public class JobService {

    private final JobPostingRepository jobPostingRepository;
    private final LanguageRepository languageRepository;
    private final JobPostingMapper jobPostingMapper;

    @Autowired
    public JobService(
            JobPostingRepository jobPostingRepository,
            LanguageRepository languageRepository,
            JobPostingMapper jobPostingMapper
    ) {
        this.jobPostingRepository = jobPostingRepository;
        this.languageRepository = languageRepository;
        this.jobPostingMapper = jobPostingMapper;
    }

    public JobPostingDtoResponse newJob(JobPostingDto jobPostingDto) throws BadRequestException {
        validateInput(jobPostingDto);
        String bodyText = Util.getTextFromHtmlBody(jobPostingDto.getBody());
        jobPostingDto.setBody(bodyText);

        JobPostingDtoResponse result = new JobPostingDtoResponse();
        Language language = calculateLanguage(jobPostingDto.getBody());

        List<JobPosting> byPostedDateAsc = jobPostingRepository.findByCompanyAndLocationAndTitleAndBodyAndLanguageOrderByPostedDateAsc(
                jobPostingDto.getCompany(),
                jobPostingDto.getLocation(),
                jobPostingDto.getTitle(),
                jobPostingDto.getBody(),
                language);
        if (!byPostedDateAsc.isEmpty()) {
            result.setEsito(Esito.ALREADY_VIEWED);
            int visteCount = byPostedDateAsc.size();
            String msg = (visteCount == 1)
                    ? String.format("Job posting vista una volta in passato. Ultima volta nella data %s", byPostedDateAsc.getLast().getPostedDate())
                    : String.format("Job posting vista in passato %s volte. Ultima volta nella data %s", visteCount, byPostedDateAsc.getLast().getPostedDate());
            result.setMessage(msg);
            return result;
        }

        JobPosting jobPosting = jobPostingMapper.toJobPosting(jobPostingDto, language);
        jobPostingRepository.save(jobPosting);

        result.setEsito(Esito.NEW);
        return result;
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
        if (jobPostingDto.getBody() == null || jobPostingDto.getBody().isBlank())
            throw new BadRequestException("body cannot be null/empty");
        if (jobPostingDto.getPostedDate() == null || jobPostingDto.getPostedDate().isBlank())
            throw new BadRequestException("postedDate cannot be null/empty");
    }

    @NotNull
    private Language calculateLanguage(String body) {
        List<Language> allLanguages = languageRepository.findAll();
        Set<String> wordsInBody = Util.extractWordsFromText(body);

        Map<Language, Integer> languageOccurrences = new HashMap<>();

        for (String word : wordsInBody) {
            for (Language language : allLanguages) {
                if (language.containsWord(word)) {
                    languageOccurrences.merge(language, 1, Integer::sum);
                }
            }
        }

        Map.Entry<Language, Integer> bestMatch = languageOccurrences.entrySet()
                .stream()
                .max(Map.Entry.comparingByValue())
                .orElseThrow(() -> new IllegalArgumentException("Impossibile determinare una lingua dal testo"));

        Language detectedLanguage = bestMatch.getKey();
        int matchedWords = bestMatch.getValue();
        int totalWords = wordsInBody.size();

        double matchPercentage = (totalWords == 0)
                ? 0.0
                : (matchedWords * 100.0) / totalWords;
        String formattedPercentage = String.format("%.2f", matchPercentage);
        log.info("Lingua rilevata: {} (match: {} parole su {}, cioè {}%)",
                detectedLanguage.getName(), matchedWords, totalWords, formattedPercentage);

        return detectedLanguage;
    }
}
