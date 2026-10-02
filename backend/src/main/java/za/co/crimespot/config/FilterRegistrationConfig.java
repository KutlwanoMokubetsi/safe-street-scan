package za.co.crimespot.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import za.co.crimespot.security.RateLimitFilter;

@Configuration
public class FilterRegistrationConfig {

    /** RateLimitFilter runs inside the security chain only (see SecurityConfig), not as a second servlet filter. */
    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }
}
