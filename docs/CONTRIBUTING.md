# Contributing Guidelines

## Welcome

Thank you for your interest in contributing to the Trading Season Application. This document provides guidelines for participating in the project.

## Code of Conduct

All contributors must adhere to our Code of Conduct:
- Be respectful and inclusive
- Report inappropriate behavior to the maintainers
- Foster a welcoming environment for all

## Getting Started

### Prerequisites

- Read [DEVELOPMENTWORKFLOW.md](./DEVELOPMENTWORKFLOW.md) for setup instructions
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) to understand system design
- Familiarize yourself with relevant technologies:
  - Backend: Spring Boot, Java 21, Maven
  - Frontend: Angular 22, TypeScript, npm
  - Database: PostgreSQL, Flyway migrations

### Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/dualeapa-sprint1-project.git
   cd dualeapa-sprint1-project
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/dualeapa-sprint1-project.git
   ```

4. Set up development environment:
   ```bash
   npm install
   cd apps/business-backend && mvn install && cd ../..
   docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d
   ```

## Workflow

### Creating a Feature Branch

```bash
# Update your local main
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/descriptive-name

# Branch naming conventions:
# - feature/new-feature
# - bugfix/issue-description
# - docs/documentation-update
# - refactor/code-area
# - chore/maintenance-task
```

### Making Changes

#### Backend (Java)

1. Create feature in appropriate package:
   ```
   src/main/java/com/neueda/leap/domain/
   ├── MyFeatureController.java
   ├── MyFeatureService.java
   ├── MyFeatureRepository.java (if JPA)
   └── test/
       ├── MyFeatureControllerTest.java
       └── MyFeatureServiceTest.java
   ```

2. Follow naming conventions:
   - Classes: PascalCase (UserService.java)
   - Methods: camelCase (getUserById)
   - Constants: UPPER_SNAKE_CASE (MAX_RETRIES)

3. Add Javadoc comments:
   ```java
   /**
    * Retrieves user by ID with associated sessions.
    *
    * @param userId the UUID of the user
    * @return the User entity
    * @throws EntityNotFoundException if user not found
    */
   @GetMapping("/{userId}")
   public UserDto getUserById(@PathVariable UUID userId) {
       // implementation
   }
   ```

4. Write unit tests:
   ```java
   @ExtendWith(MockitoExtension.class)
   class UserServiceTest {
       @Mock
       private UserRepository userRepository;

       @InjectMocks
       private UserService userService;

       @Test
       void testGetUserById() {
           // Arrange
           UUID userId = UUID.randomUUID();
           User expectedUser = new User(userId, "john");

           // Act
           when(userRepository.findById(userId))
               .thenReturn(Optional.of(expectedUser));
           User result = userService.getUserById(userId);

           // Assert
           assertEquals(expectedUser, result);
           verify(userRepository).findById(userId);
       }
   }
   ```

#### Frontend (Angular/TypeScript)

1. Create component in feature module:
   ```bash
   ng generate component features/my-feature
   ```

2. Follow naming conventions:
   - Components: FeatureNameComponent
   - Services: FeatureNameService
   - Interfaces: IFeatureName or FeatureName
   - Constants: in constants.ts

3. Use TypeScript strict mode:
   ```typescript
   interface User {
       id: string;
       name: string;
       email: string;
   }

   @Component({
       selector: 'app-user-profile',
       standalone: true,
       imports: [CommonModule, ReactiveFormsModule]
   })
   export class UserProfileComponent {
       users$: Observable<User[]>;

       constructor(private userService: UserService) {
           this.users$ = this.userService.getUsers();
       }
   }
   ```

4. Write component tests:
   ```typescript
   describe('UserProfileComponent', () => {
       let component: UserProfileComponent;
       let fixture: ComponentFixture<UserProfileComponent>;
       let userService: jasmine.SpyObj<UserService>;

       beforeEach(async () => {
           const spy = jasmine.createSpyObj('UserService', ['getUsers']);
           await TestBed.configureTestingModule({
               imports: [UserProfileComponent],
               providers: [{ provide: UserService, useValue: spy }]
           }).compileComponents();

           userService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
           fixture = TestBed.createComponent(UserProfileComponent);
           component = fixture.componentInstance;
       });

       it('should load users on init', () => {
           const mockUsers: User[] = [{ id: '1', name: 'John', email: 'john@test.com' }];
           userService.getUsers.and.returnValue(of(mockUsers));

           fixture.detectChanges();

           expect(component.users$).toBeDefined();
       });
   });
   ```

#### Database Migrations

1. Create migration file:
   ```bash
   touch apps/business-backend/db/migrations/V00X__Descriptive_name.sql
   ```

2. Write migration with proper SQL:
   ```sql
   -- V003__Add_new_feature_table.sql
   -- Migration description and purpose
   
   CREATE TABLE new_feature_table (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       name VARCHAR(255) NOT NULL,
       description TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT new_feature_name_not_empty CHECK (length(name) > 0)
   );

   CREATE INDEX idx_new_feature_user ON new_feature_table(user_id);
   CREATE INDEX idx_new_feature_created ON new_feature_table(created_at);
   ```

3. Test migration:
   ```bash
   cd apps/business-backend
   mvn flyway:migrate
   ```

### Commit Messages

Follow conventional commits format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add JWT token refresh endpoint

- Implement refresh token mechanism
- Add expiration validation
- Update security config

Closes #123
```

```
fix(orders): handle concurrent order execution

Prevents race condition when multiple orders placed simultaneously.

Fixes #456
```

### Testing Requirements

Before submitting a pull request, ensure:

#### Backend Tests
```bash
cd apps/business-backend

# Run all tests
mvn test

# Run specific test
mvn test -Dtest=UserServiceTest

# Check coverage (minimum 80%)
mvn jacoco:report
```

#### Frontend Tests
```bash
cd apps/business-logic-ui

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Check coverage (minimum 80%)
```

### Code Style

#### Java (Backend)

- Use Google Java Style Guide
- Line length: 100 characters maximum
- Use 4 spaces for indentation
- Add @Override annotations
- Keep methods under 30 lines when possible

#### TypeScript (Frontend)

- Use Angular Style Guide
- Line length: 80 characters maximum
- Use 2 spaces for indentation
- Use strict type annotations
- Avoid `any` type

### Linting

#### Backend
```bash
cd apps/business-backend
mvn checkstyle:check
```

#### Frontend
```bash
cd apps/business-logic-ui
npm run lint
npm run lint -- --fix  # Auto-fix issues
```

## Pull Request Process

### Preparation

1. Sync with upstream:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Run tests locally:
   ```bash
   # Backend
   cd apps/business-backend && mvn clean test

   # Frontend
   cd apps/business-logic-ui && npm test
   ```

3. Build locally:
   ```bash
   # Backend
   cd apps/business-backend && mvn clean package -DskipTests

   # Frontend
   cd apps/business-logic-ui && npm run build
   ```

### Creating Pull Request

1. Push branch:
   ```bash
   git push origin feature/descriptive-name
   ```

2. Open PR on GitHub
   - Fill out PR template completely
   - Link related issues (#123, #456)
   - Describe changes clearly
   - Add screenshots for UI changes

3. PR Template:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests added
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Comments added for complex logic
   - [ ] Documentation updated
   - [ ] No breaking changes
   - [ ] Tests pass locally

   ## Related Issues
   Closes #123
   ```

### Review Process

1. Wait for maintainer review
2. Address feedback:
   ```bash
   # Make requested changes
   git add .
   git commit -m "Address review feedback"
   git push origin feature/descriptive-name
   ```
3. After approval, maintainers will merge

## Documentation

### README Files

Every major component should have comprehensive README:
- Purpose and responsibility
- Key features
- Configuration options
- Example usage
- Testing instructions

### Code Comments

```java
// Good: explains why, not what code does
// User sessions must be invalidated before logout to prevent token reuse
userSessionRepository.deleteByUserId(userId);

// Bad: just repeats what code does
// Delete user sessions
userSessionRepository.deleteByUserId(userId);
```

### API Documentation

Document all endpoints in [APIREFERENCE.md](./APIREFERENCE.md):
- HTTP method and path
- Request/response examples
- Error codes
- Authentication requirements

## Reporting Issues

### Issue Template

```markdown
## Description
Clear description of issue

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Windows/macOS/Linux
- Node version: 22.x
- Java version: 21
- Docker version: 24.x

## Screenshots
Add screenshots if applicable

## Logs
Add relevant log snippets
```

## Communication

- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Questions and ideas
- Pull Requests: Code reviews and feedback

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Additional Resources

- [DEVELOPMENTWORKFLOW.md](./DEVELOPMENTWORKFLOW.md) - Setup and running locally
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [TESTING.md](./TESTING.md) - Detailed testing guide (if available)

## Questions?

- Check existing documentation
- Search GitHub issues
- Ask in GitHub Discussions
- Contact maintainers directly

Thank you for contributing to the Trading Season Application!
