import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

if (process.env.DATABASE_NAME !== 'aftersales_test') {
  throw new Error(
    `Refusing to run tests against "${process.env.DATABASE_NAME}" — expected "aftersales_test". Check .env.test.`
  );
}
