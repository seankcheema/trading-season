import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { buildValidationPipe } from './config/validation.config.js';
import { buildCorsOptions } from './config/cors.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(buildCorsOptions());
  app.useGlobalPipes(buildValidationPipe());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Auth service is running on http://localhost:${port}`);
}

await bootstrap();
