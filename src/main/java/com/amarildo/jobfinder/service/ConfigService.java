package com.amarildo.jobfinder.service;

import com.amarildo.openapi.model.ChromeExtensionConfigDtoResponse;
import com.amarildo.openapi.model.HtmlSelector;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.amarildo.jobfinder.Constants.TRACE;

@Service
@Slf4j(topic = TRACE)
public class ConfigService {

    @Value("${config.selector.company}")
    private String selectorCompany;

    @Value("${config.selector.title}")
    private String selectorTitle;

    @Value("${config.selector.location}")
    private String selectorLocation;

    @Value("${config.selector.postedDate}")
    private String selectorPostedDate;

    @Value("${config.selector.candidates}")
    private String selectorCandidates;

    @Value("${config.selector.body}")
    private String selectorBody;

    @Value("${config.selector.containerCard}")
    private String selectorContainerCard;

    @Value("${config.selector.infoJob1}")
    private String selectorInfoJob1;

    @Value("${config.selector.infoJob2}")
    private String selectorInfoJob2;

    @Value("#{'${job.posting.keywords.positive}'.split(',')}")
    private List<String> positiveKeywords;

    @Value("#{'${job.posting.keywords.negative}'.split(',')}")
    private List<String> negativeKeywords;

    public ChromeExtensionConfigDtoResponse getConfig() {
        HtmlSelector htmlSelector = new HtmlSelector(
                selectorCompany, selectorTitle, selectorLocation, selectorPostedDate,
                selectorCandidates, selectorBody, selectorContainerCard, selectorInfoJob1, selectorInfoJob2);
        return new ChromeExtensionConfigDtoResponse(htmlSelector, positiveKeywords, negativeKeywords);
    }
}
