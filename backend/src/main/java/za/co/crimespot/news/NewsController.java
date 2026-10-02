package za.co.crimespot.news;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/news")
@Validated
public class NewsController {

    private final NewsService news;

    public NewsController(NewsService news) { this.news = news; }

    @GetMapping
    public NewsService.News local(@RequestParam(required = false) @DecimalMin("-90") @DecimalMax("90") Double lat,
                                  @RequestParam(required = false) @DecimalMin("-180") @DecimalMax("180") Double lng) {
        return news.forLocation(lat, lng);
    }
}
