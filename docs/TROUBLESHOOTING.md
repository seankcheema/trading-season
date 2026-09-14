# Troubleshooting Guide

## Database Issues

### Cannot Connect to PostgreSQL

**Symptom:** Error message like "Connection refused" or "cannot connect"

**Solutions:**

1. Check if database container is running:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml ps postgres
   ```

2. Start database if not running:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d postgres
   ```

3. Verify database is accepting connections:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml exec postgres pg_isready
   ```
   Expected output: "accepting connections"

4. Test credentials:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml exec postgres psql -U paysprint -d paysprint -c "SELECT 1"
   ```

### Migrations Not Running

**Symptom:** Database schema tables don't exist after startup

**Solutions:**

1. Check Flyway logs:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs backend | grep -i flyway
   ```

2. Verify migration files exist:
   ```bash
   ls -la apps/business-backend/db/migrations/
   ```

3. Check migration status in database:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml exec postgres \
     psql -U paysprint -d paysprint -c "SELECT * FROM flyway_schema_history"
   ```

4. Manual migration:
   ```bash
   cd apps/business-backend
   mvn flyway:migrate
   ```

### Cannot Create Unique Index

**Symptom:** Error "duplicate key value violates unique constraint"

**Solutions:**

1. Check for duplicate data:
   ```sql
   SELECT column_name, COUNT(*) FROM table_name 
   GROUP BY column_name HAVING COUNT(*) > 1;
   ```

2. Remove duplicates:
   ```sql
   DELETE FROM table_name 
   WHERE id NOT IN (SELECT MIN(id) FROM table_name GROUP BY unique_column);
   ```

3. Create migration with data cleanup before index creation

## Backend Issues

### Spring Boot Won't Start

**Symptom:** Application startup fails with errors

**Solutions:**

1. Check logs for errors:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs backend
   ```

2. Common causes:
   - Database connection: Verify PostgreSQL is running
   - Port conflict: Check if port 8080 is already in use
   - Properties: Verify application.properties or application-dev.properties

3. Check if port is in use:
   ```bash
   lsof -i :8080
   ```
   Kill process if needed:
   ```bash
   kill -9 <PID>
   ```

4. Restart with clean build:
   ```bash
   cd apps/business-backend
   mvn clean spring-boot:run
   ```

### NullPointerException in Service

**Symptom:** Service methods throw NullPointerException

**Solutions:**

1. Enable debug logging:
   ```properties
   # application-dev.properties
   logging.level.com.neueda.leap=DEBUG
   ```

2. Check dependency injection:
   ```java
   @Service
   public class MyService {
       @Autowired
       private UserRepository userRepository;  // Verify @Autowired is present
   }
   ```

3. Verify bean is created:
   ```bash
   # Add to application properties
   logging.level.org.springframework.context=DEBUG
   ```

4. Check configuration:
   ```java
   @Configuration
   @ComponentScan("com.neueda.leap")  // Verify package is scanned
   public class AppConfig {
   }
   ```

### Authentication Token Expired

**Symptom:** 401 Unauthorized error on API requests

**Solutions:**

1. Get new token:
   ```bash
   curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"user","password":"pass"}'
   ```

2. Update token in requests:
   ```bash
   curl -H "Authorization: Bearer <NEW_TOKEN>" \
     http://localhost:8080/api/users/123
   ```

3. Increase token expiration in properties:
   ```properties
   jwt.expiration=604800000  # 7 days instead of 1 day
   ```

### Slow Query Performance

**Symptom:** API endpoints respond slowly

**Solutions:**

1. Enable query logging:
   ```properties
   spring.jpa.properties.hibernate.generate_statistics=true
   logging.level.org.hibernate.stat=DEBUG
   logging.level.org.hibernate.SQL=DEBUG
   ```

2. Analyze query:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = '...';
   ```

3. Add indexes if needed:
   ```sql
   CREATE INDEX idx_orders_user ON orders(user_id);
   ```

4. Verify query uses index:
   ```sql
   EXPLAIN SELECT * FROM orders WHERE user_id = '...';
   -- Check "Index Scan" in output
   ```

## Frontend Issues

### npm install Fails

**Symptom:** npm install errors with permission or network issues

**Solutions:**

1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Remove lock file and try again:
   ```bash
   rm package-lock.json
   npm install
   ```

3. Use npm ci (cleaner install):
   ```bash
   npm ci
   ```

4. Check npm registry:
   ```bash
   npm config get registry
   npm config set registry https://registry.npmjs.org/
   ```

### Angular Build Fails

**Symptom:** TypeScript compilation errors or build warnings

**Solutions:**

1. Check TypeScript errors:
   ```bash
   cd apps/business-logic-ui
   ng lint
   ```

2. Fix lint issues:
   ```bash
   ng lint --fix
   ```

3. Check for circular dependencies:
   ```bash
   ng lint --configuration production
   ```

4. Check component imports:
   ```typescript
   // Ensure components are imported correctly
   import { MyComponent } from '@packages/shared-ui-components';
   ```

### API Calls Return 404

**Symptom:** Frontend API calls fail with 404 errors

**Solutions:**

1. Verify API is running:
   ```bash
   curl http://localhost:8080/actuator/health
   ```

2. Check API URL configuration:
   ```typescript
   // environment.ts
   export const environment = {
     apiUrl: 'http://localhost:8080',  // Should match backend port
     production: false
   };
   ```

3. Verify endpoint exists:
   ```bash
   curl http://localhost:8080/api/users
   ```

4. Check backend routing:
   ```bash
   # List all endpoints in Spring Boot
   curl http://localhost:8080/actuator/mappings | grep "POST\|GET\|PUT"
   ```

### CORS Errors

**Symptom:** Browser error "Access to XMLHttpRequest blocked by CORS"

**Solutions:**

1. Enable CORS in backend:
   ```java
   @Configuration
   public class CorsConfig implements WebMvcConfigurer {
       @Override
       public void addCorsMappings(CorsRegistry registry) {
           registry.addMapping("/api/**")
               .allowedOrigins("http://localhost:4200")
               .allowedMethods("GET", "POST", "PUT", "DELETE");
       }
   }
   ```

2. Verify frontend makes requests with credentials:
   ```typescript
   this.http.get(url, { withCredentials: true })
   ```

3. Check preflight requests in browser DevTools (Network tab)

### Component Not Rendering

**Symptom:** Angular component displays blank or error

**Solutions:**

1. Check browser console (F12 -> Console):
   - Look for JavaScript errors
   - Check for 404 errors loading resources

2. Verify component is declared:
   ```typescript
   // If standalone (Angular 14+)
   @Component({
     selector: 'app-my-component',
     standalone: true,
     imports: [CommonModule]  // Import required modules
   })
   ```

3. Check template file:
   ```bash
   # Verify file exists
   ls -la apps/business-logic-ui/src/app/components/my-component.html
   ```

4. Verify data is bound:
   ```typescript
   // Check in ngOnInit
   ngOnInit() {
     console.log('Component initialized with data:', this.data);
   }
   ```

## Docker Issues

### Container Fails to Start

**Symptom:** docker-compose shows container exited

**Solutions:**

1. Check logs:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs backend
   ```

2. Check resource limits:
   ```bash
   docker ps -a
   docker inspect <container-id>
   ```

3. Remove and recreate:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d
   ```

### Port Already in Use

**Symptom:** Error "Bind for 0.0.0.0:8080 failed"

**Solutions:**

1. Find process using port:
   ```bash
   lsof -i :8080
   # or
   netstat -tulpn | grep 8080
   ```

2. Kill process:
   ```bash
   kill -9 <PID>
   ```

3. Change port in docker-compose:
   ```yaml
   ports:
     - "8081:8080"
   ```

4. Update application.properties:
   ```properties
   server.port=8081
   ```

### Docker Compose File Issues

**Symptom:** Error parsing docker-compose.yml

**Solutions:**

1. Validate file:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml config
   ```

2. Check YAML syntax:
   - Indentation must be spaces (not tabs)
   - Colons must be followed by space

3. Check for required fields:
   - version
   - services
   - Each service must have image or build

## Git Issues

### Cannot Push Changes

**Symptom:** Git push fails with permission or authentication errors

**Solutions:**

1. Verify remote:
   ```bash
   git remote -v
   ```

2. Update credentials:
   ```bash
   git remote set-url origin https://github.com/user/repo.git
   ```

3. Generate SSH key (if using SSH):
   ```bash
   ssh-keygen -t ed25519 -C "email@example.com"
   ssh-add ~/.ssh/id_ed25519
   ```

4. Check branch:
   ```bash
   git branch
   git push origin <branch-name>
   ```

### Merge Conflicts

**Symptom:** Merge conflict when pulling latest code

**Solutions:**

1. See conflicts:
   ```bash
   git status
   ```

2. Edit conflicted files:
   - Look for markers: `<<<<<<<`, `=======`, `>>>>>>>`
   - Choose correct version
   - Delete markers

3. Complete merge:
   ```bash
   git add .
   git commit -m "Resolve merge conflicts"
   git push
   ```

## Performance Issues

### High Memory Usage

**Symptom:** Docker container using excessive memory

**Solutions:**

1. Set memory limits in docker-compose:
   ```yaml
   services:
     backend:
       mem_limit: 1g
       memswap_limit: 2g
   ```

2. Check memory usage:
   ```bash
   docker stats
   ```

3. Configure JVM heap:
   ```dockerfile
   ENV JAVA_OPTS="-Xmx512m -Xms256m"
   ```

### Long Build Times

**Symptom:** Maven or npm build takes very long

**Solutions:**

1. Skip tests during build:
   ```bash
   mvn clean package -DskipTests
   ```

2. Use parallel builds:
   ```bash
   mvn clean package -T 1C  # 1 thread per core
   ```

3. Cache dependencies:
   ```dockerfile
   RUN mvn dependency:go-offline
   ```

## Support

For issues not covered here:

1. Check application logs
2. Review documentation in relevant .agent.md files
3. Search GitHub issues
4. Contact development team
5. Check Slack #engineering channel

## Related Documentation

- [DEPLOYMENTWORKFLOW.md](./DEPLOYMENTWORKFLOW.md) - Development setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [DATABASE.md](./DATABASE.md) - Database operations
