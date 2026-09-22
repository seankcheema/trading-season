package app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Starts the Holdings and Trade Service API and enables scheduled market replay ticks. */
@SpringBootApplication
@EnableScheduling
public class Main {
    /**
     * Starts the Spring Boot application.
     * @param args command-line arguments passed to Spring Boot
     */
    public static void main(String[] args) {
        SpringApplication.run(Main.class, args);
    }
}
