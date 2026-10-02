package za.co.crimespot.routing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.news.NewsService;

import java.util.List;

@RestController
@RequestMapping("/api")
public class RouteController {

    private final RouteService routes;
    private final NewsService places;

    public RouteController(RouteService routes, NewsService places) {
        this.routes = routes;
        this.places = places;
    }

    public record RouteRequest(@NotNull @Valid RouteService.Point from, @NotNull @Valid RouteService.Point to, boolean walk) {}

    @PostMapping("/routes")
    public RouteService.Plan plan(@RequestBody @Valid RouteRequest req) {
        return routes.plan(req.from(), req.to(), req.walk());
    }

    /** Place search for the destination box (Nominatim, South Africa only, cached and rate-limited). */
    @GetMapping("/places")
    public List<NewsService.PlaceResult> search(@RequestParam @Size(min = 3, max = 100) String q) {
        return places.search(q);
    }
}
