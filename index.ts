import handlebars from 'handlebars';
import fs from 'fs-extra';
import {Command} from 'commander';
import chalk from "chalk";
import jwt from "jsonwebtoken";
import {$} from "bun";
import * as crypto from "node:crypto";

// Register a join helper to render arrays (e.g. additional redirect URLs)
handlebars.registerHelper('join', (arr: unknown, sep = ',') => {
    if (!Array.isArray(arr)) return arr ?? '';
    return arr.join(sep);
});

// Optional: a safe helper that returns a raw string (same effect as triple-stash)
handlebars.registerHelper('raw', (value: unknown) => {
    return value == null ? '' : String(value);
});

const TEMPLATE = handlebars.compile(`
POSTGRES_PASSWORD="{{{data.POSTGRES_PASSWORD}}}"
JWT_SECRET="{{{data.JWT_SECRET}}}"
ANON_KEY="{{{data.ANON_KEY}}}"
SERVICE_ROLE_KEY="{{{data.SERVICE_ROLE_KEY}}}"
DASHBOARD_USERNAME="{{{data.DASHBOARD_USERNAME}}}"
DASHBOARD_PASSWORD="{{{data.DASHBOARD_PASSWORD}}}"
SECRET_KEY_BASE="{{{data.SECRET_KEY_BASE}}}"
VAULT_ENC_KEY="{{{data.VAULT_ENC_KEY}}}"
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=1
POOLER_DB_POOL_SIZE=5
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
PGRST_DB_SCHEMAS="public,storage,graphql_public"
SITE_URL="{{{data.siteUrl}}}"
ADDITIONAL_REDIRECT_URLS="{{{join data.additionalRedirectUrls ','}}}"
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL="{{{data.apiUrl}}}"
MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
{{#if data.email}}
SMTP_ADMIN_EMAIL="{{{data.email.from}}}"
SMTP_HOST="{{{data.email.host}}}"
SMTP_PORT={{{data.email.port}}}
SMTP_USER="{{{data.email.user}}}"
SMTP_PASS="{{{data.email.pass}}}"
SMTP_SENDER_NAME="{{{data.email.senderName}}}"
{{/if}}
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true
STUDIO_DEFAULT_ORGANIZATION="{{{data.organization}}}"
STUDIO_DEFAULT_PROJECT="{{{data.project}}}"
STUDIO_PORT=3000
SUPABASE_PUBLIC_URL="{{{data.apiUrl}}}"
IMGPROXY_ENABLE_WEBP_DETECTION=true
FUNCTIONS_VERIFY_JWT=false
DOCKER_SOCKET_LOCATION="/var/run/docker.sock"
`.trim());

const compileTemplate = (inputPath: string) => {
    try {
        // Read and parse the JSON input
        const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

        // Automatically generate some secrets (big letters)
        const POSTGRES_PASSWORD = crypto.randomUUID().toString();
        const JWT_SECRET = crypto.randomBytes(32).toString('hex');
        const ANON_KEY = jwt.sign({
            role: "anon",
            iss: "supabase",
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10), // 10 years
            iat: Math.floor(Date.now() / 1000)
        }, JWT_SECRET);
        const SERVICE_ROLE_KEY = jwt.sign({
            role: "service_role",
            iss: "supabase",
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10), // 10 years
            iat: Math.floor(Date.now() / 1000)
        }, JWT_SECRET);
        const VAULT_ENC_KEY = crypto.randomBytes(64).toString('hex');
        const SECRET_KEY_BASE = crypto.randomBytes(32).toString('hex');

        const DASHBOARD_USERNAME = inputData.dashboardUsername || 'admin';
        const DASHBOARD_PASSWORD = inputData.dashboardPassword || crypto.randomUUID().toString();

        // Merge all variables into a single data object
        const data = {
            POSTGRES_PASSWORD,
            JWT_SECRET,
            ANON_KEY,
            SERVICE_ROLE_KEY,
            DASHBOARD_USERNAME,
            DASHBOARD_PASSWORD,
            SECRET_KEY_BASE,
            VAULT_ENC_KEY,
            ...inputData,
        };

        // Generate the output content
        const outputContent = TEMPLATE({ data });

        // Write the output to the specified file
        const outputPath = 'supabase-project/.env';
        fs.writeFileSync(outputPath, outputContent);

        console.log(chalk.green(`Successfully generated output at ${outputPath}`));
    } catch (error) {
        console.error(chalk.red('Error during template compilation:'), error);
    }
}

const create = () => {
    try {
        // Generate input.json, which would need to be filled out by the user
        const exampleInput = {
            siteUrl: "http://localhost:3000",
            apiUrl: "http://localhost:8000",
            organization: "My Organization",
            project: "My Project",
            additionalRedirectUrls: ["http://localhost:3000/callback"],
            email: {
                from: "",
                host: "",
                port: 587,
                user: "",
                pass: "",
                senderName: "My App"
            }
        };

        const inputPath = 'input.json';

        if(!fs.existsSync(inputPath)) {
            fs.writeFileSync(inputPath, JSON.stringify(exampleInput, null, 2));
            console.log(chalk.green(`Created example input file at ${inputPath}. Please fill it out before running the generate command.`));
        } else {
            console.log(chalk.yellow(`Input file ${inputPath} already exists. Please edit it if needed.`));
        }
    } catch (error) {
        console.error(chalk.red('Error during project creation:'), error);
    }
}

const init = async () => {
    console.log(chalk.blue('Running initial setup...'));

    try {
        // Get the latest supabase project
        await $`git clone --depth 1 https://github.com/supabase/supabase`;

        // Create supabase project directory
        await fs.mkdir('supabase-project', { recursive: true });

        // Copy necessary files from the cloned repo to the project directory
        await $`cp -rf supabase/docker/* supabase-project/`;

        // Remove the cloned supabase repo to clean up
        await fs.rm('supabase', { recursive: true, force: true });

        // Create folder postgres
        await fs.mkdir('supabase-project/postgres', { recursive: true });

        // Generate files (base, constraints, data, enums, functions, genesis, pre, triggers, views)
        const sqlFiles = ['base', 'constraints', 'data', 'enums', 'functions', 'genesis', 'pre', 'triggers', 'views'];
        for (const file of sqlFiles) {
            await fs.writeFile(`supabase-project/postgres/${file}.sql`, `-- ${file}.sql\n\n`);
        }

        console.log(chalk.green('Initial setup completed. You can now run the create command to generate an input file.'));
    } catch (error) {
        console.error(chalk.red('Error during initial setup:'), error);
    }
}

const deploy = async (options: any) => {
    try {
        console.log(chalk.blue('Starting deployment...'));

        // Compile sql files into one single file
        const sqlFiles = ['base', 'constraints', 'data', 'enums', 'functions', 'genesis', 'pre', 'triggers', 'views'];
        let combinedSql = '';
        for (const file of sqlFiles) {
            const filePath = `supabase-project/postgres/${file}.sql`;
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                combinedSql += `\n-- ${file}.sql\n${content}\n`;
            }
        }
        const combinedSqlPath = 'supabase-project/postgres/combined.sql';
        fs.writeFileSync(combinedSqlPath, combinedSql);
        console.log(chalk.green(`Combined SQL written to ${combinedSqlPath}`));

        let usingEnv = true;
        let usingOptions = true;

        // Check if any options are provided
        if (!options.host && !options.port && !options.user && !options.database) {
            usingEnv = true;
            usingOptions = false;
        } else {
            usingEnv = false;
            usingOptions = true;
        }

        // Check if options are provided and completed
        if (usingOptions && (!options.host || !options.port || !options.user || !options.database)) {
            console.error(chalk.red('Please provide all required database connection options: host, port, user, database.'));
            console.log(chalk.yellow("It is recommended to pass these as environment variables directly before the command instead, e.g.:"));
            console.log(chalk.yellow("POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres <bootstrappper-app> deploy"));
            return;
        }

        if (usingEnv) {
            // Check environment variables
            const requiredEnvVars = [
                'POSTGRES_HOST',
                'POSTGRES_PORT',
                'POSTGRES_USER',
                'POSTGRES_DB'
            ];

            for (const varName of requiredEnvVars) {
                if (!process.env[varName]) {
                    console.error(chalk.red(`Environment variable ${varName} is not set. Please set it before running the deploy command.`));
                    return;
                }
            }
        }

        const host = usingEnv ? process.env.POSTGRES_HOST : options.host;
        const port = usingEnv ? process.env.POSTGRES_PORT : options.port;
        const user = usingEnv ? process.env.POSTGRES_USER : options.user;
        const database = usingEnv ? process.env.POSTGRES_DB : options.database;
        const password = process.env.POSTGRES_PASSWORD; // Always from env for security

        if(!password) {
            console.error(chalk.red('Environment variable POSTGRES_PASSWORD is not set. Please set it before running the deploy command.'));
            return;
        }

        console.log(chalk.blue(`Deploying to database ${database} at ${host}:${port} as user ${user}...`));

        // Construct psql command with proper Docker volume mounting
        const absoluteCombinedSqlPath = require('path').resolve(combinedSqlPath);
        const psqlCommand = `docker run --rm -i -v "${absoluteCombinedSqlPath}:/sql/combined.sql" -e PGPASSWORD="${password}" postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -f /sql/combined.sql`;

        // Run postgres docker container
        await $`${psqlCommand}`;

        console.log(chalk.green('Deployment completed successfully.'));
    } catch (error) {
        console.error(chalk.red('Error during deployment:'), error);
    }
}

const backup = async (options: any) => {
    try {
        console.log(chalk.blue('Starting backup...'));

        // Check if any options are provided
        let usingEnv = true;
        let usingOptions = false;

        if (!options.host && !options.port && !options.user && !options.database) {
            usingEnv = true;
            usingOptions = false;
        } else {
            usingEnv = false;
            usingOptions = true;
        }

        // Check if options are provided and completed
        if (usingOptions && (!options.host || !options.port || !options.user || !options.database)) {
            console.error(chalk.red('Please provide all required database connection options: host, port, user, database.'));
            console.log(chalk.yellow("It is recommended to pass these as environment variables directly before the command instead, e.g.:"));
            console.log(chalk.yellow("POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres <bootstrappper-app> backup"));
            return;
        }

        if (usingEnv) {
            // Check environment variables
            const requiredEnvVars = [
                'POSTGRES_HOST',
                'POSTGRES_PORT',
                'POSTGRES_USER',
                'POSTGRES_DB'
            ];

            for (const varName of requiredEnvVars) {
                if (!process.env[varName]) {
                    console.error(chalk.red(`Environment variable ${varName} is not set. Please set it before running the backup command.`));
                    return;
                }
            }
        }

        const host = usingEnv ? process.env.POSTGRES_HOST : options.host;
        const port = usingEnv ? process.env.POSTGRES_PORT : options.port;
        const user = usingEnv ? process.env.POSTGRES_USER : options.user;
        const database = usingEnv ? process.env.POSTGRES_DB : options.database;
        const password = process.env.POSTGRES_PASSWORD; // Always from env for security

        if(!password) {
            console.error(chalk.red('Environment variable POSTGRES_PASSWORD is not set. Please set it before running the backup command.'));
            return;
        }

        console.log(chalk.blue(`Backing up database ${database} at ${host}:${port} as user ${user}...`));

        // Ensure migration directory exists
        const migrationDir = 'supabase-project/migrations';
        await fs.mkdir(migrationDir, { recursive: true });

        // Create timestamped folder
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
        const backupDir = `${migrationDir}/backup_${timestamp}`;
        await fs.mkdir(backupDir, { recursive: true });

        // Get absolute paths for Docker volume mounting
        const absoluteBackupDir = require('path').resolve(backupDir);

        console.log(chalk.blue(`Targeting public schema only. Backup files will be stored in ${backupDir}`));

        // Run pg_dump commands with proper Bun $ template syntax
        console.log(chalk.blue('Acquiring pre-data schema...'));
        await $`docker run --rm -v ${absoluteBackupDir}:/backup -e PGPASSWORD=${password} postgres pg_dump --schema=public --section=pre-data -h ${host} -p ${port} -U ${user} -d ${database} -s -f /backup/schema-pre.sql`;

        console.log(chalk.blue('Acquiring post-data-schema...'));
        await $`docker run --rm -v ${absoluteBackupDir}:/backup -e PGPASSWORD=${password} postgres pg_dump --schema=public --section=post-data -h ${host} -p ${port} -U ${user} -d ${database} -s -f /backup/schema-post.sql`;

        console.log(chalk.blue('Acquiring data dump...'));
        await $`docker run --rm -v ${absoluteBackupDir}:/backup -e PGPASSWORD=${password} postgres pg_dump --schema=public -h ${host} -p ${port} -U ${user} -d ${database} -a --column-inserts --data-only -f /backup/data.sql`;

        console.log(chalk.green(`Backup completed successfully. Files are located in ${backupDir}`));
    } catch (error) {
        console.error(chalk.red('Error during backup:'), error);
    }
}

const migrate = async (option: any) => {
    try {
        console.log(chalk.blue('Starting migration...'));

        // Check if any options are provided
        let usingEnv: boolean;
        let usingOptions: boolean;

        if (!option.host && !option.port && !option.user && !option.database) {
            usingEnv = true;
            usingOptions = false;
        } else {
            usingEnv = false;
            usingOptions = true;
        }

        // Check if options are provided and completed
        if (usingOptions && (!option.host || !option.port || !option.user || !option.database)) {
            console.error(chalk.red('Please provide all required database connection options: host, port, user, database.'));
            console.log(chalk.yellow("It is recommended to pass these as environment variables directly before the command instead, e.g.:"));
            console.log(chalk.yellow("POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres <bootstrappper-app> migrate"));
            return;
        }

        if (usingEnv) {
            // Check environment variables
            const requiredEnvVars = [
                'POSTGRES_HOST',
                'POSTGRES_PORT',
                'POSTGRES_USER',
                'POSTGRES_DB'
            ];

            for (const varName of requiredEnvVars) {
                if (!process.env[varName]) {
                    console.error(chalk.red(`Environment variable ${varName} is not set. Please set it before running the migrate command.`));
                    return;
                }
            }
        }

        const host = usingEnv ? process.env.POSTGRES_HOST : option.host;
        const port = usingEnv ? process.env.POSTGRES_PORT : option.port;
        const user = usingEnv ? process.env.POSTGRES_USER : option.user;
        const database = usingEnv ? process.env.POSTGRES_DB : option.database;
        const password = process.env.POSTGRES_PASSWORD; // Always from env for security

        if(!password) {
            console.error(chalk.red('Environment variable POSTGRES_PASSWORD is not set. Please set it before running the migrate command.'));
            return;
        }

        console.log(chalk.blue(`Migrating database ${database} at ${host}:${port} as user ${user}...`));

        // Ensure migration directory exists
        const migrationDir = 'supabase-project/migrations';
        if (!fs.existsSync(migrationDir)) {
            console.error(chalk.red(`Migration directory ${migrationDir} does not exist. Please create some migrations first.`));
            return;
        }

        // Read migration files and sort them (excluding pre-data.sql, post-data.sql, data.sql)
        const migrationFiles = fs.readdirSync(migrationDir)
            .filter(file => file.endsWith('.sql') &&
                    !['schema-pre.sql', 'schema-post.sql', 'data.sql'].includes(file))
            .sort();

        // Get absolute paths for Docker volume mounting
        const absoluteMigrationDir = require('path').resolve(migrationDir);

        // Create migrations tracking table if it doesn't exist
        const createMigrationsTable = `
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        console.log(chalk.blue('Ensuring migrations tracking table exists...'));
        try {
            await $`docker run --rm -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -c ${createMigrationsTable}`;
        } catch (error) {
            console.error(chalk.red('Failed to create migrations table:'), error);
            return;
        }

        // Get applied migrations
        let appliedMigrations = new Set<string>();
        try {
            const appliedMigrationsResult = await $`docker run --rm -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -t -c "SELECT version FROM schema_migrations;"`;
            appliedMigrations = new Set(
                appliedMigrationsResult.stdout.toString()
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
            );
        } catch (error) {
            console.log(chalk.yellow('Could not fetch applied migrations, assuming fresh database...'));
        }

        // If target is specified, find its index
        let targetIndex = migrationFiles.length - 1;
        if (option.target) {
            const targetFile = migrationFiles.find(file => file.includes(option.target));
            if (!targetFile) {
                console.error(chalk.red(`Target migration ${option.target} not found in ${migrationDir}.`));
                return;
            }
            targetIndex = migrationFiles.indexOf(targetFile);
        }

        // Check if pre-data.sql and post-data.sql exist
        const preDataPath = `${absoluteMigrationDir}/pre-data.sql`;
        const postDataPath = `${absoluteMigrationDir}/post-data.sql`;
        const hasPreData = fs.existsSync(preDataPath);
        const hasPostData = fs.existsSync(postDataPath);

        // Apply pre-data if it exists and no migrations have been applied yet
        if (hasPreData && appliedMigrations.size === 0) {
            console.log(chalk.blue('Applying pre-data.sql...'));
            await $`docker run --rm -v ${absoluteMigrationDir}:/sql -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -f /sql/schema-pre.sql`;
        }

        // Apply individual migrations up to target
        for (let i = 0; i <= targetIndex; i++) {
            const migrationFile = migrationFiles[i];
            if (!migrationFile) continue;

            const version = migrationFile.replace('.sql', '');

            if (!appliedMigrations.has(version)) {
                console.log(chalk.blue(`Applying migration: ${migrationFile}`));
                try {
                    await $`docker run --rm -v ${absoluteMigrationDir}:/sql -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -f /sql/${migrationFile}`;

                    // Mark as applied
                    await $`docker run --rm -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -c "INSERT INTO schema_migrations (version) VALUES ('${version}');"`;
                    console.log(chalk.green(`✓ Applied migration: ${migrationFile}`));
                } catch (error) {
                    console.error(chalk.red(`✗ Failed to apply migration: ${migrationFile}`), error);
                    return;
                }
            } else {
                console.log(chalk.yellow(`⚬ Skipping already applied migration: ${migrationFile}`));
            }
        }

        // Apply post-data if it exists (always run this as it contains constraints, indexes, etc.)
        if (hasPostData) {
            console.log(chalk.blue('Applying post-data.sql...'));
            await $`docker run --rm -v ${absoluteMigrationDir}:/sql -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -f /sql/schema-post.sql`;
        }

        // If data.sql exists, apply it
        const dataPath = `${absoluteMigrationDir}/data.sql`;
        if (fs.existsSync(dataPath)) {
            console.log(chalk.blue('Applying data.sql...'));
            await $`docker run --rm -v ${absoluteMigrationDir}:/sql -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -f /sql/data.sql`;
        }

        console.log(chalk.green('Migration completed successfully.'));
    } catch (error) {
        console.error(chalk.red('Error during migration:'), error);
    }
}

// Utility function to validate database connection
const validateDatabaseConnection = async (host: string, port: string, user: string, database: string, password: string): Promise<boolean> => {
    try {
        console.log(chalk.blue('Testing database connection...'));
        await $`docker run --rm -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -c "SELECT 1;"`;
        console.log(chalk.green('✓ Database connection successful'));
        return true;
    } catch (error) {
        console.error(chalk.red('✗ Database connection failed:'), error);
        return false;
    }
};

// Create a new migration file
const createMigration = (name: string) => {
    try {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
        const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
        const migrationDir = 'supabase-project/migrations';

        fs.ensureDirSync(migrationDir);

        const migrationPath = `${migrationDir}/${filename}`;
        const template = `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}
-- 
-- Add your SQL statements here
-- Remember to make your migrations reversible when possible

-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

`;

        fs.writeFileSync(migrationPath, template);
        console.log(chalk.green(`✓ Created migration file: ${migrationPath}`));
        console.log(chalk.blue('Edit the file to add your SQL statements, then run the migrate command.'));
    } catch (error) {
        console.error(chalk.red('Error creating migration:'), error);
    }
};

// Show migration status
const showMigrationStatus = async (options: any) => {
    try {
        let usingEnv: boolean;
        let usingOptions: boolean;

        if (!options.host && !options.port && !options.user && !options.database) {
            usingEnv = true;
            usingOptions = false;
        } else {
            usingEnv = false;
            usingOptions = true;
        }

        if (usingOptions && (!options.host || !options.port || !options.user || !options.database)) {
            console.error(chalk.red('Please provide all required database connection options: host, port, user, database.'));
            return;
        }

        if (usingEnv) {
            const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_DB'];
            for (const varName of requiredEnvVars) {
                if (!process.env[varName]) {
                    console.error(chalk.red(`Environment variable ${varName} is not set.`));
                    return;
                }
            }
        }

        const host = usingEnv ? process.env.POSTGRES_HOST : options.host;
        const port = usingEnv ? process.env.POSTGRES_PORT : options.port;
        const user = usingEnv ? process.env.POSTGRES_USER : options.user;
        const database = usingEnv ? process.env.POSTGRES_DB : options.database;
        const password = process.env.POSTGRES_PASSWORD;

        if (!password) {
            console.error(chalk.red('Environment variable POSTGRES_PASSWORD is not set.'));
            return;
        }

        // Validate connection first
        if (!(await validateDatabaseConnection(host!, port!, user!, database!, password))) {
            return;
        }

        const migrationDir = 'supabase-project/migrations';
        if (!fs.existsSync(migrationDir)) {
            console.log(chalk.yellow('No migrations directory found.'));
            return;
        }

        // Get all migration files
        const migrationFiles = fs.readdirSync(migrationDir)
            .filter(file => file.endsWith('.sql') &&
                    !['pre-data.sql', 'post-data.sql', 'data.sql'].includes(file))
            .sort();

        // Get applied migrations
        let appliedMigrations = new Set<string>();
        try {
            const appliedMigrationsResult = await $`docker run --rm -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -t -c "SELECT version FROM schema_migrations;"`;
            appliedMigrations = new Set(
                appliedMigrationsResult.stdout.toString()
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
            );
        } catch (error) {
            console.log(chalk.yellow('Could not fetch applied migrations (schema_migrations table may not exist).'));
        }

        console.log(chalk.blue(`\nMigration Status for ${database}@${host}:${port}\n`));

        if (migrationFiles.length === 0) {
            console.log(chalk.yellow('No migration files found.'));
            return;
        }

        migrationFiles.forEach(file => {
            const version = file.replace('.sql', '');
            const status = appliedMigrations.has(version) ?
                chalk.green('✓ Applied') :
                chalk.yellow('⚬ Pending');
            console.log(`${status}  ${file}`);
        });

        const pendingCount = migrationFiles.length - appliedMigrations.size;
        console.log(chalk.blue(`\nTotal: ${migrationFiles.length} migrations, ${appliedMigrations.size} applied, ${pendingCount} pending\n`));

    } catch (error) {
        console.error(chalk.red('Error checking migration status:'), error);
    }
};

// Test database connection
const testConnection = async (options: any) => {
    try {
        let usingEnv: boolean;
        let usingOptions: boolean;

        if (!options.host && !options.port && !options.user && !options.database) {
            usingEnv = true;
            usingOptions = false;
        } else {
            usingEnv = false;
            usingOptions = true;
        }

        if (usingOptions && (!options.host || !options.port || !options.user || !options.database)) {
            console.error(chalk.red('Please provide all required database connection options: host, port, user, database.'));
            return;
        }

        if (usingEnv) {
            const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_DB'];
            for (const varName of requiredEnvVars) {
                if (!process.env[varName]) {
                    console.error(chalk.red(`Environment variable ${varName} is not set.`));
                    return;
                }
            }
        }

        const host = usingEnv ? process.env.POSTGRES_HOST : options.host;
        const port = usingEnv ? process.env.POSTGRES_PORT : options.port;
        const user = usingEnv ? process.env.POSTGRES_USER : options.user;
        const database = usingEnv ? process.env.POSTGRES_DB : options.database;
        const password = process.env.POSTGRES_PASSWORD;

        if (!password) {
            console.error(chalk.red('Environment variable POSTGRES_PASSWORD is not set.'));
            return;
        }

        await validateDatabaseConnection(host!, port!, user!, database!, password);

    } catch (error) {
        console.error(chalk.red('Error testing connection:'), error);
    }
};

// Start Supabase locally with Docker Compose
const startLocal = async (options: any) => {
    try {
        console.log(chalk.blue('Starting Supabase locally...'));

        const projectDir = 'supabase-project';
        if (!fs.existsSync(projectDir)) {
            console.error(chalk.red(`Project directory ${projectDir} does not exist. Run 'init' command first.`));
            return;
        }

        if (!fs.existsSync(`${projectDir}/.env`)) {
            console.error(chalk.red(`Environment file ${projectDir}/.env does not exist. Run 'generate' command first.`));
            return;
        }

        process.chdir(projectDir);

        if (options.detach) {
            console.log(chalk.blue('Starting in detached mode...'));
            await $`docker-compose up -d`;
        } else {
            console.log(chalk.blue('Starting in foreground mode (press Ctrl+C to stop)...'));
            await $`docker-compose up`;
        }

        console.log(chalk.green('Supabase started successfully!'));
        console.log(chalk.blue('Access the dashboard at: http://localhost:3000'));

    } catch (error) {
        console.error(chalk.red('Error starting Supabase:'), error);
    } finally {
        process.chdir('..');
    }
};

// Stop Supabase locally
const stopLocal = async () => {
    try {
        console.log(chalk.blue('Stopping Supabase...'));

        const projectDir = 'supabase-project';
        if (!fs.existsSync(projectDir)) {
            console.error(chalk.red(`Project directory ${projectDir} does not exist.`));
            return;
        }

        process.chdir(projectDir);
        await $`docker-compose down`;
        console.log(chalk.green('Supabase stopped successfully!'));

    } catch (error) {
        console.error(chalk.red('Error stopping Supabase:'), error);
    } finally {
        process.chdir('..');
    }
};

// Clean database - drop all tables and reset schema
const cleanDatabase = async (options: any) => {
    try {
        console.log(chalk.blue('Starting database cleanup...'));

        // Check if any options are provided
        let usingEnv: boolean;
        let usingOptions: boolean;

        if (!options.host && !options.port && !options.user && !options.database) {
            usingEnv = true;
            usingOptions = false;
        } else {
            usingEnv = false;
            usingOptions = true;
        }

        // Check if options are provided and completed
        if (usingOptions && (!options.host || !options.port || !options.user || !options.database)) {
            console.error(chalk.red('Please provide all required database connection options: host, port, user, database.'));
            console.log(chalk.yellow("It is recommended to pass these as environment variables directly before the command instead, e.g.:"));
            console.log(chalk.yellow("POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres <bootstrappper-app> clean"));
            return;
        }

        if (usingEnv) {
            // Check environment variables
            const requiredEnvVars = [
                'POSTGRES_HOST',
                'POSTGRES_PORT',
                'POSTGRES_USER',
                'POSTGRES_DB'
            ];

            for (const varName of requiredEnvVars) {
                if (!process.env[varName]) {
                    console.error(chalk.red(`Environment variable ${varName} is not set. Please set it before running the clean command.`));
                    return;
                }
            }
        }

        const host = usingEnv ? process.env.POSTGRES_HOST : options.host;
        const port = usingEnv ? process.env.POSTGRES_PORT : options.port;
        const user = usingEnv ? process.env.POSTGRES_USER : options.user;
        const database = usingEnv ? process.env.POSTGRES_DB : options.database;
        const password = process.env.POSTGRES_PASSWORD;

        if (!password) {
            console.error(chalk.red('Environment variable POSTGRES_PASSWORD is not set. Please set it before running the clean command.'));
            return;
        }

        // Validate connection first
        if (!(await validateDatabaseConnection(host!, port!, user!, database!, password))) {
            return;
        }

        // Show warning and get confirmation
        console.log(chalk.red('\n⚠️  WARNING: This will permanently delete ALL data and tables in the database!'));
        console.log(chalk.yellow(`Database: ${database}@${host}:${port}`));
        console.log(chalk.red('This action cannot be undone!\n'));

        // Skip confirmation if --force flag is provided
        if (!options.force) {
            console.log(chalk.blue('Please type "DELETE ALL DATA" to confirm:'));

            // Read user input for confirmation
            const confirmation = await new Promise<string>((resolve) => {
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.once('data', (data) => {
                    resolve(data.toString().trim());
                });
            });

            if (confirmation !== 'DELETE ALL DATA') {
                console.log(chalk.yellow('Operation cancelled. Database was not modified.'));
                return;
            }
        } else {
            console.log(chalk.yellow('⚠️  Force flag detected - skipping confirmation prompt'));
        }

        console.log(chalk.blue('\n🧹 Starting database cleanup...'));

        // Create backup before cleaning (if requested)
        if (options.backup) {
            console.log(chalk.blue('📦 Creating backup before cleanup...'));
            await backup(options);
            console.log(chalk.green('✓ Backup completed'));
        }

        // SQL to clean database
        const cleanupSQL = `
-- Drop all tables in public schema (cascading to remove dependencies)
DO $$ DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all views
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (SELECT routines.routine_name FROM information_schema.routines WHERE routines.routine_schema = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all types
    FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- Reset sequences and other objects
TRUNCATE TABLE IF EXISTS schema_migrations;

-- Notify completion
SELECT 'Database cleaned successfully' as result;
        `;

        console.log(chalk.blue('🗑️  Dropping all tables, functions, views, and types...'));

        try {
            await $`docker run --rm -e PGPASSWORD=${password} postgres:latest psql -h ${host} -p ${port} -U ${user} -d ${database} -c ${cleanupSQL}`;

            console.log(chalk.green('✓ All database objects have been removed'));
            console.log(chalk.green('✓ Migration tracking has been reset'));
            console.log(chalk.blue('\n📋 You can now:'));
            console.log(chalk.blue('   • Run `deploy` to apply your postgres/ schema'));
            console.log(chalk.blue('   • Run `migrate` to apply migrations from scratch'));
            console.log(chalk.blue('   • Start fresh with a clean database'));

        } catch (error) {
            console.error(chalk.red('✗ Error during database cleanup:'), error);
            console.log(chalk.yellow('\n💡 If you have a backup, you can restore it using standard PostgreSQL tools.'));
            return;
        }

        console.log(chalk.green('\n🎉 Database cleanup completed successfully!'));

    } catch (error) {
        console.error(chalk.red('Error during database cleanup:'), error);
    }
};

const main = async () => {
    const program = new Command();

    program
        .name("Supabase bootstrapper by Marcus Marrio (Suliluz)")
        .description("A CLI tool to bootstrap Supabase projects with predefined templates.")
        .version("1.0.0");

    program
        .command("create")
        .description("Create a new Supabase project template input file.")
        .action(() => {
            create();
        });

    program
        .command("generate")
        .description("Generate a new Supabase environment from a template.")
        .requiredOption("-i, --input <inputPath>", "JSON input path")
        .action((options) => {
            compileTemplate(options.input);
        });

    program
        .command("init")
        .description("Initialize the Supabase project structure.")
        .action(() => {
            init();
        });

    // === SCHEMA DEPLOYMENT (postgres folder) ===
    program
        .command("deploy")
        .description("Deploy combined SQL schema from postgres/ folder (for initial setup or full rebuilds)")
        .option("-h, --host <host>", "Database host", "localhost")
        .option("-p, --port <port>", "Database port", "5432")
        .option("-u, --user <user>", "Database user", "postgres")
        .option("-d, --database <database>", "Database name", "postgres")
        .action((options) => {
            deploy(options);
        });

    // === MIGRATION SYSTEM (migrations folder) ===
    program
        .command("create-migration")
        .description("Create a new timestamped migration file for incremental changes")
        .requiredOption("-n, --name <name>", "Migration name")
        .action((options) => {
            createMigration(options.name);
        });

    program
        .command("migrate")
        .description("Apply pending migrations from migrations/ folder (for incremental updates)")
        .option("-h, --host <host>", "Database host", "localhost")
        .option("-p, --port <port>", "Database port", "5432")
        .option("-u, --user <user>", "Database user", "postgres")
        .option("-d, --database <database>", "Database name", "postgres")
        .option("-t, --target <target>", "Target migration name")
        .action((options) => {
            migrate(options);
        });

    program
        .command("status")
        .description("Show migration status (applied vs pending migrations)")
        .option("-h, --host <host>", "Database host", "localhost")
        .option("-p, --port <port>", "Database port", "5432")
        .option("-u, --user <user>", "Database user", "postgres")
        .option("-d, --database <database>", "Database name", "postgres")
        .action((options) => {
            showMigrationStatus(options);
        });

    // === DATABASE OPERATIONS ===
    program
        .command("dump-schema")
        .description("Export current database schema to migrations/ folder (for creating baseline or backups)")
        .option("-h, --host <host>", "Database host", "localhost")
        .option("-p, --port <port>", "Database port", "5432")
        .option("-u, --user <user>", "Database user", "postgres")
        .option("-d, --database <database>", "Database name", "postgres")
        .action((options) => {
            backup(options);
        });

    program
        .command("test-connection")
        .description("Test database connection")
        .option("-h, --host <host>", "Database host", "localhost")
        .option("-p, --port <port>", "Database port", "5432")
        .option("-u, --user <user>", "Database user", "postgres")
        .option("-d, --database <database>", "Database name", "postgres")
        .action((options) => {
            testConnection(options);
        });

    // === LOCAL DEVELOPMENT ===
    program
        .command("start")
        .description("Start Supabase locally using Docker Compose")
        .option("-d, --detach", "Run in detached mode")
        .action((options) => {
            startLocal(options);
        });

    program
        .command("stop")
        .description("Stop local Supabase instance")
        .action(() => {
            stopLocal();
        });

    program
        .command("clean")
        .description("Clean the database - drop all tables, views, functions, and types (with confirmation)")
        .option("-h, --host <host>", "Database host", "localhost")
        .option("-p, --port <port>", "Database port", "5432")
        .option("-u, --user <user>", "Database user", "postgres")
        .option("-d, --database <database>", "Database name", "postgres")
        .option("--force", "Skip confirmation prompt")
        .option("--backup", "Create a backup before cleaning")
        .action((options) => {
            cleanDatabase(options);
        });

    await program.parseAsync(process.argv);
}

main().catch(error => {
    console.error('Error occurred during build', error);
    process.exit(1);
});
