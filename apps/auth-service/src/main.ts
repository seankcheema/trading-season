import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { buildValidationPipe } from './config/validation.config.js';
import { buildCorsOptions } from './config/cors.config.js';
import { SeedService } from './config/seed.service.js';
import {SwaggerModule, DocumentBuilder} from '@nestjs/swagger';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(buildCorsOptions());
  app.useGlobalPipes(buildValidationPipe());

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription('Email/password authentication and token management for Auth service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  
  // Seed test user for development
  const seedService = app.get(SeedService);
  await seedService.seedTestUser();
  
  console.log(`Auth service is running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

await bootstrap();
