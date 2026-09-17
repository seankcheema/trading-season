package app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Application entry point for the business backend. */
@SpringBootApplication
@EnableScheduling
public class Main {

    /** Creates the Spring Boot application. */
    public Main() {
    }

    /**
     * Starts the application.
     *
     * @param args command-line arguments passed to Spring Boot
     */
    public static void main(String[] args) {
        SpringApplication.run(Main.class, args);
    }
}
