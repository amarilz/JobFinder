package com.amarildo.jobfinder.data.mapping;

import com.amarildo.jobfinder.data.entity.JobPosting;
import com.amarildo.openapi.model.JobPostingDto;
import org.jetbrains.annotations.NotNull;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Mapper(componentModel = "spring", imports = { LocalDate.class })
public interface JobPostingMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "originWebsite", source = "jobPostingDto.originWebsite")
    @Mapping(target = "company", source = "jobPostingDto.company")
    @Mapping(target = "location", source = "jobPostingDto.location")
    @Mapping(target = "title", source = "jobPostingDto.title")
    @Mapping(target = "body", source = "jobPostingDto.body")
    @Mapping(target = "language", source = "language")
    @Mapping(target = "postedDate", expression = "java(JobPostingMapper.parseRelativeDateToLocalDate(jobPostingDto.getPostedDate()))")
    JobPosting toJobPosting(JobPostingDto jobPostingDto, String language);

    static LocalDate parseRelativeDateToLocalDate(@NotNull String input) {
        // Espressione regolare per catturare "<numero> <unità>"
        Pattern pattern = Pattern
                .compile("(\\d+)\\s+(day|days|week|weeks|month|months|year|years|hour|hours|minute|minutes)");
        Matcher matcher = pattern.matcher(input.toLowerCase());

        if (!matcher.find()) {
            throw new IllegalArgumentException("Formato non riconosciuto: " + input);
        }

        int amount = Integer.parseInt(matcher.group(1));
        String unit = matcher.group(2);

        // Ottieni l'istante attuale
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime result = switch (unit) {
            case "minute", "minutes" -> now.minusMinutes(amount);
            case "hour", "hours" -> now.minusHours(amount);
            case "day", "days" -> now.minusDays(amount);
            case "week", "weeks" -> now.minusWeeks(amount);
            case "month", "months" -> now.minusMonths(amount);
            case "year", "years" -> now.minusYears(amount);
            default -> throw new IllegalArgumentException("Unità di tempo non supportata: " + unit);
        };

        return result.toLocalDate();
    }
}
